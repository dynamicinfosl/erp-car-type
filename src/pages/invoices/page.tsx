import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Sidebar from '../../components/layout/Sidebar';
import MobileTopBar from '../../components/layout/MobileTopBar';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
}

interface Vehicle {
  id: string;
  customer_id: string;
  brand: string;
  model: string;
  year: string;
  plate: string;
  color: string;
  chassis: string;
  km: string;
}

interface ServiceOrderItem {
  id?: string;
  item_type: 'product' | 'service';
  product_id?: string;
  service_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  cost_price?: number;
  total: number;
  needs_purchase?: boolean;
  supplier?: string;
  supplier_notes?: string;
}

interface ServiceOrder {
  id: string;
  customer_id: string;
  vehicle_id: string;
  status: string;
  payment_status: string;
  total_amount: number;
  advance_payment: number;
  notes: string;
  created_at: string;
  customer?: Customer;
  vehicle?: Vehicle;
  items?: ServiceOrderItem[];
  discount?: number;
  final_amount?: number;
  payment_method?: string;
  invoice_number?: string;
  invoice_status?: string;
}

interface Invoice {
  id: string;
  customer_id: string;
  vehicle_id: string;
  total_amount: number;
  created_at: string;
  invoice_number: string;
  invoice_reference: string;
  invoice_status: string;
  invoice_updated_at: string;
  invoice_pdf_url?: string;
  invoice_xml_url?: string;
  invoice_key?: string;
  customer?: Customer;
  vehicle?: Vehicle;
}

