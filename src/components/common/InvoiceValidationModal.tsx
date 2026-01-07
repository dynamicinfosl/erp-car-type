import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface ValidationIssue {
  type: 'error' | 'warning';
  field: string;
  message: string;
  canEdit?: boolean;
}

interface ServiceOrderItem {
  id?: string;
  item_type: 'product' | 'service';
  service_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface InvoiceValidationModalProps {
  serviceOrderId: string;
  onClose: () => void;
  onEmit: () => void;
}

type EmissionStep = 'validating' | 'sending' | 'processing' | 'completed' | 'error';

export default function InvoiceValidationModal({ serviceOrderId, onClose, onEmit }: InvoiceValidationModalProps) {
  const [loading, setLoading] = useState(true);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [companyData, setCompanyData] = useState<any>(null);
  const [customerData, setCustomerData] = useState<any>(null);
  const [serviceOrderData, setServiceOrderData] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [isEmitting, setIsEmitting] = useState(false);
  
  // Estados para acompanhamento da emissão
  const [emissionStep, setEmissionStep] = useState<EmissionStep>('validating');
  const [emissionError, setEmissionError] = useState<string>('');
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [pollingInterval, setPollingInterval] = useState<any>(null);

  useEffect(() => {
    validateInvoiceData();
  }, [serviceOrderId]);

  // Limpar polling ao desmontar
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const validateInvoiceData = async () => {
    setLoading(true);
    const issues: ValidationIssue[] = [];

    try {
      // 1. Buscar dados da empresa
      const { data: companyList, error: companyError } = await supabase
        .from('system_settings')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1);

      if (companyError) throw companyError;
      
      const company = companyList?.[0];
      if (!company) {
        issues.push({
          type: 'error',
          field: 'Sistema',
          message: 'Dados da empresa não encontrados',
          canEdit: true,
        });
        setValidationIssues(issues);
        setLoading(false);
        return;
      }
      
      setCompanyData(company);

      // Validar dados da empresa
      if (!company.company_name || company.company_name.trim() === '') {
        issues.push({
          type: 'error',
          field: 'Empresa',
          message: 'Nome da empresa não cadastrado',
          canEdit: true,
        });
      }
      if (!company.cnpj || company.cnpj.trim() === '') {
        issues.push({
          type: 'error',
          field: 'Empresa',
          message: 'CNPJ da empresa não cadastrado',
          canEdit: true,
        });
      }
      if (!company.address || !company.city || !company.state || !company.zip_code) {
        issues.push({
          type: 'error',
          field: 'Empresa',
          message: 'Endereço completo da empresa não cadastrado',
          canEdit: true,
        });
      }

      // 2. Validar Token Focus NFe
      if (!company.focus_nfe_token || company.focus_nfe_token.trim() === '') {
        issues.push({
          type: 'error',
          field: 'Focus NFe',
          message: 'Token da Focus NFe não configurado',
          canEdit: true,
        });
      }

      // 3. Buscar dados da OS
      const { data: serviceOrder, error: soError } = await supabase
        .from('service_orders')
        .select(`
          *,
          customer:customers(*),
          vehicle:vehicles(*)
        `)
        .eq('id', serviceOrderId)
        .single();

      if (soError) throw soError;
      setServiceOrderData(serviceOrder);
      setCustomerData(serviceOrder.customer);

      // Validar dados do cliente
      const hasDocument = (serviceOrder.customer.cpf && serviceOrder.customer.cpf.trim() !== '') || 
                         (serviceOrder.customer.cnpj && serviceOrder.customer.cnpj.trim() !== '');
      
      if (!hasDocument) {
        issues.push({
          type: 'error',
          field: 'Cliente',
          message: 'Cliente não possui CPF ou CNPJ cadastrado',
          canEdit: true,
        });
      }
      
      const hasAddress = serviceOrder.customer.address && 
                        serviceOrder.customer.address.trim() !== '' &&
                        serviceOrder.customer.city && 
                        serviceOrder.customer.city.trim() !== '' &&
                        serviceOrder.customer.state && 
                        serviceOrder.customer.state.trim() !== '';
      
      if (!hasAddress) {
        issues.push({
          type: 'error',
          field: 'Cliente',
          message: 'Endereço completo do cliente não cadastrado',
          canEdit: true,
        });
      }

      // 4. Buscar itens da OS
      const { data: items, error: itemsError } = await supabase
        .from('service_order_items')
        .select('*')
        .eq('service_order_id', serviceOrderId);

      if (itemsError) throw itemsError;

      // Filtrar apenas serviços
      const serviceItems = items.filter(item => item.item_type === 'service' && item.service_id);

      if (serviceItems.length === 0) {
        issues.push({
          type: 'warning',
          field: 'Serviços',
          message: 'Esta OS não possui serviços, apenas produtos',
        });
      }

      // 5. Validar códigos fiscais dos serviços
      if (serviceItems.length > 0) {
        const serviceIds = serviceItems.map(item => item.service_id);
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select('*')
          .in('id', serviceIds);

        if (servicesError) throw servicesError;
        setServices(servicesData || []);

        servicesData?.forEach(service => {
          // Só valida se não for isento
          if (!service.isento_nfe) {
            const codigo = service.codigo_servico_municipal?.replace(/\D/g, '');
            
            if (!codigo || codigo.length !== 6) {
              issues.push({
                type: 'error',
                field: 'Serviços',
                message: `Serviço "${service.name}" possui código fiscal inválido. O código deve ter exatamente 6 dígitos numéricos (ex: 010101). Código atual: "${service.codigo_servico_municipal || 'não informado'}"`,
                canEdit: true,
              });
            }
          }
        });
      }

      // 6. Validar status da OS
      if (serviceOrder.status !== 'delivered') {
        issues.push({
          type: 'warning',
          field: 'Status',
          message: 'A OS não está marcada como "Entregue"',
        });
      }
      if (serviceOrder.payment_status !== 'paid') {
        issues.push({
          type: 'warning',
          field: 'Pagamento',
          message: 'A OS não está marcada como "Pago"',
        });
      }

      setValidationIssues(issues);
    } catch (error) {
      console.error('❌ Erro ao validar dados:', error);
      issues.push({
        type: 'error',
        field: 'Sistema',
        message: 'Erro ao carregar dados para validação',
      });
      setValidationIssues(issues);
    } finally {
      setLoading(false);
    }
  };

