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
    console.log('🚀 ===== INÍCIO DA REQUISIÇÃO =====');
    console.log('🚀 Método:', req.method);
    console.log('🚀 URL:', req.url);
    
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('📦 Body recebido:', JSON.stringify(requestBody, null, 2));
    } catch (parseError) {
      console.error('❌ ERRO AO PARSEAR JSON DO BODY:', parseError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Corpo da requisição inválido. Esperado JSON válido.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const { serviceOrderId } = requestBody;

    console.log('🔍 Service Order ID recebido:', serviceOrderId);

    if (!serviceOrderId) {
      console.error('❌ VALIDAÇÃO FALHOU: ID da ordem de serviço não fornecido');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'ID da ordem de serviço é obrigatório',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Inicializar Supabase
    console.log('🔧 Inicializando Supabase...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ ERRO: Variáveis de ambiente do Supabase não configuradas');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Erro de configuração do servidor',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase inicializado');

    // Buscar configurações fiscais
    console.log('📋 Buscando configurações fiscais...');
    const { data: settingsList, error: settingsError } = await supabase
      .from('system_settings')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1);

    if (settingsError) {
      console.error('❌ ERRO AO BUSCAR CONFIGURAÇÕES:', JSON.stringify(settingsError, null, 2));
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro ao buscar configurações: ${settingsError.message}`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const settings = settingsList?.[0];

    if (!settings) {
      console.error('❌ VALIDAÇÃO FALHOU: Configurações não encontradas');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Configurações fiscais não encontradas. Configure em Configurações > Empresa.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log('✅ Configurações encontradas:', {
      id: settings.id,
      company_name: settings.company_name,
      cnpj: settings.cnpj ? '***' : 'NÃO CONFIGURADO',
      city_code: settings.city_code || 'NÃO CONFIGURADO',
      focus_nfe_token: settings.focus_nfe_token ? '***' : 'NÃO CONFIGURADO',
      focus_nfe_environment: settings.focus_nfe_environment || 'homologacao',
      optante_simples_nacional: settings.optante_simples_nacional,
      regime_especial_tributacao: settings.regime_especial_tributacao,
      incentivo_fiscal: settings.incentivo_fiscal,
    });

    // Validar token Focus NFe
    if (!settings.focus_nfe_token || settings.focus_nfe_token.trim() === '') {
      console.error('❌ VALIDAÇÃO FALHOU: Token Focus NFe não configurado');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Token da Focus NFe não configurado. Configure em Configurações > Empresa > Configurações Fiscais.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log('✅ Token Focus NFe encontrado');

    // Validar configurações obrigatórias para NFS-e
    const missingFields = [];
    if (!settings.cnpj) missingFields.push('CNPJ');
    if (!settings.company_name) missingFields.push('Razão Social');
    if (!settings.city_code || settings.city_code.trim() === '') {
      missingFields.push('Código do Município (IBGE)');
    }
    if (!settings.address) missingFields.push('Endereço');
    if (!settings.city) missingFields.push('Cidade');
    if (!settings.state) missingFields.push('Estado');

    if (missingFields.length > 0) {
      const errorMsg = `Campos obrigatórios não configurados:\n\n${missingFields.map(f => `• ${f}`).join('\n')}\n\nConfigure em: Configurações > Empresa > Configurações Fiscais`;
      console.error('❌ VALIDAÇÃO FALHOU: Campos obrigatórios faltando:', missingFields);
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMsg,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log('✅ Configurações validadas');

    // Buscar dados da ordem de serviço
    console.log('📋 Buscando ordem de serviço:', serviceOrderId);
    const { data: order, error: orderError } = await supabase
      .from('service_orders')
      .select(`
        *,
        customer:customers(*),
        vehicle:vehicles(*)
      `)
      .eq('id', serviceOrderId)
      .single();

    if (orderError) {
      console.error('❌ ERRO AO BUSCAR ORDEM:', JSON.stringify(orderError, null, 2));
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro ao buscar ordem: ${orderError.message}`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    if (!order) {
      console.error('❌ VALIDAÇÃO FALHOU: Ordem não encontrada');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Ordem de serviço não encontrada',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log('✅ Ordem encontrada:', {
      id: order.id,
      customer_id: order.customer_id,
      total_amount: order.total_amount,
      final_amount: order.final_amount,
    });

    // Validar dados do cliente
    if (!order.customer) {
      console.error('❌ VALIDAÇÃO FALHOU: Cliente não encontrado na ordem');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Cliente não encontrado na ordem de serviço',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log('✅ Cliente encontrado:', {
      id: order.customer.id,
      name: order.customer.name,
      cpf: order.customer.cpf ? '***' : 'NÃO CONFIGURADO',
      cnpj: order.customer.cnpj ? '***' : 'NÃO CONFIGURADO',
    });

    if (!order.customer.cpf && !order.customer.cnpj) {
      console.error('❌ VALIDAÇÃO FALHOU: Cliente sem CPF/CNPJ');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Cliente precisa ter CPF ou CNPJ cadastrado para emitir NFS-e',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    if (!order.customer.name) {
      console.error('❌ VALIDAÇÃO FALHOU: Cliente sem nome');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Cliente precisa ter nome cadastrado',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Buscar itens da ordem
    console.log('📋 Buscando itens da ordem...');
    const { data: items, error: itemsError } = await supabase
      .from('service_order_items')
      .select('*')
      .eq('service_order_id', serviceOrderId);

    if (itemsError) {
      console.error('❌ ERRO AO BUSCAR ITENS:', JSON.stringify(itemsError, null, 2));
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro ao buscar itens: ${itemsError.message}`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    if (!items || items.length === 0) {
      console.error('❌ VALIDAÇÃO FALHOU: Nenhum item encontrado');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Nenhum item encontrado na ordem de serviço',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log('✅ Itens encontrados:', items.length);
    console.log('📦 Tipos de itens:', items.map(i => ({ type: i.item_type, service_id: i.service_id })));

    // Filtrar apenas serviços
    const serviceItems = items.filter(item => item.item_type === 'service' && item.service_id);

    if (serviceItems.length === 0) {
      console.error('❌ VALIDAÇÃO FALHOU: Nenhum serviço encontrado');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Esta ordem não possui serviços para emitir NFS-e. Apenas serviços podem ser incluídos na NFS-e.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log('✅ Serviços encontrados:', serviceItems.length);

    // Buscar dados dos serviços
    const serviceIds = serviceItems.map(item => item.service_id);
    console.log('🔍 Buscando dados dos serviços:', serviceIds);
    
    const { data: servicesData, error: servicesError } = await supabase
      .from('services')
      .select('*')
      .in('id', serviceIds);

    if (servicesError) {
      console.error('❌ ERRO AO BUSCAR SERVIÇOS:', JSON.stringify(servicesError, null, 2));
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro ao buscar dados dos serviços: ${servicesError.message}`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log('✅ Dados dos serviços carregados:', servicesData?.length);
    console.log('📦 Serviços:', servicesData?.map(s => ({
      id: s.id,
      name: s.name,
      codigo_servico_municipal: s.codigo_servico_municipal,
      nbs_code: s.nbs_code,
      isento_nfe: s.isento_nfe,
    })));

    // 🔥 VALIDAÇÃO CRÍTICA: Verificar se todos os serviços têm código municipal válido
    console.log('🔍 Validando códigos fiscais dos serviços...');
    
    for (const item of serviceItems) {
      const service = servicesData?.find(s => s.id === item.service_id);
      
      if (!service) {
        console.error('❌ Serviço não encontrado:', item.service_id);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Serviço não encontrado: ${item.description}`,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }

      // Só valida se não for isento
      if (!service.isento_nfe) {
        const codigoLimpo = (service.codigo_servico_municipal || '').toString().replace(/\D/g, '');
        
        console.log(`🔍 Validando serviço "${service.name}":`, {
          codigo_original: service.codigo_servico_municipal,
          codigo_limpo: codigoLimpo,
          tamanho: codigoLimpo.length,
        });
        
        if (!codigoLimpo || codigoLimpo.length < 4) {
          console.error('❌ VALIDAÇÃO FALHOU: Código de serviço inválido');
          return new Response(
            JSON.stringify({
              success: false,
              error: `Serviço "${service.name}" possui código fiscal inválido.\n\nO código deve ter pelo menos 4 dígitos numéricos (ex: 0101, 010101).\n\nCódigo atual: "${service.codigo_servico_municipal || 'não informado'}"\n\nConfigure em: Serviços > Editar Serviço > Dados Fiscais`,
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            }
          );
        }

        // Validar código NBS
        const nbsLimpo = (service.nbs_code || '').toString().replace(/\D/g, '');
        
        console.log(`🔍 Validando NBS do serviço "${service.name}":`, {
          nbs_original: service.nbs_code,
          nbs_limpo: nbsLimpo,
          tamanho: nbsLimpo.length,
        });
        
        if (!nbsLimpo || nbsLimpo.length < 7 || nbsLimpo.length > 9) {
          console.error('❌ VALIDAÇÃO FALHOU: Código NBS inválido');
          return new Response(
            JSON.stringify({
              success: false,
              error: `Serviço "${service.name}" possui código NBS inválido.\n\nO código deve ter entre 7 e 9 dígitos numéricos (ex: 1160101, 116010100).\n\nCódigo atual: "${service.nbs_code || 'não informado'}"\n\nConfigure em: Serviços > Editar Serviço > Dados Fiscais`,
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            }
          );
        }
      }
    }

    console.log('✅ Todos os serviços têm códigos fiscais válidos');

    // Calcular valores
    const totalAmount = parseFloat(order.final_amount || order.total_amount) || 0;
    const discount = parseFloat(order.discount) || 0;

    console.log('💰 Valores calculados:', {
      total: totalAmount,
      desconto: discount,
    });

    // Preparar descrição dos serviços
    let descricaoServicos = serviceItems.map((item: any, index: number) => {
      const service = servicesData?.find(s => s.id === item.service_id);
      const quantidade = parseFloat(item.quantity) || 1;
      const valorUnitario = parseFloat(item.unit_price) || 0;
      const valorTotal = quantidade * valorUnitario;
      
      return `${index + 1}. ${item.description || service?.name || 'Serviço'} - Qtd: ${quantidade} - Valor: R$ ${valorTotal.toFixed(2)}`;
    }).join('\n');

    // Adicionar informações do veículo
    if (order.vehicle) {
      descricaoServicos += `\n\nVeículo: ${order.vehicle.model || ''} - Placa: ${order.vehicle.plate || ''}`;
    }

    // Pegar o primeiro serviço para usar os códigos
    const firstService = servicesData?.find(s => s.id === serviceItems[0].service_id);
    
    if (!firstService) {
      console.error('❌ VALIDAÇÃO FALHOU: Dados do serviço não encontrados');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Dados do serviço não encontrados',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log('🔍 Primeiro serviço:', {
      id: firstService.id,
      name: firstService.name,
      codigo_servico_municipal: firstService.codigo_servico_municipal,
      nbs_code: firstService.nbs_code,
      cnae_code: firstService.cnae_code,
      issqn_aliquota: firstService.issqn_aliquota,
    });
    
    // 🔥 CORREÇÃO: Garantir que o código tenha EXATAMENTE 6 dígitos
    const codigoServicoCompleto = (firstService.codigo_servico_municipal || '').toString().replace(/\D/g, '');
    
    let codigoServico = codigoServicoCompleto;
    
    // Se tiver menos de 6 dígitos, completar com zeros à direita
    if (codigoServico.length < 6) {
      codigoServico = codigoServico.padEnd(6, '0');
      console.log(`✅ Código ajustado de ${codigoServicoCompleto.length} para 6 dígitos: ${codigoServicoCompleto} → ${codigoServico}`);
    } 
    // Se tiver mais de 6 dígitos, pegar apenas os primeiros 6
    else if (codigoServico.length > 6) {
      codigoServico = codigoServico.substring(0, 6);
      console.log(`✅ Código truncado de ${codigoServicoCompleto.length} para 6 dígitos: ${codigoServicoCompleto} → ${codigoServico}`);
    } else {
      console.log(`✅ Código já tem 6 dígitos: ${codigoServico}`);
    }
    
    console.log('✅ Código final (item_lista_servico):', codigoServico, '- Tamanho:', codigoServico.length, 'dígitos');
    
    // 🔥 CORREÇÃO E0160: Ajustar código NBS para serviço de manutenção automotiva
    // Código NBS correto para manutenção automotiva: 116010100 (9 dígitos)
    let codigoNBSFinal = (firstService.nbs_code || '').toString().replace(/\D/g, '');
    
    console.log('🔍 ===== VALIDANDO CÓDIGO NBS =====');
    console.log('📋 Código NBS original:', codigoNBSFinal);
    
    // Se o código NBS não for válido ou não tiver 9 dígitos, usar o padrão
    if (!codigoNBSFinal || codigoNBSFinal.length < 7 || codigoNBSFinal.length > 9) {
      codigoNBSFinal = '116010100'; // Código padrão para manutenção automotiva (9 dígitos)
      console.log('⚠️ Código NBS inválido ou não informado');
      console.log('✅ Usando código NBS padrão para manutenção automotiva:', codigoNBSFinal);
    } else if (codigoNBSFinal.length === 7) {
      // Se tiver 7 dígitos, completar com zeros à direita para ter 9 dígitos
      codigoNBSFinal = codigoNBSFinal.padEnd(9, '0');
      console.log('✅ Código NBS ajustado de 7 para 9 dígitos:', codigoNBSFinal);
    } else if (codigoNBSFinal.length === 8) {
      // Se tiver 8 dígitos, completar com zero à direita para ter 9 dígitos
      codigoNBSFinal = codigoNBSFinal.padEnd(9, '0');
      console.log('✅ Código NBS ajustado de 8 para 9 dígitos:', codigoNBSFinal);
    } else {
      console.log('✅ Código NBS válido:', codigoNBSFinal);
    }
    
    console.log('✅ Código NBS final:', codigoNBSFinal);
    console.log('===== FIM DA VALIDAÇÃO NBS =====');
    
    const aliquotaIss = parseFloat(firstService.issqn_aliquota || '0');
    const valorIss = aliquotaIss > 0 ? (totalAmount * (aliquotaIss / 100)) : 0;

    console.log('💰 ISS calculado:', {
      aliquota: aliquotaIss,
      valor: valorIss,
    });

    // Gerar referência única
    const timestamp = Date.now();
    const ref = `OS${order.id.slice(0, 8).toUpperCase()}${timestamp}`;

    console.log('🔖 Referência gerada:', ref);

    // Limpar telefone
    const cleanPhone = (phone: string) => {
      if (!phone) return '';
      return phone.replace(/\D/g, '').substring(0, 11);
    };

    // Data de emissão
    const dataEmissao = new Date().toISOString().split('T')[0];

    // Determinar regime tributário
    const optanteSimplesNacional = settings.optante_simples_nacional === true;
    const regimeEspecialTributacao = parseInt(settings.regime_especial_tributacao) || 0;
    const incentivoFiscal = settings.incentivo_fiscal === true;

    console.log('🏢 REGIME TRIBUTÁRIO CONFIGURADO:', {
      optante_simples_nacional: optanteSimplesNacional,
      regime_especial_tributacao: regimeEspecialTributacao,
      incentivo_fiscal: incentivoFiscal,
    });

    // 🔥 CORREÇÃO E0160: Determinar retenção do ISS corretamente
    // Regras da NFSe Nacional do Rio de Janeiro:
    // 1. Simples Nacional com tomador CPF → ISS NÃO retido (false)
    // 2. Simples Nacional com tomador CNPJ → ISS NÃO retido (false) - salvo substituição tributária
    // 3. Regime Normal → ISS NÃO retido (false) por padrão
    
    let issRetido = false; // Padrão: ISS NÃO retido
    
    console.log('🔍 ===== DETERMINANDO RETENÇÃO DO ISS (NFSe Nacional RJ) =====');
    console.log('📋 Dados do tomador:', {
      cpf: order.customer.cpf ? 'SIM' : 'NÃO',
      cnpj: order.customer.cnpj ? 'SIM' : 'NÃO',
    });
    
    if (optanteSimplesNacional) {
      console.log('✅ Empresa é SIMPLES NACIONAL');
      
      // Simples Nacional: ISS NUNCA é retido quando tomador é pessoa física (CPF)
      if (order.customer.cpf) {
        issRetido = false;
        console.log('✅ ISS NÃO retido: Simples Nacional + Tomador CPF');
        console.log('📋 Motivo: ISS recolhido via DAS pelo prestador');
        console.log('📋 Regra NFSe Nacional RJ: tpRetISSQN = 2 (NÃO retido)');
      } else if (order.customer.cnpj) {
        // Para CNPJ, só retém se for substituto tributário (configuração futura)
        // Por enquanto, mantém como NÃO retido
        issRetido = false;
        console.log('✅ ISS NÃO retido: Simples Nacional + Tomador CNPJ (sem substituição)');
        console.log('📋 Motivo: Não há configuração de substituição tributária');
        console.log('📋 Regra NFSe Nacional RJ: tpRetISSQN = 2 (NÃO retido)');
      }
    } else {
      console.log('✅ Empresa é REGIME NORMAL');
      // Regime Normal: seguir regras do município
      // Por padrão, ISS NÃO retido (pode ser configurado futuramente)
      issRetido = false;
      console.log('✅ ISS NÃO retido: Regime Normal (padrão)');
      console.log('📋 Regra NFSe Nacional RJ: tpRetISSQN = 2 (NÃO retido)');
    }
    
    console.log('🎯 DECISÃO FINAL: iss_retido =', issRetido ? 'true' : 'false');
    console.log('🎯 DECISÃO FINAL: indicador_issqn_retido =', issRetido ? '1' : '2');
    console.log('===== FIM DA DETERMINAÇÃO =====');

    // Preparar dados da NFS-e seguindo EXATAMENTE o padrão da Focus NFe
    const nfseData: any = {
      data_emissao: dataEmissao,
      
      prestador: {
        cnpj: settings.cnpj.replace(/\D/g, ''),
        codigo_municipio: settings.city_code || '',
        optante_simples_nacional: optanteSimplesNacional,
        incentivo_fiscal: incentivoFiscal,
      },
      
      tomador: {
        razao_social: order.customer.name.substring(0, 115),
      },
      
      servico: {
        item_lista_servico: codigoServico,
        discriminacao: descricaoServicos.substring(0, 2000),
        valor_servicos: parseFloat(totalAmount.toFixed(2)),
        iss_retido: issRetido ? "true" : "false",
        aliquota: parseFloat(aliquotaIss.toFixed(2)),
      },
    };

    console.log('✅ Estrutura base da NFS-e criada');
    console.log('✅ Campo iss_retido definido:', nfseData.servico.iss_retido);

    // 🔥 CORREÇÃO E0160: Para Simples Nacional, NÃO enviar regime_especial_tributacao
    // A NFSe Nacional do Rio de Janeiro rejeita quando:
    // - opSimpNac = 1 (Simples Nacional)
    // - regEspTrib é enviado (qualquer valor)
    // Solução: Apenas enviar optante_simples_nacional = true, SEM enviar regime_especial_tributacao
    if (optanteSimplesNacional) {
      // ✅ Para Simples Nacional, NÃO enviar regime_especial_tributacao
      // Apenas optante_simples_nacional = true já é suficiente
      console.log('✅ Simples Nacional: NÃO enviando regime_especial_tributacao');
      console.log('✅ Apenas optante_simples_nacional = true será enviado');
      console.log('📋 Regra NFSe Nacional RJ: opSimpNac = 1, regEspTrib = 0 (não enviar)');
    } else if (regimeEspecialTributacao >= 1 && regimeEspecialTributacao <= 6) {
      // Se NÃO for Simples Nacional, só adiciona se tiver um valor válido (1-6)
      nfseData.prestador.regime_especial_tributacao = regimeEspecialTributacao;
      console.log('✅ Regime especial de tributação adicionado:', regimeEspecialTributacao);
    } else {
      console.log('⚠️ Regime especial de tributação NÃO será enviado (valor inválido ou 0)');
    }

    console.log('✅ Campos fiscais OBRIGATÓRIOS adicionados ao prestador');

    // Adicionar Inscrição Municipal se disponível
    if (settings.inscricao_municipal && settings.inscricao_municipal.trim() !== '') {
      const inscricaoLimpa = settings.inscricao_municipal.replace(/\D/g, '');
      if (inscricaoLimpa.length > 0) {
        nfseData.prestador.inscricao_municipal = inscricaoLimpa;
        console.log('✅ Inscrição Municipal adicionada');
      }
    }

    // 🔥 CORREÇÃO E0160: Adicionar código NBS (obrigatório para NFSe Nacional RJ)
    nfseData.servico.codigo_nbs = codigoNBSFinal;
    console.log('✅ Código NBS adicionado ao payload:', codigoNBSFinal);

    // Adicionar CNAE se disponível
    if (firstService.cnae_code) {
      const cnaeLimpo = firstService.cnae_code.replace(/\D/g, '');
      if (cnaeLimpo.length === 7) {
        nfseData.servico.codigo_cnae = cnaeLimpo;
        console.log('✅ CNAE adicionado');
      }
    }

    // Adicionar valor do ISS se houver
    if (valorIss > 0) {
      nfseData.servico.valor_iss = parseFloat(valorIss.toFixed(2));
      console.log('✅ Valor ISS adicionado:', valorIss.toFixed(2));
    }

    // 🔥 CORREÇÃO E0160: Adicionar campo indicador_issqn_retido explicitamente
    // Este campo é OBRIGATÓRIO para NFSe Nacional do Rio de Janeiro
    // Valores: 1 = ISS retido (tpRetISSQN = 1), 2 = ISS NÃO retido (tpRetISSQN = 2)
    const indISSQNRetido = issRetido ? 1 : 2;
    nfseData.servico.indicador_issqn_retido = indISSQNRetido;
    console.log('✅ Campo indicador_issqn_retido adicionado:', indISSQNRetido, issRetido ? '(ISS retido - tpRetISSQN=1)' : '(ISS NÃO retido - tpRetISSQN=2)');
    console.log('📋 Regra NFSe Nacional RJ: indISSQNRetido é OBRIGATÓRIO');

    // Adicionar CPF ou CNPJ do tomador
    if (order.customer.cnpj) {
      nfseData.tomador.cnpj = order.customer.cnpj.replace(/\D/g, '');
    } else if (order.customer.cpf) {
      nfseData.tomador.cpf = order.customer.cpf.replace(/\D/g, '');
    }

    // Adicionar endereço do tomador se disponível
    if (order.customer.address && order.customer.city && order.customer.state) {
      nfseData.tomador.endereco = {
        logradouro: order.customer.address.substring(0, 125),
        numero: 'SN',
        bairro: (order.customer.city || 'Centro').substring(0, 60),
        codigo_municipio: order.customer.city_code || settings.city_code || '',
        uf: (order.customer.state || settings.state).toUpperCase().substring(0, 2),
      };
      
      if (order.customer.zip_code) {
        const cepLimpo = order.customer.zip_code.replace(/\D/g, '');
        if (cepLimpo.length === 8) {
          nfseData.tomador.endereco.cep = cepLimpo;
        }
      }
    }

    // Adicionar contato
    if (order.customer.phone) {
      const telefone = cleanPhone(order.customer.phone);
      if (telefone.length >= 10) {
        nfseData.tomador.telefone = telefone;
      }
    }
    
    if (order.customer.email) {
      nfseData.tomador.email = order.customer.email.substring(0, 80);
    }

    // Adicionar desconto se houver
    if (discount > 0) {
      nfseData.servico.valor_deducoes = parseFloat(discount.toFixed(2));
    }

    console.log('📤 ===== JSON COMPLETO QUE SERÁ ENVIADO PARA FOCUS NFE =====');
    console.log(JSON.stringify(nfseData, null, 2));
    console.log('📤 ===== RESUMO DAS CORREÇÕES E0160 =====');
    console.log('✅ 1. ISS NÃO retido: iss_retido = "false"');
    console.log('✅ 2. Indicador ISSQN: indicador_issqn_retido = 2 (tpRetISSQN = 2)');
    console.log('✅ 3. Simples Nacional: optante_simples_nacional = true, SEM regime_especial_tributacao');
    console.log('✅ 4. Código NBS: codigo_nbs =', codigoNBSFinal, '(manutenção automotiva - 9 dígitos)');
    console.log('✅ 5. Código Serviço: item_lista_servico =', codigoServico, '(6 dígitos)');
    console.log('📤 ===== FIM DO JSON =====');

    // Salvar status inicial "processando"
    console.log('💾 Salvando status inicial: processando');
    const { error: initialUpdateError } = await supabase
      .from('service_orders')
      .update({
        invoice_status: 'processando',
        invoice_reference: ref,
        invoice_updated_at: new Date().toISOString(),
        invoice_error: null,
        invoice_error_code: null,
        invoice_number: null,
        invoice_verification_code: null,
        invoice_pdf_url: null,
        invoice_xml_url: null,
      })
      .eq('id', serviceOrderId);

    if (initialUpdateError) {
      console.error('⚠️ Erro ao salvar status inicial:', JSON.stringify(initialUpdateError, null, 2));
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Erro ao salvar status inicial no banco de dados',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log('✅ Status inicial salvo com sucesso');

    const focusUrl = settings.focus_nfe_environment === 'production'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';

    console.log('🌐 Ambiente:', settings.focus_nfe_environment || 'homologacao');
    console.log('🔗 URL completa:', `${focusUrl}/v2/nfse?ref=${ref}`);

    // Enviar para Focus NFe
    const token = settings.focus_nfe_token.trim();
    const authToken = btoa(`${token}:`);
    
    console.log('🔐 Preparando autenticação...');
    console.log('🔐 Token (primeiros 10 caracteres):', token.substring(0, 10) + '...');
    console.log('🔐 Tamanho do token:', token.length, 'caracteres');
    
    let response;
    try {
      console.log('📤 ===== ENVIANDO REQUISIÇÃO PARA FOCUS NFE =====');
      
      response = await fetch(`${focusUrl}/v2/nfse?ref=${ref}`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(nfseData),
      });
      
      console.log('📥 ===== RESPOSTA RECEBIDA DA FOCUS NFE =====');
      console.log('📥 Status HTTP:', response.status);
      console.log('📥 Status Text:', response.statusText);
      console.log('📥 Headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
      
    } catch (fetchError: any) {
      console.error('❌ ===== ERRO NA REQUISIÇÃO HTTP =====');
      console.error('❌ Tipo do erro:', fetchError.constructor.name);
      console.error('❌ Mensagem:', fetchError.message);
      console.error('❌ Stack:', fetchError.stack);
      
      const errorMsg = `Erro ao conectar com a Focus NFe: ${fetchError.message}`;
      
      await supabase
        .from('service_orders')
        .update({
          invoice_status: 'erro',
          invoice_error: errorMsg,
          invoice_updated_at: new Date().toISOString(),
        })
        .eq('id', serviceOrderId);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMsg,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const responseText = await response.text();
    console.log('📥 ===== CORPO DA RESPOSTA (RAW) =====');
    console.log(responseText);
    console.log('📥 ===== FIM DO CORPO DA RESPOSTA =====');

    let result: any;
    try {
      result = JSON.parse(responseText);
      console.log('📥 ===== RESPOSTA PARSEADA (JSON) =====');
      console.log(JSON.stringify(result, null, 2));
      console.log('📥 ===== FIM DA RESPOSTA PARSEADA =====');
    } catch (parseError) {
      console.error('❌ Erro ao parsear JSON:', parseError);
      
      const errorMsg = `Erro ao processar resposta: ${responseText.substring(0, 500)}`;
      
      await supabase
        .from('service_orders')
        .update({
          invoice_status: 'erro',
          invoice_error: errorMsg,
          invoice_updated_at: new Date().toISOString(),
        })
        .eq('id', serviceOrderId);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMsg,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Extrair erros
    let errorMessage = '';
    let errorCode = '';
    
    console.log('🔍 ===== VERIFICANDO SE HÁ ERROS NA RESPOSTA =====');
    
    // Formato 1: metadata.response.data.erros
    if (result.metadata?.response?.data?.erros && Array.isArray(result.metadata.response.data.erros)) {
      console.log('❌ Formato 1 detectado: metadata.response.data.erros');
      const erros = result.metadata.response.data.erros;
      errorMessage = erros.map((e: any) => {
        const codigo = e.Codigo || e.codigo || '';
        const descricao = e.Descricao || e.descricao || e.mensagem || '';
        return codigo ? `[${codigo}] ${descricao}` : descricao;
      }).join('\n');
      errorCode = erros[0]?.Codigo || erros[0]?.codigo || '';
    }
    // Formato 2: data.erros
    else if (result.data?.erros && Array.isArray(result.data.erros)) {
      console.log('❌ Formato 2 detectado: data.erros');
      errorMessage = result.data.erros.map((e: any) => {
        const codigo = e.Codigo || e.codigo || '';
        const descricao = e.Descricao || e.descricao || e.mensagem || '';
        return codigo ? `[${codigo}] ${descricao}` : descricao;
      }).join('\n');
      errorCode = result.data.erros[0]?.Codigo || result.data.erros[0]?.codigo || '';
    }
    // Formato 3: erros direto
    else if (result.erros && Array.isArray(result.erros)) {
      console.log('❌ Formato 3 detectado: erros direto');
      errorMessage = result.erros.map((e: any) => {
        if (typeof e === 'string') return e;
        const codigo = e.Codigo || e.codigo || '';
        const descricao = e.Descricao || e.descricao || e.mensagem || '';
        return codigo ? `[${codigo}] ${descricao}` : descricao;
      }).join('\n');
      errorCode = result.erros[0]?.Codigo || result.erros[0]?.codigo || '';
    }
    // Formato 4: mensagem_sefaz
    else if (result.mensagem_sefaz) {
      console.log('❌ Formato 4 detectado: mensagem_sefaz');
      errorMessage = result.mensagem_sefaz;
      errorCode = result.codigo_erro || 'ERRO_SEFAZ';
    }
    // Formato 5: mensagem
    else if (result.mensagem) {
      console.log('❌ Formato 5 detectado: mensagem');
      errorMessage = result.mensagem;
      errorCode = result.codigo || result.codigo_erro || 'ERRO';
    }
    // Formato 6: message
    else if (result.message) {
      console.log('❌ Formato 6 detectado: message');
      errorMessage = result.message;
      errorCode = result.code || 'ERRO';
    }
    // Formato 7: erro como string
    else if (result.erro) {
      console.log('❌ Formato 7 detectado: erro');
      errorMessage = result.erro;
    }

    if (errorMessage) {
      console.log('❌ ERRO DETECTADO:', errorMessage);
      console.log('❌ CÓDIGO DO ERRO:', errorCode);
    } else {
      console.log('✅ Nenhum erro detectado na resposta');
    }

    // Se não for 2xx OU se encontrou erro
    if (!response.ok || errorMessage) {
      console.log('❌ ===== PROCESSANDO ERRO =====');
      console.log('❌ Status HTTP:', response.status);
      console.log('❌ Mensagem de erro:', errorMessage);
      console.log('❌ Código do erro:', errorCode);
      
      // Mensagens específicas por status
      if (!errorMessage) {
        if (response.status === 401) {
          errorMessage = `❌ ERRO DE AUTENTICAÇÃO (401)\n\nO Token da Focus NFe está incorreto ou inválido.\n\n📋 Como corrigir:\n\n1. Acesse https://focusnfe.com.br\n2. Faça login na sua conta\n3. Vá em "Configurações" → "Tokens de API"\n4. Copie o token correto (ambiente: ${settings.focus_nfe_environment || 'homologação'})\n5. Cole em: Configurações > Empresa > Configurações Fiscais > Token Focus NFe\n\n⚠️ IMPORTANTE:\n• Você está usando o ambiente: ${settings.focus_nfe_environment || 'homologação'}\n• O token de homologação é DIFERENTE do token de produção\n• Copie o token completo, sem espaços no início ou fim\n• Verifique se não há caracteres especiais ou quebras de linha\n\n🔍 Debug:\n• Token começa com: ${token.substring(0, 10)}...\n• Tamanho do token: ${token.length} caracteres\n• URL usada: ${focusUrl}`;
        } else if (response.status === 403) {
          errorMessage = 'Acesso negado. Verifique se sua conta Focus NFe tem permissão para emitir NFS-e.';
        } else if (response.status === 404) {
          errorMessage = 'Endpoint não encontrado. Verifique se o ambiente (homologação/produção) está correto.';
        } else if (response.status === 422) {
          errorMessage = `Dados inválidos: ${responseText.substring(0, 500)}`;
        } else if (response.status === 500) {
          errorMessage = 'Erro interno no servidor da Focus NFe. Tente novamente em alguns minutos.';
        } else {
          errorMessage = `Erro HTTP ${response.status}: ${responseText.substring(0, 500)}`;
        }
      }
      
      console.log('💾 Salvando erro no banco de dados...');
      
      // Salvar erro no banco
      await supabase
        .from('service_orders')
        .update({
          invoice_status: 'erro',
          invoice_error: errorMessage,
          invoice_error_code: errorCode || `HTTP_${response.status}`,
          invoice_updated_at: new Date().toISOString(),
        })
        .eq('id', serviceOrderId);
      
      console.log('✅ Erro salvo no banco');
      
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          errorCode: errorCode || `HTTP_${response.status}`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log('✅ ===== NFS-E ACEITA PARA PROCESSAMENTO =====');

    // Atualizar para processando_autorizacao
    await supabase
      .from('service_orders')
      .update({
        invoice_status: 'processando_autorizacao',
        invoice_updated_at: new Date().toISOString(),
      })
      .eq('id', serviceOrderId);

    console.log('✅ Status atualizado para: processando_autorizacao');
    console.log('🚀 ===== FIM DA REQUISIÇÃO (SUCESSO) =====');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'NFS-e enviada para processamento. Aguardando autorização da prefeitura.',
        invoice: {
          status: 'processando_autorizacao',
          ref: ref,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('❌ ===== ERRO CRÍTICO NÃO CAPTURADO =====');
    console.error('❌ Tipo:', error.constructor.name);
    console.error('❌ Mensagem:', error.message);
    console.error('❌ Stack completo:', error.stack);
    console.error('❌ ===== FIM DO ERRO CRÍTICO =====');
    
    return new Response(
      JSON.stringify({
        success: false,
        error: `Erro crítico: ${error.message || 'Erro desconhecido'}`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});