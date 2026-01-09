import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const serviceOrderId = body?.serviceOrderId as string | undefined;

    if (!serviceOrderId) {
      return new Response(
        JSON.stringify({ success: false, error: "serviceOrderId é obrigatório" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: settings } = await supabase
      .from("system_settings")
      .select("focus_nfe_token, focus_nfe_environment")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (!settings?.focus_nfe_token) {
      return new Response(
        JSON.stringify({ success: false, error: "Token Focus NFe não configurado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const focusBaseUrl = settings.focus_nfe_environment === "production"
      ? "https://api.focusnfe.com.br"
      : "https://homologacao.focusnfe.com.br";

    const { data: order, error: orderError } = await supabase
      .from("service_orders")
      .select("id, invoice_reference")
      .eq("id", serviceOrderId)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ success: false, error: "Ordem de serviço não encontrada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 },
      );
    }

    const ref = order.invoice_reference;
    if (!ref) {
      return new Response(
        JSON.stringify({ success: false, error: "invoice_reference não encontrado para esta OS" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 },
      );
    }

    const token = (settings.focus_nfe_token as string).trim();
    const authToken = btoa(`${token}:`);

    const consultUrl = `${focusBaseUrl}/v2/nfse/${ref}`;
    console.log("🔎 Consultando status na Focus:", consultUrl);

    const resp = await fetch(consultUrl, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${authToken}`,
        "Accept": "application/json",
      },
    });

    const text = await resp.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      data = null;
    }

    if (!resp.ok) {
      console.error("❌ Erro consulta Focus:", resp.status, text);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao consultar Focus", status: resp.status, details: data || text }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const status = data?.status ?? data?.data?.status;
    const erros = data?.erros ?? data?.data?.erros;

    // Normalizar URLs (não dependemos disso para download, mas ajuda no banco/UI)
    const urlPdf = data?.url_danfse ?? data?.data?.url_danfse ?? data?.url ?? data?.data?.url ?? null;
    const caminhoXml = data?.caminho_xml_nota_fiscal ?? data?.data?.caminho_xml_nota_fiscal ?? null;

    if (Array.isArray(erros) && erros.length > 0) {
      const msg = erros.map((e: any) => {
        const c = e?.Codigo || e?.codigo || "";
        const d = e?.Descricao || e?.descricao || e?.mensagem || e?.message || "";
        return c ? `[${c}] ${d}` : d;
      }).filter(Boolean).join("\n");

      await supabase
        .from("service_orders")
        .update({
          invoice_status: "erro_autorizacao",
          invoice_error: msg || "Erro ao autorizar NFS-e",
          invoice_error_code: erros?.[0]?.Codigo || erros?.[0]?.codigo || "ERRO_AUTORIZACAO",
          invoice_updated_at: new Date().toISOString(),
        })
        .eq("id", serviceOrderId);

      return new Response(
        JSON.stringify({ success: true, status: "erro_autorizacao", error: msg }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    if (status === "autorizado") {
      const invoiceNumber = data?.numero ?? data?.data?.numero ?? null;
      const verificationCode = data?.codigo_verificacao ?? data?.data?.codigo_verificacao ?? null;

      await supabase
        .from("service_orders")
        .update({
          invoice_status: "emitida",
          invoice_number: invoiceNumber,
          invoice_key: verificationCode,
          invoice_verification_code: verificationCode,
          invoice_pdf_url: urlPdf,
          invoice_xml_url: caminhoXml,
          invoice_error: null,
          invoice_error_code: null,
          invoice_updated_at: new Date().toISOString(),
        })
        .eq("id", serviceOrderId);

      return new Response(
        JSON.stringify({ success: true, status: "emitida", invoice_number: invoiceNumber }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    if (status === "erro_autorizacao") {
      const msg = data?.mensagem_sefaz ?? data?.data?.mensagem_sefaz ?? "Erro ao autorizar NFS-e";
      await supabase
        .from("service_orders")
        .update({
          invoice_status: "erro_autorizacao",
          invoice_error: msg,
          invoice_error_code: data?.codigo_erro ?? data?.data?.codigo_erro ?? "ERRO_AUTORIZACAO",
          invoice_updated_at: new Date().toISOString(),
        })
        .eq("id", serviceOrderId);

      return new Response(
        JSON.stringify({ success: true, status: "erro_autorizacao", error: msg }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // Qualquer outro status: manter processando
    await supabase
      .from("service_orders")
      .update({
        invoice_status: "processando_autorizacao",
        invoice_updated_at: new Date().toISOString(),
      })
      .eq("id", serviceOrderId);

    return new Response(
      JSON.stringify({ success: true, status: "processando_autorizacao", focus_status: status || "desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("❌ Erro na consulta de status:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || "Erro interno" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});

