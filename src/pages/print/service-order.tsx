import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface ServiceOrder {
  id: string;
  diagnosis: string;
  total_amount: number;
  advance_payment: number;
  discount: number;
  final_amount: number;
  payment_method: string;
  payment_status: string;
  status: string;
  notes: string;
  created_at: string;
  customer: {
    name: string;
    phone: string;
    email?: string;
  };
  vehicle: {
    model: string;
    year?: string;
    plate?: string;
    brand?: string;
  };
}

interface OrderItem {
  item_type: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface CompanySettings {
  company_name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  cnpj: string;
  logo_url: string;
}

export default function PrintServiceOrder() {
  const { id } = useParams();
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [printFormat, setPrintFormat] = useState<'a4' | 'receipt'>('a4');

  useEffect(() => {
    loadOrderData();
  }, [id]);

  const loadOrderData = async () => {
    try {
      const [orderRes, itemsRes, settingsRes] = await Promise.all([
        supabase
          .from('service_orders')
          .select('*, customer:customers(*), vehicle:vehicles(*)')
          .eq('id', id)
          .single(),
        supabase
          .from('service_order_items')
          .select('*')
          .eq('service_order_id', id),
        supabase
          .from('system_settings')
          .select('*')
          .limit(1)
          .maybeSingle(),
      ]);

      if (orderRes.error) throw orderRes.error;
      if (itemsRes.error) throw itemsRes.error;

      setOrder(orderRes.data);
      setItems(itemsRes.data || []);
      
      console.log('🔍 Configurações carregadas:', settingsRes.data);
      console.log('🖼️ Logo URL:', settingsRes.data?.logo_url);
      
      // Se encontrou configurações, usar. Senão, usar valores padrão
      if (settingsRes.data) {
        setSettings(settingsRes.data);
      } else {
        setSettings({
          company_name: 'CAR TYPE MOTORS',
          phone: '',
          email: '',
          address: '',
          city: '',
          state: '',
          zip_code: '',
          cnpj: '',
          logo_url: '',
        });
      }
    } catch (error) {
      console.error('Erro ao carregar ordem:', error);
      alert('Erro ao carregar ordem de serviço');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      in_diagnosis: 'Em Diagnóstico',
      waiting_approval: 'Aguardando Aprovação',
      in_service: 'Em Serviço',
      ready: 'Pronto',
      delivered: 'Entregue',
    };
    return labels[status] || status;
  };

  const getPaymentStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      pending: 'Pendente',
      partial: 'Parcial',
      paid: 'Pago',
    };
    return labels[status] || status;
  };

  const calculateTotals = () => {
    const totalServices = items
      .filter(item => item.item_type === 'service')
      .reduce((sum, item) => sum + item.total_price, 0);
    
    const totalProducts = items
      .filter(item => item.item_type === 'product')
      .reduce((sum, item) => sum + item.total_price, 0);

    return { totalServices, totalProducts };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Ordem de serviço não encontrada</p>
      </div>
    );
  }

  const { totalServices, totalProducts } = calculateTotals();
  const fullAddress = [
    settings?.address,
    settings?.city,
    settings?.state,
    settings?.zip_code
  ].filter(Boolean).join(', ');

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; }
          .print-a4 { width: 210mm; min-height: 291mm; }
          .print-receipt { width: 80mm; }
        }
        @page { margin: 0; size: A4; }
      `}</style>

      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <select
          value={printFormat}
          onChange={(e) => setPrintFormat(e.target.value as 'a4' | 'receipt')}
          className="px-4 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer"
        >
          <option value="a4">Formato A4</option>
          <option value="receipt">Formato Cupom (80mm)</option>
        </select>
        <button
          onClick={handlePrint}
          className="px-6 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition flex items-center gap-2 whitespace-nowrap cursor-pointer"
        >
          <i className="ri-printer-line"></i>
          Imprimir
        </button>
        <button
          onClick={() => window.close()}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition whitespace-nowrap cursor-pointer"
        >
          Fechar
        </button>
      </div>

      {printFormat === 'a4' ? (
        <div className="print-a4 bg-white p-8 mx-auto my-4 shadow-lg">
          <div className="border-b-2 border-orange-500 pb-3 mb-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  {settings?.logo_url && settings.logo_url.trim() !== '' && (
                    <div className="flex-shrink-0">
                      <img 
                        src={settings.logo_url} 
                        alt="Logo da Empresa" 
                        className="h-12 w-auto object-contain"
                        onError={(e) => {
                          console.error('❌ Erro ao carregar logo:', settings.logo_url);
                          e.currentTarget.style.display = 'none';
                        }}
                        onLoad={() => {
                          console.log('✅ Logo carregada com sucesso!');
                        }}
                      />
                    </div>
                  )}
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{settings?.company_name || 'CAR TYPE MOTORS'}</h1>
                    <p className="text-sm text-gray-600">Centro Automotivo</p>
                  </div>
                </div>
                <div className="text-xs text-gray-600 space-y-0.5">
                  {settings?.cnpj && <p>CNPJ: {settings.cnpj}</p>}
                  {settings?.phone && <p>Telefone: {settings.phone}</p>}
                  {settings?.email && <p>Email: {settings.email}</p>}
                  {fullAddress && <p>Endereço: {fullAddress}</p>}
                </div>
              </div>
              <div className="text-right">
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-3 py-1.5 rounded-lg inline-block mb-1.5">
                  <p className="text-xs font-medium">ORDEM DE SERVIÇO</p>
                  <p className="text-xl font-bold">#{order.id.substring(0, 8).toUpperCase()}</p>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Data: {new Date(order.created_at).toLocaleDateString('pt-BR')}
                </p>
                <p className="text-xs text-gray-600">
                  Status: <span className="font-semibold">{getStatusLabel(order.status)}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-3">
            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-bold text-gray-900 mb-2 text-sm">Dados do Cliente</h3>
              <p className="text-gray-900 font-semibold text-sm">{order.customer.name}</p>
              <p className="text-gray-600 text-xs mt-0.5">Telefone: {order.customer.phone}</p>
              {order.customer.email && (
                <p className="text-gray-600 text-xs">Email: {order.customer.email}</p>
              )}
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-bold text-gray-900 mb-2 text-sm">Dados do Veículo</h3>
              <p className="text-gray-900 font-semibold text-sm">{order.vehicle.model}</p>
              {order.vehicle.brand && (
                <p className="text-gray-600 text-xs mt-0.5">Marca: {order.vehicle.brand}</p>
              )}
              {order.vehicle.year && (
                <p className="text-gray-600 text-xs">Ano: {order.vehicle.year}</p>
              )}
              {order.vehicle.plate && (
                <p className="text-gray-600 text-xs">Placa: {order.vehicle.plate}</p>
              )}
            </div>
          </div>

          {order.notes && (
            <div className="mb-3">
              <h3 className="font-bold text-gray-900 mb-1.5 text-sm">Observações</h3>
              <div className="bg-gray-50 p-2.5 rounded-lg">
                <p className="text-gray-700 text-xs">{order.notes}</p>
              </div>
            </div>
          )}

          <div className="mb-3">
            <h3 className="font-bold text-gray-900 mb-2 text-sm">Itens da Ordem de Serviço</h3>
            <table className="w-full border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 px-2 py-1.5 text-left text-xs font-semibold">Tipo</th>
                  <th className="border border-gray-300 px-2 py-1.5 text-left text-xs font-semibold">Descrição</th>
                  <th className="border border-gray-300 px-2 py-1.5 text-center text-xs font-semibold">Qtd</th>
                  <th className="border border-gray-300 px-2 py-1.5 text-right text-xs font-semibold">Valor Unit.</th>
                  <th className="border border-gray-300 px-2 py-1.5 text-right text-xs font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index}>
                    <td className="border border-gray-300 px-2 py-1 text-xs">
                      {item.item_type === 'service' ? 'Serviço' : 'Produto'}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-xs">{item.description}</td>
                    <td className="border border-gray-300 px-2 py-1 text-xs text-center">{item.quantity}</td>
                    <td className="border border-gray-300 px-2 py-1 text-xs text-right">
                      R$ {item.unit_price.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-xs text-right font-medium">
                      R$ {item.total_price.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end mb-3">
            <div className="w-72">
              <div className="space-y-1 mb-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Total Serviços:</span>
                  <span className="font-medium">R$ {totalServices.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Total Produtos:</span>
                  <span className="font-medium">R$ {totalProducts.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-gray-300 pt-1">
                  <span className="text-gray-600 font-semibold">Subtotal:</span>
                  <span className="font-semibold">R$ {order.total_amount.toFixed(2)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Desconto:</span>
                    <span className="text-red-600">- R$ {order.discount.toFixed(2)}</span>
                  </div>
                )}
                {order.advance_payment > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Sinal Pago:</span>
                    <span className="text-green-600">- R$ {order.advance_payment.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div className="border-t-2 border-gray-300 pt-1.5">
                <div className="flex justify-between text-lg font-bold">
                  <span>TOTAL:</span>
                  <span className="text-orange-600">
                    R$ {(order.total_amount - (order.discount || 0) - (order.advance_payment || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="mt-2 space-y-0.5">
                <p className="text-xs text-gray-600">
                  Status de Pagamento: <span className="font-semibold">{getPaymentStatusLabel(order.payment_status)}</span>
                </p>
                {order.payment_method && (
                  <p className="text-xs text-gray-600">
                    Forma de Pagamento: <span className="font-semibold">{order.payment_method}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="border-t-2 border-gray-300 pt-3 mt-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="border-t border-gray-400 pt-1.5 mt-8">
                  <p className="text-center text-xs text-gray-600">Assinatura do Cliente</p>
                </div>
              </div>
              <div>
                <div className="border-t border-gray-400 pt-1.5 mt-8">
                  <p className="text-center text-xs text-gray-600">Assinatura do Responsável</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 border-2 border-gray-300 rounded-lg p-2.5">
            <h3 className="font-bold text-gray-900 mb-1.5 text-sm">Observações Adicionais</h3>
            <div className="space-y-1.5">
              <div className="border-b border-gray-300 pb-1"></div>
              <div className="border-b border-gray-300 pb-1"></div>
            </div>
            <p className="text-xs text-gray-500 mt-1 italic">Espaço para anotações manuais</p>
          </div>

          <div className="text-center text-xs text-gray-500 mt-2">
            <p>Este documento é válido como comprovante de serviço</p>
            <p className="mt-0.5">{settings?.company_name || 'Car Type Motors'} - Centro Automotivo</p>
          </div>
        </div>
      ) : (
        <div className="print-receipt bg-white p-4 mx-auto my-8 shadow-lg" style={{ width: '80mm' }}>
          <div className="text-center border-b-2 border-dashed border-gray-400 pb-3 mb-3">
            {settings?.logo_url && settings.logo_url.trim() !== '' && (
              <div className="flex justify-center mb-2">
                <img 
                  src={settings.logo_url} 
                  alt="Logo da Empresa" 
                  className="h-12 w-auto mx-auto object-contain"
                  onError={(e) => {
                    console.error('❌ Erro ao carregar logo:', settings.logo_url);
                    e.currentTarget.style.display = 'none';
                  }}
                  onLoad={() => {
                    console.log('✅ Logo carregada com sucesso no cupom!');
                  }}
                />
              </div>
            )}
            <h1 className="text-xl font-bold">{settings?.company_name || 'CAR TYPE MOTORS'}</h1>
            <p className="text-xs">Centro Automotivo</p>
            {settings?.cnpj && <p className="text-xs mt-1">CNPJ: {settings.cnpj}</p>}
            {settings?.phone && <p className="text-xs">Tel: {settings.phone}</p>}
            {settings?.email && <p className="text-xs">{settings.email}</p>}
            {fullAddress && <p className="text-xs">{fullAddress}</p>}
          </div>

          <div className="text-center mb-3">
            <p className="text-sm font-bold">ORDEM DE SERVIÇO</p>
            <p className="text-lg font-bold">#{order.id.substring(0, 8).toUpperCase()}</p>
            <p className="text-xs">{new Date(order.created_at).toLocaleString('pt-BR')}</p>
          </div>

          <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
            <p className="text-xs font-bold mb-1">CLIENTE</p>
            <p className="text-xs">{order.customer.name}</p>
            <p className="text-xs">{order.customer.phone}</p>
          </div>

          <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
            <p className="text-xs font-bold mb-1">VEÍCULO</p>
            <p className="text-xs">{order.vehicle.model}</p>
            {order.vehicle.plate && <p className="text-xs">Placa: {order.vehicle.plate}</p>}
          </div>

          {order.notes && (
            <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
              <p className="text-xs font-bold mb-1">OBSERVAÇÕES</p>
              <p className="text-xs">{order.notes}</p>
            </div>
          )}

          <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
            <p className="text-xs font-bold mb-2">ITENS</p>
            {items.map((item, index) => (
              <div key={index} className="mb-2">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{item.description}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>{item.quantity} x R$ {item.unit_price.toFixed(2)}</span>
                  <span className="font-medium">R$ {item.total_price.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span>Serviços:</span>
              <span>R$ {totalServices.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs mb-1">
              <span>Produtos:</span>
              <span>R$ {totalProducts.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs mb-1 border-t border-gray-300 pt-1">
              <span className="font-semibold">Subtotal:</span>
              <span className="font-semibold">R$ {order.total_amount.toFixed(2)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-xs mb-1">
                <span>Desconto:</span>
                <span className="text-red-600">- R$ {order.discount.toFixed(2)}</span>
              </div>
            )}
            {order.advance_payment > 0 && (
              <div className="flex justify-between text-xs mb-1">
                <span>Sinal Pago:</span>
                <span className="text-green-600">- R$ {order.advance_payment.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm border-t border-gray-400 pt-1 mt-1">
              <span>TOTAL:</span>
              <span>R$ {(order.total_amount - (order.discount || 0) - (order.advance_payment || 0)).toFixed(2)}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-400 pt-2 mb-2">
            <div className="flex justify-between text-xs mb-1">
              <span>Pagamento:</span>
              <span className="font-semibold">{getPaymentStatusLabel(order.payment_status)}</span>
            </div>
            {order.payment_method && (
              <div className="flex justify-between text-xs mb-1">
                <span>Forma:</span>
                <span className="font-semibold">{order.payment_method}</span>
              </div>
            )}
            <p className="text-xs mt-2">Status: {getStatusLabel(order.status)}</p>
          </div>

          <div className="border-t border-dashed border-gray-400 pt-2 mb-2">
            <p className="text-xs font-bold mb-2">OBSERVAÇÕES ADICIONAIS</p>
            <div className="space-y-1">
              <div className="border-b border-gray-300 pb-1"></div>
              <div className="border-b border-gray-300 pb-1"></div>
              <div className="border-b border-gray-300 pb-1"></div>
            </div>
          </div>

          <div className="text-center text-xs border-t border-dashed border-gray-400 pt-2">
            <p>Pagamento: {getPaymentStatusLabel(order.payment_status)}</p>
            <p className="mt-2">Status: {getStatusLabel(order.status)}</p>
            <p className="mt-3">Obrigado pela preferência!</p>
          </div>
        </div>
      )}
    </>
  );
}