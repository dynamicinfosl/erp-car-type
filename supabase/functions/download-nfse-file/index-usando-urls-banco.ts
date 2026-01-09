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

    // 🔥 BUSCAR AS URLs SALVAS NO BANCO (enviadas pelo webhook)
    const { data: order, error: orderError } = await supabase
      .from('service_orders')
      .select('invoice_pdf_url, invoice_xml_url, invoice_reference')
      .eq('invoice_reference', ref)
      .single();

    if (orderError || !order) {
      console.error('❌ Ordem não encontrada:', orderError);
      return new Response(
        JSON.stringify({ error: 'Ordem de serviço não encontrada' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      );
    }

    console.log('📋 URLs no banco:', {
      pdf: order.invoice_pdf_url,
      xml: order.invoice_xml_url
    });

    // Buscar token para autenticação
    const { data: settings } = await supabase
      .from('system_settings')
      .select('focus_nfe_token')
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

    // Selecionar URL correta baseada no tipo
    let fileUrl = '';
    let contentType = '';
    let filename = '';

    if (fileType === 'pdf') {
      fileUrl = order.invoice_pdf_url;
      contentType = 'application/pdf';
      filename = `NFSe-${ref}.pdf`;
      
      if (!fileUrl) {
        return new Response(
          JSON.stringify({ error: 'URL do PDF não encontrada. A nota pode não ter sido autorizada ainda.' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404 
          }
        );
      }
    } else if (fileType === 'xml') {
      fileUrl = order.invoice_xml_url;
      contentType = 'application/xml';
      filename = `NFSe-${ref}.xml`;
      
      if (!fileUrl) {
        return new Response(
          JSON.stringify({ error: 'URL do XML não encontrada. A nota pode não ter sido autorizada ainda.' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404 
          }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Tipo inválido. Use pdf ou xml' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    console.log('🔗 Baixando arquivo de:', fileUrl);

    // Fazer requisição autenticada para Focus NFe
    const token = settings.focus_nfe_token.trim();
    const authToken = btoa(`${token}:`);

    const response = await fetch(fileUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authToken}`,
      },
    });

    console.log('📡 Status da Focus NFe:', response.status);
    console.log('📋 Content-Type da Focus NFe:', response.headers.get('content-type'));

    // Verificar o Content-Type da resposta
    const responseContentType = response.headers.get('content-type') || '';
    
    // Se a Focus NFe retornou JSON, é um erro (mesmo com status 200!)
    if (responseContentType.includes('application/json')) {
      const errorData = await response.json();
      console.error('❌ Focus NFe retornou erro:', errorData);
      
      let errorMsg = 'Arquivo ainda não disponível';
      if (errorData.mensagem) {
        errorMsg = errorData.mensagem;
      } else if (errorData.erro) {
        errorMsg = errorData.erro;
      } else if (errorData.erros && Array.isArray(errorData.erros)) {
        errorMsg = errorData.erros.map((e: any) => e.mensagem || e.descricao || e).join(', ');
      } else if (errorData.status === 'processando_autorizacao') {
        errorMsg = 'A nota ainda está sendo processada. Aguarde alguns minutos.';
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMsg,
          details: errorData 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro HTTP ao baixar arquivo:', errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao baixar arquivo da Focus NFe',
          details: errorText,
          status: response.status
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: response.status 
        }
      );
    }

    // Retornar arquivo com headers corretos para forçar download
    const fileContent = await response.arrayBuffer();
    
    console.log('📦 Tamanho do arquivo:', fileContent.byteLength, 'bytes');

    // Verificar se o arquivo não está vazio
    if (fileContent.byteLength < 100) {
      console.error('⚠️ Arquivo muito pequeno, pode ser um erro');
      
      // Tentar fazer parse como JSON para ver se é um erro
      try {
        const text = new TextDecoder().decode(fileContent);
        const possibleError = JSON.parse(text);
        console.error('❌ Conteúdo do arquivo pequeno:', possibleError);
        
        return new Response(
          JSON.stringify({ 
            error: 'Arquivo não disponível ou corrompido',
            details: possibleError
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        );
      } catch (e) {
        // Não é JSON, apenas pequeno demais
        return new Response(
          JSON.stringify({ 
            error: 'Arquivo baixado está vazio ou corrompido',
            size: fileContent.byteLength 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        );
      }
    }

    console.log('✅ Arquivo baixado com sucesso:', filename, `(${fileContent.byteLength} bytes)`);

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