export default function Invoices() {
  // 🔥 Função para baixar arquivo via Edge Function dedicada
  const downloadNFSeFile = async (
    ref: string,
    type: 'pdf' | 'xml',
    numero: string,
    customerName?: string
  ) => {
    try {
      console.log('📥 Baixando arquivo:', { ref, type, numero });
      
      // Obter sessão para autenticação
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Sessão não encontrada. Faça login novamente.');
      }
      
      // URL da Edge Function de download
      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
      const downloadUrl = `${supabaseUrl}/functions/v1/download-nfse-file`;
      
      console.log('🔗 URL de download:', downloadUrl);
      console.log('📋 Parâmetros:', { fileType: type, ref });
      
      // Fazer requisição autenticada com corpo JSON
      const response = await fetch(downloadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ fileType: type, ref }),
      });
      
      console.log('📡 Status da resposta:', response.status);
      console.log('📋 Content-Type:', response.headers.get('content-type'));
      
      // Verificar se a resposta é JSON (erro) ou binário (arquivo)
      const contentType = response.headers.get('content-type') || '';
      
      if (!response.ok || contentType.includes('application/json')) {
        // É um erro em formato JSON - ler como texto e tentar parse
        const errorText = await response.text();
        console.error('❌ Erro da API (texto):', errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || 'Erro ao baixar arquivo');
        } catch (jsonError) {
          // Não é JSON válido, usar texto direto
          throw new Error(errorText || 'Erro ao baixar arquivo');
        }
      }
      
      // É um arquivo binário - fazer download
      const blob = await response.blob();
      console.log('📦 Blob recebido:', blob.size, 'bytes');
      
      // Sanitizar nome do cliente para nome de arquivo
      const sanitizeFilePart = (str: string | undefined) => {
        if (!str) return '';
        return str
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9]/g, '_')
          .substring(0, 30)
          .replace(/^_+|_+$/g, '');
      };
      
      const customerPart = sanitizeFilePart(customerName);
      const baseId = numero || ref.slice(-8);
      const downloadName = customerPart
        ? `NFSe-${baseId}-${customerPart}.${type}`
        : `NFSe-${baseId}.${type}`;
      
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      
      console.log('✅ Arquivo baixado com sucesso!');
    } catch (error: any) {
      console.error('❌ Erro ao baixar arquivo:', error);
      alert(`Erro ao baixar ${type.toUpperCase()}: ${error.message}`);
    }
  };

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Estados para modal de visualização da OS
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedOrderForView, setSelectedOrderForView] = useState<ServiceOrder | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('service_orders')
        .select(`
          id,
          customer_id,
          vehicle_id,
          total_amount,
          created_at,
          invoice_number,
          invoice_reference,
          invoice_status,
          invoice_updated_at,
          invoice_pdf_url,
          invoice_xml_url,
          invoice_key,
          customer:customers(*),
          vehicle:vehicles(*)
        `)
        .not('invoice_number', 'is', null)
        .order('invoice_updated_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Erro ao carregar notas fiscais:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleViewOrder = async (invoiceId: string) => {
    try {
      setIsLoadingOrder(true);
      
      // Buscar a OS completa com itens
      const { data: orderData, error: orderError } = await supabase
        .from('service_orders')
        .select(`
          *,
          customer:customers(*),
          vehicle:vehicles(*)
        `)
        .eq('id', invoiceId)
        .single();

      if (orderError) throw orderError;

      // Buscar itens da OS
      const { data: itemsData, error: itemsError } = await supabase
        .from('service_order_items')
        .select('*')
        .eq('service_order_id', invoiceId);

      if (itemsError) throw itemsError;

      const orderWithItems: ServiceOrder = {
        ...orderData,
        items: itemsData || [],
      };

      setSelectedOrderForView(orderWithItems);
      setShowViewModal(true);
    } catch (error) {
      console.error('Erro ao carregar OS:', error);
      alert('Erro ao carregar ordem de serviço');
    } finally {
      setIsLoadingOrder(false);
    }
  };

  const handlePrint = (orderId: string) => {
    // Normalizar o base path para evitar barras duplas
    const basePath = (window as any).__BASE_PATH__?.replace(/\/$/, '') || '';
    const printPath = `/print/service-order/${orderId}`;
    const printUrl = `${window.location.origin}${basePath}${printPath}`;
    window.open(printUrl, '_blank');
  };

  const getOrderStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      'in_diagnosis': { label: 'Em Diagnóstico', color: 'bg-blue-100 text-blue-800' },
      'waiting_approval': { label: 'Aguardando Aprovação', color: 'bg-yellow-100 text-yellow-800' },
      'in_service': { label: 'Em Serviço', color: 'bg-purple-100 text-purple-800' },
      'ready': { label: 'Pronto', color: 'bg-green-100 text-green-800' },
      'delivered': { label: 'Entregue', color: 'bg-gray-100 text-gray-800' },
    };
    const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  const getInvoiceStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { label: string; className: string } } = {
      emitida: { label: 'Emitida', className: 'bg-green-100 text-green-800' },
      processando_autorizacao: { label: 'Processando', className: 'bg-yellow-100 text-yellow-800' },
      erro_autorizacao: { label: 'Erro', className: 'bg-red-100 text-red-800' },
    };

    const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
    
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getStatusBadge = getInvoiceStatusBadge; // Mantém compatibilidade para a lista de invoices

  const getPaymentBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      'pending': { label: 'Pendente', color: 'bg-red-100 text-red-800' },
      'partial': { label: 'Parcial', color: 'bg-orange-100 text-orange-800' },
      'paid': { label: 'Pago', color: 'bg-green-100 text-green-800' },
    };
    const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };


  const getFilteredInvoices = () => {
    let filtered = invoices;

    // Filtro de busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (invoice) =>
          invoice.customer?.name?.toLowerCase().includes(term) ||
          invoice.customer?.phone?.includes(term) ||
          invoice.vehicle?.plate?.toLowerCase().includes(term) ||
          invoice.vehicle?.model?.toLowerCase().includes(term) ||
          invoice.invoice_number?.includes(term) ||
          invoice.invoice_reference?.toLowerCase().includes(term)
      );
    }

    // Filtro de status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((invoice) => invoice.invoice_status === statusFilter);
    }

    // Filtro de data
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter((invoice) => {
        const invoiceDate = new Date(invoice.invoice_updated_at || invoice.created_at);
        
        switch (dateFilter) {
          case 'today':
            return invoiceDate >= today;
          case 'yesterday':
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return invoiceDate >= yesterday && invoiceDate < today;
          case 'week':
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return invoiceDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return invoiceDate >= monthAgo;
          case 'custom':
            if (startDate && endDate) {
              const start = new Date(startDate);
              const end = new Date(endDate);
              end.setHours(23, 59, 59, 999);
              return invoiceDate >= start && invoiceDate <= end;
            }
            return true;
          default:
            return true;
        }
      });
    }

    return filtered;
  };

  const filteredInvoices = getFilteredInvoices();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 overflow-auto md:ml-64">
        <MobileTopBar />
        <div className="p-4 md:p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Notas Fiscais</h1>
            <p className="text-gray-600">Visualize e gerencie todas as notas fiscais emitidas</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            {/* Filtros Rápidos de Data */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setDateFilter('today')}
                  className={`px-4 py-2 rounded-lg transition cursor-pointer whitespace-nowrap ${
                    dateFilter === 'today'
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <i className="ri-calendar-check-line mr-2"></i>
                  Hoje
                </button>
                <button
                  onClick={() => setDateFilter('yesterday')}
                  className={`px-4 py-2 rounded-lg transition cursor-pointer whitespace-nowrap ${
                    dateFilter === 'yesterday'
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <i className="ri-calendar-line mr-2"></i>
                  Ontem
                </button>
                <button
                  onClick={() => setDateFilter('week')}
                  className={`px-4 py-2 rounded-lg transition cursor-pointer whitespace-nowrap ${
                    dateFilter === 'week'
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <i className="ri-calendar-2-line mr-2"></i>
                  Últimos 7 dias
                </button>
                <button
                  onClick={() => setDateFilter('month')}
                  className={`px-4 py-2 rounded-lg transition cursor-pointer whitespace-nowrap ${
                    dateFilter === 'month'
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <i className="ri-calendar-event-line mr-2"></i>
                  Este mês
                </button>
                <button
                  onClick={() => setDateFilter('custom')}
                  className={`px-4 py-2 rounded-lg transition cursor-pointer whitespace-nowrap ${
                    dateFilter === 'custom'
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <i className="ri-calendar-todo-line mr-2"></i>
                  Período Personalizado
                </button>
                <button
                  onClick={() => setDateFilter('all')}
                  className={`px-4 py-2 rounded-lg transition cursor-pointer whitespace-nowrap ${
                    dateFilter === 'all'
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <i className="ri-infinity-line mr-2"></i>
                  Todas
                </button>
              </div>
            </div>

            {/* Seletor de Período Personalizado */}
            {dateFilter === 'custom' && (
              <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data Inicial</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data Final</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl"></i>
                  <input
                    type="text"
                    placeholder="Buscar por cliente, número da NF, referência, placa..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="all">Todos os Status</option>
                  <option value="emitida">Emitida</option>
                  <option value="processando_autorizacao">Processando</option>
                  <option value="erro_autorizacao">Erro</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {filteredInvoices.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <i className="ri-file-list-3-line text-6xl text-gray-300 mb-4"></i>
                <p className="text-gray-500 text-lg">Nenhuma nota fiscal encontrada</p>
                <p className="text-gray-400 text-sm mt-2">
                  {searchTerm || statusFilter !== 'all' || dateFilter !== 'all'
                    ? 'Tente ajustar os filtros de busca'
                    : 'As notas fiscais emitidas aparecerão aqui'}
                </p>
              </div>
            ) : (
              filteredInvoices.map((invoice) => (
                <div key={invoice.id} className="bg-white rounded-xl shadow-sm p-4 md:p-6 hover:shadow-md transition">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      {/* Desktop: layout em linha */}
                      <div className="hidden md:flex items-center gap-6">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 mb-1">Número da NF</span>
                        <span className="font-mono text-lg font-bold text-teal-600">#{invoice.invoice_number}</span>
                      </div>

                      <div className="h-12 w-px bg-gray-200"></div>

                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 mb-1">Data de Emissão</span>
                        <span className="text-sm font-medium text-gray-900">
                          {formatDateTime(invoice.invoice_updated_at || invoice.created_at)}
                        </span>
                      </div>

                      <div className="h-12 w-px bg-gray-200"></div>

                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 mb-1">Cliente</span>
                        <span className="font-medium text-gray-900">{invoice.customer?.name}</span>
                        <span className="text-sm text-gray-600">{invoice.customer?.phone}</span>
                      </div>

                      <div className="h-12 w-px bg-gray-200"></div>

                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 mb-1">Veículo</span>
                        <span className="font-medium text-gray-900">{invoice.vehicle?.model}</span>
                        <span className="text-sm text-gray-600">{invoice.vehicle?.plate}</span>
                      </div>

                      <div className="h-12 w-px bg-gray-200"></div>

                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 mb-1">Status</span>
                        {getStatusBadge(invoice.invoice_status)}
                      </div>

                      <div className="h-12 w-px bg-gray-200"></div>

                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 mb-1">Valor Total</span>
                        <span className="text-lg font-bold text-orange-600">
                          R$ {invoice.total_amount.toFixed(2)}
                        </span>
                      </div>
                      </div>

                      {/* Mobile: resumo compacto */}
                      <div className="md:hidden space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">
                              NF #{invoice.invoice_number}
                            </p>
                            <p className="text-xs text-gray-600 truncate">{invoice.customer?.name}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDateTime(invoice.invoice_updated_at || invoice.created_at)}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-orange-600">R$ {invoice.total_amount.toFixed(2)}</p>
                            <div className="mt-1 flex justify-end">{getStatusBadge(invoice.invoice_status)}</div>
                          </div>
                        </div>

                        <div className="text-xs text-gray-600 truncate">
                          {invoice.vehicle?.model} {invoice.vehicle?.plate ? `• ${invoice.vehicle.plate}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-end gap-2 md:ml-4 justify-end">
                      {/* Botão Visualizar OS */}
                      <button
                        onClick={() => handleViewOrder(invoice.id)}
                        disabled={isLoadingOrder}
                        className="flex flex-col items-center gap-1 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Visualizar OS"
                      >
                        {isLoadingOrder ? (
                          <i className="ri-loader-4-line text-xl animate-spin"></i>
                        ) : (
                          <i className="ri-eye-line text-xl"></i>
                        )}
                        <span className="text-[10px] leading-none text-blue-700">Visualizar OS</span>
                      </button>

                      {/* Botões PDF e XML da NF-e */}
                      {invoice.invoice_reference && (
                        <div
                          className="flex flex-col items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 bg-gray-50"
                          title={`Arquivos da Nota Fiscal ${invoice.invoice_number}`}
                        >
                          <span className="text-[10px] leading-none font-semibold text-gray-600">Nota Fiscal</span>

                          <div className="flex items-end gap-2">
                            {/* Botão PDF */}
                            <button
                              onClick={() => downloadNFSeFile(invoice.invoice_reference, 'pdf', invoice.invoice_number, invoice.customer?.name)}
                              className="flex flex-col items-center gap-1 p-2 text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title={`Baixar PDF da NF-e ${invoice.invoice_number}`}
                            >
                              <i className="ri-file-pdf-line text-xl"></i>
                              <span className="text-[10px] leading-none text-red-700">PDF</span>
                            </button>
                            
                            {/* Botão XML */}
                            <button
                              onClick={() => downloadNFSeFile(invoice.invoice_reference, 'xml', invoice.invoice_number, invoice.customer?.name)}
                              className="flex flex-col items-center gap-1 p-2 text-green-600 hover:bg-green-50 rounded-lg transition cursor-pointer"
                              title={`Baixar XML da NF-e ${invoice.invoice_number}`}
                            >
                              <i className="ri-file-code-line text-xl"></i>
                              <span className="text-[10px] leading-none text-green-700">XML</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal de Visualização da OS */}
      {showViewModal && selectedOrderForView && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header do Modal */}
            <div className="sticky top-0 bg-gradient-to-r from-teal-600 to-teal-700 text-white p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Ordem de Serviço #{selectedOrderForView.id.slice(0, 8)}</h2>
                  <p className="text-teal-100 mt-1">{formatDateTime(selectedOrderForView.created_at)}</p>
                </div>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedOrderForView(null);
                  }}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition cursor-pointer"
                  title="Fechar"
                >
                  <i className="ri-close-line text-2xl"></i>
                </button>
              </div>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 space-y-6">
              {/* Informações do Cliente e Veículo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <i className="ri-user-line text-teal-600"></i>
                    Cliente
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Nome:</span>
                      <span className="ml-2 font-medium text-gray-900">{selectedOrderForView.customer?.name || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Telefone:</span>
                      <span className="ml-2 font-medium text-gray-900">{selectedOrderForView.customer?.phone || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">E-mail:</span>
                      <span className="ml-2 font-medium text-gray-900">{selectedOrderForView.customer?.email || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <i className="ri-car-line text-teal-600"></i>
                    Veículo
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Modelo:</span>
                      <span className="ml-2 font-medium text-gray-900">{selectedOrderForView.vehicle?.model || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Marca:</span>
                      <span className="ml-2 font-medium text-gray-900">{selectedOrderForView.vehicle?.brand || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Placa:</span>
                      <span className="ml-2 font-medium text-gray-900">{selectedOrderForView.vehicle?.plate || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Ano:</span>
                      <span className="ml-2 font-medium text-gray-900">{selectedOrderForView.vehicle?.year || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Cor:</span>
                      <span className="ml-2 font-medium text-gray-900">{selectedOrderForView.vehicle?.color || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status e Pagamento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <i className="ri-information-line text-teal-600"></i>
                    Status da OS
                  </h3>
                  <div className="flex items-center gap-2">
                    {getOrderStatusBadge(selectedOrderForView.status)}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <i className="ri-wallet-line text-teal-600"></i>
                    Informações de Pagamento
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-600">Status:</span>
                      <div className="mt-1">
                        {getPaymentBadge(selectedOrderForView.payment_status)}
                      </div>
                    </div>
                    {selectedOrderForView.payment_method && (
                      <div>
                        <span className="text-sm text-gray-600">Método de Pagamento:</span>
                        <p className="mt-1 font-medium text-gray-900">{selectedOrderForView.payment_method}</p>
                      </div>
                    )}
                    {selectedOrderForView.advance_payment > 0 && (
                      <div>
                        <span className="text-sm text-gray-600">Entrada/Sinal:</span>
                        <p className="mt-1 font-semibold text-blue-600">
                          R$ {selectedOrderForView.advance_payment.toFixed(2)}
                        </p>
                      </div>
                    )}
                    {selectedOrderForView.payment_status === 'partial' && (
                      <div>
                        <span className="text-sm text-gray-600">Valor Restante:</span>
                        <p className="mt-1 font-semibold text-orange-600">
                          R$ {((selectedOrderForView.final_amount || selectedOrderForView.total_amount) - selectedOrderForView.advance_payment).toFixed(2)}
                        </p>
                      </div>
                    )}
                    {selectedOrderForView.payment_status === 'paid' && (
                      <div>
                        <span className="text-sm text-gray-600">Total Pago:</span>
                        <p className="mt-1 font-semibold text-green-600">
                          R$ {(selectedOrderForView.final_amount || selectedOrderForView.total_amount).toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Itens da OS */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <i className="ri-list-check text-teal-600"></i>
                  Itens da Ordem de Serviço
                </h3>
                {selectedOrderForView.items && selectedOrderForView.items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="text-left py-2 px-3 font-semibold text-gray-700">Tipo</th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-700">Descrição</th>
                          <th className="text-center py-2 px-3 font-semibold text-gray-700">Qtd</th>
                          <th className="text-right py-2 px-3 font-semibold text-gray-700">Valor Unit.</th>
                          <th className="text-right py-2 px-3 font-semibold text-gray-700">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrderForView.items.map((item, index) => (
                          <tr key={item.id || index} className="border-b border-gray-200">
                            <td className="py-2 px-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                item.item_type === 'product' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-purple-100 text-purple-800'
                              }`}>
                                {item.item_type === 'product' ? 'Produto' : 'Serviço'}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-medium text-gray-900">{item.description}</td>
                            <td className="py-2 px-3 text-center text-gray-700">{item.quantity}</td>
                            <td className="py-2 px-3 text-right text-gray-700">
                              R$ {item.unit_price.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-gray-900">
                              R$ {item.total.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">Nenhum item cadastrado</p>
                )}
              </div>

              {/* Valores */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <i className="ri-calculator-line text-teal-600"></i>
                  Resumo de Valores
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Subtotal dos Itens:</span>
                    <span className="font-semibold text-gray-900">
                      R$ {selectedOrderForView.total_amount.toFixed(2)}
                    </span>
                  </div>
                  {selectedOrderForView.discount && selectedOrderForView.discount > 0 && (
                    <div className="flex justify-between items-center text-red-600">
                      <span>Desconto:</span>
                      <span className="font-semibold">
                        - R$ {selectedOrderForView.discount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t-2 border-gray-400">
                    <span className="text-lg font-semibold text-gray-900">Valor Total da OS:</span>
                    <span className="text-xl font-bold text-teal-600">
                      R$ {(selectedOrderForView.final_amount || selectedOrderForView.total_amount).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Observações */}
              {selectedOrderForView.notes && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <i className="ri-file-text-line text-teal-600"></i>
                    Observações
                  </h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedOrderForView.notes}</p>
                </div>
              )}

              {/* Informações da NF-e (se existir) */}
              {selectedOrderForView.invoice_number && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <i className="ri-file-list-3-line text-green-600"></i>
                    Nota Fiscal
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Número da NF:</span>
                      <span className="ml-2 font-semibold text-gray-900">#{selectedOrderForView.invoice_number}</span>
                    </div>
                    {selectedOrderForView.invoice_status && (
                      <div>
                        <span className="text-gray-600">Status:</span>
                        <span className="ml-2">
                          {getInvoiceStatusBadge(selectedOrderForView.invoice_status)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedOrderForView(null);
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition cursor-pointer whitespace-nowrap"
              >
                Fechar
              </button>
              {selectedOrderForView && (
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    handlePrint(selectedOrderForView.id);
                  }}
                  className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition cursor-pointer whitespace-nowrap flex items-center gap-2"
                >
                  <i className="ri-printer-line"></i>
                  Imprimir
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