  const checkInvoiceStatus = async () => {
    try {
      const { data: order, error } = await supabase
        .from('service_orders')
        .select('invoice_status, invoice_number, invoice_key, invoice_url, invoice_pdf_url, invoice_xml_url, invoice_error')
        .eq('id', serviceOrderId)
        .single();

      if (error) throw error;

      console.log('🔍 Status atual da nota:', order.invoice_status);
      console.log('🔍 Erro (se houver):', order.invoice_error);

      if (order.invoice_status === 'autorizado') {
        // Nota autorizada!
        setEmissionStep('completed');
        setInvoiceData({
          number: order.invoice_number,
          key: order.invoice_key,
          url: order.invoice_url,
          pdf_url: order.invoice_pdf_url,
          xml_url: order.invoice_xml_url,
        });
        
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        
        // Chamar callback de sucesso
        onEmit();
      } else if (order.invoice_status === 'erro_autorizacao' || order.invoice_status === 'erro_validacao' || order.invoice_status === 'erro') {
        // Erro na emissão
        setEmissionStep('error');
        setEmissionError(order.invoice_error || 'Erro desconhecido ao emitir a nota');
        setIsEmitting(false);
        
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
      } else if (order.invoice_status === 'processando_autorizacao') {
        // Ainda processando
        setEmissionStep('processing');
      } else if (order.invoice_error && order.invoice_error.trim() !== '') {
        // Se tem erro mas o status não foi atualizado, considerar como erro
        console.error('❌ Erro detectado sem status de erro:', order.invoice_error);
        setEmissionStep('error');
        setEmissionError(order.invoice_error);
        setIsEmitting(false);
        
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao verificar status:', error);
    }
  };

  const handleEmit = async () => {
    const errors = validationIssues.filter(issue => issue.type === 'error');
    
    if (errors.length > 0) {
      alert('Corrija os erros antes de emitir a NF-e');
      return;
    }

    setIsEmitting(true);
    setEmissionStep('sending');
    setEmissionError('');

    try {
      console.log('📤 Enviando requisição para emitir NFS-e...');
      console.log('📤 Service Order ID:', serviceOrderId);
      console.log('📤 URL:', `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/focus-nfe-emit-nfe-service`);
      
      const response = await fetch(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/focus-nfe-emit-nfe-service`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ serviceOrderId }),
      });

      console.log('📥 Status da resposta:', response.status);
      console.log('📥 Status Text:', response.statusText);
      
      // Capturar o texto bruto primeiro
      const responseText = await response.text();
      console.log('📥 Resposta bruta completa:', responseText);

      // Tentar parsear como JSON
      let data: any;
      try {
        data = JSON.parse(responseText);
        console.log('✅ Resposta parseada com sucesso');
        console.log('📥 Dados parseados:', JSON.stringify(data, null, 2));
      } catch (parseError) {
        console.error('❌ ERRO ao parsear JSON:', parseError);
        console.error('❌ Resposta não é JSON válido');
        
        // Se não for JSON, usar o texto bruto como erro
        setEmissionStep('error');
        setEmissionError(`Erro no servidor:\n\n${responseText.substring(0, 1000)}`);
        setIsEmitting(false);
        return;
      }

      // Se não for 2xx, é erro
      if (!response.ok) {
        console.log('⚠️ Resposta com status não-OK:', response.status);
        
        let errorMessage = 'Erro ao emitir NFS-e';
        
        // Tentar extrair a mensagem de erro de várias formas possíveis
        console.log('🔍 Tentando extrair mensagem de erro...');
        console.log('🔍 Estrutura do data:', Object.keys(data || {}));
        console.log('🔍 data completo:', JSON.stringify(data, null, 2));
        
        // 1. Verificar se data.error é um objeto com errorCode
        if (data?.error && typeof data.error === 'object') {
          console.log('🔍 data.error é um objeto:', data.error);
          
          if (data.error.errorCode) {
            const errorCode = data.error.errorCode;
            const errorMsg = data.error.error || data.error.message || data.error.mensagem || 'Erro desconhecido';
            errorMessage = `[${errorCode}] ${errorMsg}`;
            console.log('✅ Erro encontrado em data.error (objeto):', errorMessage);
          } else if (data.error.message) {
            errorMessage = data.error.message;
            console.log('✅ Erro encontrado em data.error.message:', errorMessage);
          } else {
            errorMessage = JSON.stringify(data.error);
            console.log('✅ Usando JSON.stringify do data.error:', errorMessage);
          }
        }
        // 2. Verificar data.error (string)
        else if (data?.error && typeof data.error === 'string' && data.error.trim() !== '') {
          errorMessage = data.error;
          console.log('✅ Erro encontrado em data.error (string):', errorMessage);
        }
        // 3. Verificar data.errorCode diretamente
        else if (data?.errorCode && typeof data.errorCode === 'string' && data.errorCode.trim() !== '') {
          const errorMsg = data.error || data.message || data.mensagem || 'Erro desconhecido';
          errorMessage = `[${data.errorCode}] ${errorMsg}`;
          console.log('✅ Erro encontrado em data.errorCode:', errorMessage);
        }
        // 4. Verificar data.message (string)
        else if (data?.message && typeof data.message === 'string' && data.message.trim() !== '') {
          errorMessage = data.message;
          console.log('✅ Erro encontrado em data.message:', errorMessage);
        }
        // 5. Verificar data.mensagem (string)
        else if (data?.mensagem && typeof data.mensagem === 'string' && data.mensagem.trim() !== '') {
          errorMessage = data.mensagem;
          console.log('✅ Erro encontrado em data.mensagem:', errorMessage);
        }
        // 6. Verificar array de erros em data.erros
        else if (data?.erros && Array.isArray(data.erros) && data.erros.length > 0) {
          errorMessage = data.erros.map((e: any) => {
            if (typeof e === 'string') return e;
            const codigo = e.Codigo || e.codigo || '';
            const descricao = e.Descricao || e.descricao || e.mensagem || '';
            return codigo ? `[${codigo}] ${descricao}` : descricao;
          }).filter(Boolean).join('\n');
          console.log('✅ Erro encontrado em data.erros:', errorMessage);
        }
        // 7. Verificar array de erros em data.data.erros
        else if (data?.data?.erros && Array.isArray(data.data.erros) && data.data.erros.length > 0) {
          errorMessage = data.data.erros.map((e: any) => {
            if (typeof e === 'string') return e;
            const codigo = e.Codigo || e.codigo || '';
            const descricao = e.Descricao || e.descricao || e.mensagem || '';
            return codigo ? `[${codigo}] ${descricao}` : descricao;
          }).filter(Boolean).join('\n');
          console.log('✅ Erro encontrado em data.data.erros:', errorMessage);
        }
        // 8. Se data for string diretamente
        else if (typeof data === 'string' && data.trim() !== '') {
          errorMessage = data;
          console.log('✅ Erro encontrado em data (string):', errorMessage);
        }
        // 9. Usar resposta bruta se nada funcionar
        else {
          errorMessage = responseText.substring(0, 1000);
          console.log('⚠️ Usando resposta bruta como erro');
        }
        
        console.log('📤 Mensagem de erro final que será exibida:', errorMessage);
        
        setEmissionStep('error');
        setEmissionError(errorMessage);
        setIsEmitting(false);
        return;
      }

      // Verificar se a resposta indica sucesso
      console.log('🔍 Verificando se resposta indica sucesso...');
      console.log('🔍 data.success:', data?.success);
      
      if (!data || data.success === false) {
        console.log('⚠️ Resposta indica falha (success=false)');
        
        let errorMsg = 'Erro desconhecido ao emitir NFS-e';
        
        // Tentar extrair erro da mesma forma que acima
        if (data?.error && typeof data.error === 'object') {
          if (data.error.errorCode) {
            const errorCode = data.error.errorCode;
            const msg = data.error.error || data.error.message || data.error.mensagem || 'Erro desconhecido';
            errorMsg = `[${errorCode}] ${msg}`;
          } else if (data.error.message) {
            errorMsg = data.error.message;
          } else {
            errorMsg = JSON.stringify(data.error);
          }
        } else if (data?.error && typeof data.error === 'string') {
          errorMsg = data.error;
        } else if (data?.message) {
          errorMsg = data.message;
        } else if (data?.mensagem) {
          errorMsg = data.mensagem;
        }
        
        console.log('⚠️ Mensagem de erro:', errorMsg);
        
        setEmissionStep('error');
        setEmissionError(errorMsg);
        setIsEmitting(false);
        return;
      }

      console.log('✅ Resposta indica sucesso!');
      console.log('✅ Iniciando monitoramento do status...');

      // Requisição aceita, agora vamos monitorar o status
      setEmissionStep('processing');
      
      // Iniciar polling para verificar o status
      const interval = setInterval(checkInvoiceStatus, 3000);
      setPollingInterval(interval);
      
      // Verificar imediatamente também
      checkInvoiceStatus();
      
    } catch (error: any) {
      console.error('❌ EXCEÇÃO capturada:', error);
      console.error('❌ Tipo do erro:', error?.constructor?.name);
      console.error('❌ Mensagem:', error?.message);
      console.error('❌ Stack:', error?.stack);
      
      let errorMessage = 'Erro ao conectar com o servidor. Verifique sua conexão e tente novamente.';
      
      // Tentar extrair mensagem útil do erro
      if (error?.message && error.message !== 'Edge Function returned a non-2xx status code') {
        errorMessage = error.message;
      }
      
      console.log('📤 Mensagem de erro da exceção:', errorMessage);
      
      setEmissionStep('error');
      setEmissionError(errorMessage);
      setIsEmitting(false);
    }
  };

  const goToSettings = () => {
    window.open('/settings/company', '_blank');
  };

  const goToCustomer = () => {
    window.open('/customers', '_blank');
  };

  const goToServices = () => {
    window.open('/services', '_blank');
  };

  const handleClose = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    onClose();
  };

  const errors = validationIssues.filter(issue => issue.type === 'error');
  const warnings = validationIssues.filter(issue => issue.type === 'warning');
  const canEmit = errors.length === 0;

  // Se está emitindo, mostrar tela de progresso
  if (isEmitting) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-2xl">
          <div className="p-8">
            {/* Cabeçalho */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Emissão de NFS-e
              </h2>
              <p className="text-gray-600">
                Acompanhe o progresso da emissão
              </p>
            </div>

            {/* Progresso */}
            <div className="space-y-6">
              {/* Enviando */}
              <div className={`flex items-center gap-4 p-4 rounded-xl ${
                emissionStep === 'sending' 
                  ? 'bg-blue-50 border-2 border-blue-200' 
                  : emissionStep === 'processing' || emissionStep === 'completed'
                  ? 'bg-green-50 border-2 border-green-200'
                  : 'bg-gray-50 border-2 border-gray-200'
              }`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  emissionStep === 'sending'
                    ? 'bg-blue-500'
                    : emissionStep === 'processing' || emissionStep === 'completed'
                    ? 'bg-green-500'
                    : 'bg-gray-300'
                }`}>
                  {emissionStep === 'sending' ? (
                    <i className="ri-loader-4-line text-2xl text-white animate-spin"></i>
                  ) : (
                    <i className="ri-check-line text-2xl text-white"></i>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Enviando para Focus NFe</h3>
                  <p className="text-sm text-gray-600">
                    {emissionStep === 'sending' 
                      ? 'Enviando dados da nota fiscal...' 
                      : 'Dados enviados com sucesso'}
                  </p>
                </div>
              </div>

              {/* Processando */}
              <div className={`flex items-center gap-4 p-4 rounded-xl ${
                emissionStep === 'processing' 
                  ? 'bg-blue-50 border-2 border-blue-200' 
                  : emissionStep === 'completed'
                  ? 'bg-green-50 border-2 border-green-200'
                  : 'bg-gray-50 border-2 border-gray-200'
              }`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  emissionStep === 'processing'
                    ? 'bg-blue-500'
                    : emissionStep === 'completed'
                    ? 'bg-green-500'
                    : 'bg-gray-300'
                }`}>
                  {emissionStep === 'processing' ? (
                    <i className="ri-loader-4-line text-2xl text-white animate-spin"></i>
                  ) : emissionStep === 'completed' ? (
                    <i className="ri-check-line text-2xl text-white"></i>
                  ) : (
                    <i className="ri-time-line text-2xl text-white"></i>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Processando na SEFAZ</h3>
                  <p className="text-sm text-gray-600">
                    {emissionStep === 'processing' 
                      ? 'Aguardando autorização da prefeitura...' 
                      : emissionStep === 'completed'
                      ? 'Nota autorizada pela prefeitura'
                      : 'Aguardando processamento'}
                  </p>
                </div>
              </div>

              {/* Concluído */}
              {emissionStep === 'completed' && invoiceData && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
                      <i className="ri-checkbox-circle-line text-3xl text-white"></i>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-green-900">NFS-e Emitida com Sucesso!</h3>
                      <p className="text-sm text-green-700">Sua nota fiscal foi autorizada</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Número da Nota</p>
                        <p className="font-semibold text-gray-900">{invoiceData.number}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Código de Verificação</p>
                        <p className="font-semibold text-gray-900">{invoiceData.key}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    {invoiceData.pdf_url && (
                      <a
                        href={invoiceData.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition cursor-pointer text-center whitespace-nowrap flex items-center justify-center gap-2"
                      >
                        <i className="ri-file-pdf-line text-xl"></i>
                        Baixar PDF
                      </a>
                    )}
                    {invoiceData.xml_url && (
                      <a
                        href={invoiceData.xml_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition cursor-pointer text-center whitespace-nowrap flex items-center justify-center gap-2"
                      >
                        <i className="ri-file-code-line text-xl"></i>
                        Baixar XML
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Erro */}
              {emissionStep === 'error' && (
                <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-xl p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center">
                      <i className="ri-error-warning-line text-3xl text-white"></i>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-red-900">Erro na Emissão</h3>
                      <p className="text-sm text-red-700">Não foi possível emitir a nota fiscal</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{emissionError}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Botões */}
            <div className="flex justify-end gap-4 mt-8">
              {(emissionStep === 'completed' || emissionStep === 'error') && (
                <button
                  onClick={handleClose}
                  className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition cursor-pointer whitespace-nowrap"
                >
                  Fechar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <i className="ri-file-text-line text-teal-600"></i>
            Validação para Emissão de NF-e
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
          >
            <i className="ri-close-line text-2xl"></i>
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Validando dados...</p>
            </div>
          ) : (
            <>
              {/* Status Geral */}
              <div className={`rounded-xl p-6 mb-6 ${
                canEmit 
                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200' 
                  : 'bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200'
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                    canEmit ? 'bg-green-500' : 'bg-red-500'
                  }`}>
                    <i className={`${canEmit ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'} text-3xl text-white`}></i>
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-xl font-bold ${canEmit ? 'text-green-900' : 'text-red-900'}`}>
                      {canEmit ? 'Pronto para Emitir!' : 'Atenção: Corrija os Erros'}
                    </h3>
                    <p className={`text-sm ${canEmit ? 'text-green-700' : 'text-red-700'}`}>
                      {canEmit 
                        ? 'Todos os dados necessários estão corretos. Você pode emitir a NF-e agora.'
                        : `${errors.length} erro(s) encontrado(s). Corrija antes de emitir.`
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Erros */}
              {errors.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-red-900 mb-3 flex items-center gap-2">
                    <i className="ri-error-warning-line text-red-600"></i>
                    Erros que Impedem a Emissão ({errors.length})
                  </h3>
                  <div className="space-y-3">
                    {errors.map((issue, index) => (
                      <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-red-900">{issue.field}</p>
                            <p className="text-sm text-red-700 mt-1">{issue.message}</p>
                          </div>
                          {issue.canEdit && (
                            <button
                              onClick={() => {
                                if (issue.field === 'Empresa' || issue.field === 'Focus NFe') {
                                  goToSettings();
                                } else if (issue.field === 'Cliente') {
                                  goToCustomer();
                                } else if (issue.field === 'Serviços') {
                                  goToServices();
                                }
                              }}
                              className="ml-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition cursor-pointer whitespace-nowrap text-sm"
                            >
                              <i className="ri-edit-line mr-1"></i>
                              Corrigir
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Avisos */}
              {warnings.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-yellow-900 mb-3 flex items-center gap-2">
                    <i className="ri-alert-line text-yellow-600"></i>
                    Avisos ({warnings.length})
                  </h3>
                  <div className="space-y-3">
                    {warnings.map((issue, index) => (
                      <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <div className="flex-1">
                            <p className="font-semibold text-yellow-900">{issue.field}</p>
                            <p className="text-sm text-yellow-700 mt-1">{issue.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resumo dos Dados */}
              {canEmit && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <i className="ri-file-list-3-line text-teal-600"></i>
                    Resumo da NF-e
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Dados da Empresa */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <i className="ri-building-line text-teal-600"></i>
                        Prestador
                      </h4>
                      <div className="space-y-1 text-sm">
                        <p className="text-gray-700"><strong>Nome:</strong> {companyData?.company_name}</p>
                        <p className="text-gray-700"><strong>CNPJ:</strong> {companyData?.cnpj}</p>
                        <p className="text-gray-700"><strong>Endereço:</strong> {companyData?.address}, {companyData?.city}/{companyData?.state}</p>
                      </div>
                    </div>

                    {/* Dados do Cliente */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <i className="ri-user-line text-teal-600"></i>
                        Tomador
                      </h4>
                      <div className="space-y-1 text-sm">
                        <p className="text-gray-700"><strong>Nome:</strong> {customerData?.name}</p>
                        <p className="text-gray-700"><strong>CPF/CNPJ:</strong> {customerData?.cpf || customerData?.cnpj}</p>
                        <p className="text-gray-700"><strong>Telefone:</strong> {customerData?.phone}</p>
                        <p className="text-gray-700"><strong>Endereço:</strong> {customerData?.address}, {customerData?.city}/{customerData?.state}</p>
                      </div>
                    </div>

                    {/* Serviços */}
                    {services.length > 0 && (
                      <div className="md:col-span-2 bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                          <i className="ri-tools-line text-teal-600"></i>
                          Serviços a Serem Emitidos
                        </h4>
                        <div className="space-y-2">
                          {services.map((service, index) => (
                            <div key={index} className="flex items-center justify-between text-sm bg-white p-2 rounded">
                              <div>
                                <p className="font-medium text-gray-900">{service.name}</p>
                                {service.codigo_servico_municipal && (
                                  <p className="text-xs text-gray-600">Código: {service.codigo_servico_municipal} | ISS: {service.issqn_aliquota}%</p>
                                )}
                              </div>
                              <span className="text-teal-600 font-semibold">R$ {service.unit_price.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Valor Total */}
                    <div className="md:col-span-2 bg-gradient-to-r from-teal-50 to-emerald-50 border-2 border-teal-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                          <i className="ri-money-dollar-circle-line text-teal-600 text-xl"></i>
                          Valor Total da NF-e
                        </h4>
                        <span className="text-2xl font-bold text-teal-600">
                          R$ {serviceOrderData?.final_amount?.toFixed(2) || serviceOrderData?.total_amount?.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
                <button
                  onClick={handleClose}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition cursor-pointer whitespace-nowrap"
                >
                  Cancelar
                </button>
                {canEmit && (
                  <button
                    onClick={handleEmit}
                    className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition cursor-pointer whitespace-nowrap flex items-center gap-2"
                  >
                    <i className="ri-file-text-line text-xl"></i>
                    Emitir NF-e Agora
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}