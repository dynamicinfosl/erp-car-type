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
    const { token, environment } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, message: 'Token não informado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Define a URL base de acordo com o ambiente
    const baseUrl = environment === 'producao' 
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';

    // Testa a conexão fazendo uma requisição simples à API
    const response = await fetch(`${baseUrl}/v2/nfce?filtro=todos`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(token + ':')}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Token inválido. Verifique suas credenciais.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (response.status === 403) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Acesso negado. Verifique as permissões do token.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (!response.ok && response.status !== 404) {
      const errorData = await response.text();
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Erro na API Focus NFe: ${errorData}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Se chegou aqui, a conexão está OK (mesmo que retorne 404, significa que autenticou)
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Conexão estabelecida com sucesso! Ambiente: ${environment === 'producao' ? 'Produção' : 'Homologação'}`,
        environment: environment
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Erro ao testar conexão:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || 'Erro ao conectar com Focus NFe' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});