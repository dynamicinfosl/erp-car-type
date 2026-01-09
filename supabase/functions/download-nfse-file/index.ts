import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Ler dados do corpo da requisição POST
    const { fileType, ref } = await req.json();

    console.log('📥 Download solicitado:', { fileType, ref });

    if (!fileType || !ref) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros fileType e ref são obrigatórios' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Buscar configurações da empresa
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar token e environment para autenticação
    const { data: settings } = await supabase
      .from('system_settings')
      .select('focus_nfe_token, focus_nfe_environment')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (!settings || !settings.focus_nfe_token) {
      return new Response(
        JSON.stringify({ error: 'Token Focus NFe não configurado' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    const focusBaseUrl = settings.focus_nfe_environment === 'production'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';

    // Validar tipo
    if (fileType !== 'pdf' && fileType !== 'xml') {
      return new Response(
        JSON.stringify({ error: 'Tipo inválido. Use pdf ou xml' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    const token = settings.focus_nfe_token.trim();
    const authToken = btoa(`${token}:`);

    const ensureFullUrl = (pathOrUrl: string | null | undefined): string => {
      if (!pathOrUrl) return '';
      if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl;
      if (pathOrUrl.startsWith('/')) return `${focusBaseUrl}${pathOrUrl}`;
      return `${focusBaseUrl}/${pathOrUrl}`;
    };

    // 1) Consultar a NFS-e na Focus para obter URLs corretas (evita URL do portal do governo)
    const consultUrl = `${focusBaseUrl}/v2/nfse/${ref}`;
    console.log('🔎 Consultando NFS-e na Focus:', consultUrl);

    const consultResp = await fetch(consultUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authToken}`,
        'Accept': 'application/json',
      },
    });

    const consultText = await consultResp.text();
    let consultData: any = null;
    try {
      consultData = consultText ? JSON.parse(consultText) : null;
    } catch (_) {
      consultData = null;
    }

    if (!consultResp.ok) {
      console.error('❌ Erro ao consultar NFS-e:', consultResp.status, consultText);
      return new Response(
        JSON.stringify({
          error: 'Erro ao consultar NFS-e na Focus',
          status: consultResp.status,
          details: consultData || consultText,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!consultData || typeof consultData !== 'object') {
      console.error('❌ Resposta inválida ao consultar NFS-e:', consultText);
      return new Response(
        JSON.stringify({
          error: 'Resposta inválida ao consultar NFS-e na Focus',
          details: consultText?.slice?.(0, 500) ?? consultText,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const focusStatus = consultData.status || consultData?.data?.status;
    console.log('📌 Status na Focus:', focusStatus);

    // 2) Definir URL do arquivo a baixar
    let fileUrl = '';
    let contentType = '';
    let filename = '';

    if (fileType === 'pdf') {
      const urlDanfse = consultData.url_danfse || consultData?.data?.url_danfse || null;
      const caminhoDanfse = consultData.caminho_danfse || consultData?.data?.caminho_danfse || null;
      fileUrl = urlDanfse || ensureFullUrl(caminhoDanfse) || `${focusBaseUrl}/v2/nfse/${ref}.pdf`;
      contentType = 'application/pdf';
      filename = `NFSe-${ref}.pdf`;
    } else {
      const caminhoXml = consultData.caminho_xml_nota_fiscal || consultData?.data?.caminho_xml_nota_fiscal || null;
      fileUrl = ensureFullUrl(caminhoXml) || `${focusBaseUrl}/v2/nfse/${ref}.xml`;
      contentType = 'application/xml';
      filename = `NFSe-${ref}.xml`;
    }

    if (!fileUrl) {
      return new Response(
        JSON.stringify({
          error: 'Arquivo ainda não disponível na Focus (faltam URLs). Aguarde alguns minutos e tente novamente.',
          status: focusStatus,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
      );
    }

    console.log('🔗 URL final para download:', fileUrl);

    // 3) Baixar o arquivo
    // - Links da API Focus (/v2/...) exigem Basic Auth
    // - Links de armazenamento (ex: S3/amazonaws) NÃO aceitam Authorization: Basic e retornam UnsupportedAuthorizationType
    const downloadUrlObj = new URL(fileUrl);
    const focusHost = new URL(focusBaseUrl).host;
    const isFocusHost = downloadUrlObj.host === focusHost;
    const isAmazonS3 = downloadUrlObj.host.includes('amazonaws.com') || downloadUrlObj.host.includes('focusnfe.s3');
    const isFocusApiPath = isFocusHost && downloadUrlObj.pathname.startsWith('/v2/');

    const downloadHeaders: Record<string, string> = {
      'Accept': '*/*',
    };

    if (isFocusApiPath && !isAmazonS3) {
      downloadHeaders['Authorization'] = `Basic ${authToken}`;
    }

    console.log('🧾 Download headers:', {
      host: downloadUrlObj.host,
      path: downloadUrlObj.pathname,
      usingAuth: Boolean(downloadHeaders['Authorization']),
    });

    const response = await fetch(fileUrl, {
      method: 'GET',
      headers: downloadHeaders,
      redirect: 'follow',
    });

    console.log('📡 Status da Focus NFe:', response.status);
    console.log('📋 Content-Type da Focus NFe:', response.headers.get('content-type'));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro HTTP:', errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao baixar arquivo', details: errorText, fileUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: response.status }
      );
    }

    // ⚠️ IMPORTANTE: Ler o corpo apenas UMA vez
    const fileContent = await response.arrayBuffer();
    
    console.log('📦 Tamanho do arquivo:', fileContent.byteLength, 'bytes');

    // 🔍 Analisar apenas os primeiros 1000 bytes para otimização
    const preview = new TextDecoder().decode(fileContent.slice(0, 1000));
    console.log('🔍 Preview (primeiros 1000 bytes):', preview.substring(0, 200));
    
    // Verificar se é JSON (erro da API)
    const trimmedPreview = preview.trim();
    if (trimmedPreview.startsWith('{') || trimmedPreview.startsWith('[')) {
      try {
        const fullText = new TextDecoder().decode(fileContent);
        const errorData = JSON.parse(fullText);
        console.error('❌ Focus NFe retornou JSON (erro):', errorData);
        
        let errorMsg = 'Erro ao obter arquivo';
        if (errorData.mensagem) errorMsg = errorData.mensagem;
        else if (errorData.erro) errorMsg = errorData.erro;
        else if (errorData.erros && Array.isArray(errorData.erros)) {
          errorMsg = errorData.erros.map((e: any) => e.mensagem || e.descricao || e).join(', ');
        }
        
        return new Response(
          JSON.stringify({ error: errorMsg, details: errorData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      } catch (e) {
        // Não é JSON válido, continuar
      }
    }
    
    // Verificar se é HTML (erro comum)
    const lowerPreview = trimmedPreview.toLowerCase();
    if (lowerPreview.includes('<!doctype html') || lowerPreview.includes('<html')) {
      console.error('❌ Arquivo é HTML!');
      return new Response(
        JSON.stringify({ 
          error: 'A Focus NFe retornou HTML. Possíveis causas:\n1. A nota ainda está sendo processada\n2. A URL está incorreta\n3. Problema de autenticação',
          fileUrl,
          preview: preview.substring(0, 200)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verificar tamanho mínimo
    if (fileContent.byteLength < 100) {
      console.error('⚠️ Arquivo muito pequeno:', fileContent.byteLength, 'bytes');
      return new Response(
        JSON.stringify({ 
          error: 'Arquivo vazio ou corrompido',
          size: fileContent.byteLength,
          preview: preview
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('✅ Arquivo válido:', filename, `(${fileContent.byteLength} bytes)`);

    return new Response(fileContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

