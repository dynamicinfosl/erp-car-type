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
    console.log("🔔 Webhook recebido da Focus NFe");
    
    // Captura o corpo bruto primeiro
    const rawBody = await req.text();
    console.log("📦 Corpo bruto recebido:", rawBody);
    
    // Headers da requisição
    const headers = Object.fromEntries(req.headers.entries());
    console.log("📋 Headers:", JSON.stringify(headers, null, 2));

    // Parse do JSON
    const webhookData = JSON.parse(rawBody);
    console.log("📄 Dados parseados:", JSON.stringify(webhookData, null, 2));

    // Extrai os campos conforme a estrutura da Focus NFe
    const ref = webhookData.ref;
    const status = webhookData.status;
    const numero = webhookData.numero;
    const codigoVerificacao = webhookData.codigo_verificacao;
    const dataEmissao = webhookData.data_emissao;
    
    // 🔍 LOG DETALHADO: Ver TODOS os campos relacionados a arquivos
    console.log("🔍 CAMPOS DE ARQUIVOS NO WEBHOOK:", {
      url: webhookData.url,
      url_danfse: webhookData.url_danfse,
      caminho_xml_nota_fiscal: webhookData.caminho_xml_nota_fiscal,
      caminho_danfse: webhookData.caminho_danfse,
      url_notificacao: webhookData.url_notificacao
    });
    
    console.log("🔍 Campos extraídos:", {
      ref,
      status,
      numero,
      codigoVerificacao,
      urlPdf,
      caminhoXml
    });

    // Verifica se tem erros ANTES de verificar o status
    let errorMessage = null;
    let errorCode = null;

    // Formatos possíveis de erro
    if (webhookData.erros && Array.isArray(webhookData.erros) && webhookData.erros.length > 0) {
      console.log("❌ Erros detectados (formato 1 - array direto):", webhookData.erros);
      errorMessage = webhookData.erros.map((erro: any) => {
        const codigo = erro.Codigo || erro.codigo || erro.code || '';
        const descricao = erro.Descricao || erro.descricao || erro.mensagem || erro.message || '';
        return codigo ? `[${codigo}] ${descricao}` : descricao;
      }).join('\n');
      errorCode = webhookData.erros[0].Codigo || webhookData.erros[0].codigo;
    } else if (webhookData.data?.erros && Array.isArray(webhookData.data.erros) && webhookData.data.erros.length > 0) {
      console.log("❌ Erros detectados (formato 2 - data.erros):", webhookData.data.erros);
      errorMessage = webhookData.data.erros.map((erro: any) => {
        const codigo = erro.Codigo || erro.codigo || erro.code || '';
        const descricao = erro.Descricao || erro.descricao || erro.mensagem || erro.message || '';
        return codigo ? `[${codigo}] ${descricao}` : descricao;
      }).join('\n');
      errorCode = webhookData.data.erros[0].Codigo || webhookData.data.erros[0].codigo;
    } else if (webhookData.mensagem_sefaz) {
      console.log("❌ Erro detectado (formato 3 - mensagem_sefaz):", webhookData.mensagem_sefaz);
      errorMessage = webhookData.mensagem_sefaz;
      errorCode = webhookData.codigo_erro || "ERRO_SEFAZ";
    } else if (webhookData.mensagem) {
      console.log("❌ Erro detectado (formato 4 - mensagem):", webhookData.mensagem);
      errorMessage = webhookData.mensagem;
      errorCode = webhookData.codigo_erro || "ERRO";
    } else if (webhookData.codigo_erro) {
      console.log("❌ Erro detectado (formato 5 - codigo_erro):", webhookData.codigo_erro);
      errorCode = webhookData.codigo_erro;
      errorMessage = webhookData.mensagem || "Erro ao processar NFS-e";
    } else if (webhookData.metadata?.response?.data?.erros) {
      console.log("❌ Erros detectados (formato 6 - metadata.response.data.erros):", webhookData.metadata.response.data.erros);
      const erros = webhookData.metadata.response.data.erros;
      if (Array.isArray(erros) && erros.length > 0) {
        errorMessage = erros.map((erro: any) => {
          const codigo = erro.Codigo || erro.codigo || '';
          const descricao = erro.Descricao || erro.descricao || '';
          return codigo ? `[${codigo}] ${descricao}` : descricao;
        }).join('\n');
        errorCode = erros[0].Codigo || erros[0].codigo;
      }
    }

    if (!ref) {
      console.error("❌ Referência não encontrada no webhook");
      return new Response(
        JSON.stringify({ error: "Referência não encontrada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Conecta ao Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 🔥 Buscar ambiente configurado (homologação ou produção)
    const { data: settings } = await supabase
      .from('system_settings')
      .select('focus_nfe_environment')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    
    const environment = settings?.focus_nfe_environment || 'homologacao';
    const focusBaseUrl = environment === 'production'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';

    console.log(`🔍 Buscando OS com invoice_reference: ${ref}`);

    // Busca a OS pela referência (campo correto: invoice_reference)
    const { data: serviceOrder, error: fetchError } = await supabase
      .from("service_orders")
      .select("*")
      .eq("invoice_reference", ref)
      .single();

    if (fetchError || !serviceOrder) {
      console.error("❌ OS não encontrada:", fetchError);
      return new Response(
        JSON.stringify({ error: "OS não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ OS encontrada:", serviceOrder.id);

    // Prepara os dados para atualização
    let updateData: any = {
      invoice_updated_at: new Date().toISOString(),
    };

    // Se encontrou erro, atualiza como erro
    if (errorMessage) {
      console.log("💾 Salvando erro no banco:", { errorCode, errorMessage });
      updateData.invoice_status = "erro_autorizacao";
      updateData.invoice_error = errorMessage;
      updateData.invoice_error_code = errorCode;
    }
    // Se o status é autorizado, salva os dados da nota
    else if (status === "autorizado") {
      console.log("💾 Salvando nota autorizada no banco");
      
      // 🔥 Construir URLs corretas usando os caminhos do webhook
      let urlPdf = '';
      let urlXml = '';
      
      // Helper para adicionar domínio se necessário
      const ensureFullUrl = (path: string | null | undefined, base: string): string => {
        if (!path) return '';
        if (path.startsWith('http://') || path.startsWith('https://')) return path;
        if (path.startsWith('/')) return `${base}${path}`;
        return `${base}/${path}`;
      };
      
      // PDF: Tentar url_danfse primeiro, senão usar caminho_danfse, senão construir
      if (webhookData.url_danfse) {
        urlPdf = ensureFullUrl(webhookData.url_danfse, focusBaseUrl);
      } else if (webhookData.caminho_danfse) {
        urlPdf = ensureFullUrl(webhookData.caminho_danfse, focusBaseUrl);
      } else {
        urlPdf = `${focusBaseUrl}/v2/nfse/${ref}.pdf`;
      }
      
      // XML: Usar caminho_xml_nota_fiscal e adicionar domínio se necessário
      if (webhookData.caminho_xml_nota_fiscal) {
        urlXml = ensureFullUrl(webhookData.caminho_xml_nota_fiscal, focusBaseUrl);
      } else {
        urlXml = `${focusBaseUrl}/v2/nfse/${ref}.xml`;
      }
      
      console.log("🔗 URLs construídas:", { 
        urlPdf, 
        urlXml,
        campos_recebidos: {
          url_danfse: webhookData.url_danfse,
          caminho_danfse: webhookData.caminho_danfse,
          caminho_xml_nota_fiscal: webhookData.caminho_xml_nota_fiscal
        }
      });
      
      updateData.invoice_status = "emitida";
      updateData.invoice_number = numero?.toString();
      updateData.invoice_verification_code = codigoVerificacao;
      updateData.invoice_reference = ref;
      updateData.invoice_pdf_url = urlPdf;
      updateData.invoice_xml_url = urlXml;
      updateData.invoice_key = codigoVerificacao;
      updateData.invoice_error = null;
      updateData.invoice_error_code = null;
      
      console.log("✅ Dados da nota que serão salvos:", {
        numero: numero,
        codigo_verificacao: codigoVerificacao,
        ref: ref,
        pdf_url: urlPdf,
        xml_url: urlXml,
        environment: environment
      });
    }
    // Se o status é erro_autorizacao ou rejeitado
    else if (status === "erro_autorizacao" || status === "rejeitado" || status === "cancelado") {
      console.log("💾 Salvando status de erro/rejeição no banco");
      updateData.invoice_status = "erro_autorizacao";
      updateData.invoice_error = errorMessage || `NFS-e ${status}`;
      updateData.invoice_error_code = errorCode || status.toUpperCase();
    }
    // Outros status (processando_autorizacao, etc)
    else {
      console.log("💾 Atualizando status:", status);
      updateData.invoice_status = status === "processando_autorizacao" ? "processando_autorizacao" : status;
    }

    console.log("💾 Dados que serão salvos:", JSON.stringify(updateData, null, 2));

    // Atualiza a OS
    const { data: updatedOrder, error: updateError } = await supabase
      .from("service_orders")
      .update(updateData)
      .eq("id", serviceOrder.id)
      .select()
      .single();

    if (updateError) {
      console.error("❌ Erro ao atualizar OS:", updateError);
      return new Response(
        JSON.stringify({ error: "Erro ao atualizar OS", details: updateError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ OS atualizada com sucesso:", updatedOrder);

    // Verifica se realmente salvou
    const { data: verifyOrder } = await supabase
      .from("service_orders")
      .select("invoice_status, invoice_error, invoice_error_code, invoice_number")
      .eq("id", serviceOrder.id)
      .single();

    console.log("🔍 Verificação após salvar:", verifyOrder);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Webhook processado com sucesso",
        status: updateData.invoice_status,
        ref: ref
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Erro ao processar webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});