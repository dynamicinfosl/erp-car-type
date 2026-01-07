import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface POSSale {
  id: string;
  sale_number: string;
  customer_name: string;
  customer_phone: string;
  payment_method: string;
  subtotal: number;
  discount: number;
  total_amount: number;
  created_at: string;
}

interface SaleItem {
  product_name: string;
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

export default function POSReceipt() {
  const { id } = useParams();
  const [sale, setSale] = useState<POSSale | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      if (!id) {
        console.error('ID não fornecido');
        setLoading(false);
        return;
      }

      const [saleRes, itemsRes, settingsRes] = await Promise.all([
        supabase.from('pos_sales').select('*').eq('id', id).single(),
        supabase.from('pos_sale_items').select('*').eq('sale_id', id),
        supabase.from('system_settings').select('*').single(),
      ]);

      if (saleRes.error) {
        console.error('Erro ao carregar venda:', saleRes.error);
      } else {
        setSale(saleRes.data);
      }

      if (itemsRes.error) {
        console.error('Erro ao carregar itens:', itemsRes.error);
      } else {
        setItems(itemsRes.data || []);
      }

      if (settingsRes.data) {
        setSettings(settingsRes.data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: { [key: string]: string } = {
      dinheiro: 'Dinheiro',
      cartao_credito: 'Cartão de Crédito',
      cartao_debito: 'Cartão de Débito',
      pix: 'PIX',
    };
    return labels[method] || method;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <i className="ri-file-warning-line text-6xl text-gray-400 mb-4"></i>
          <p className="text-gray-600">Venda não encontrada</p>
          <button
            onClick={() => window.close()}
            className="mt-4 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition whitespace-nowrap cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

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
          .print-receipt { width: 80mm; }
        }
        @page { margin: 0; }
      `}</style>

      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
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

      <div className="print-receipt bg-white p-4 mx-auto my-8 shadow-lg" style={{ width: '80mm' }}>
        <div className="text-center border-b-2 border-dashed border-gray-400 pb-3 mb-3">
          {settings?.logo_url && (
            <img 
              src={settings.logo_url} 
              alt="Logo" 
              className="h-12 w-auto mx-auto mb-2"
            />
          )}
          <h1 className="text-xl font-bold">{settings?.company_name || 'CAR TYPE MOTORS'}</h1>
          <p className="text-xs">Centro Automotivo</p>
          {settings?.cnpj && <p className="text-xs mt-1">CNPJ: {settings.cnpj}</p>}
          {settings?.phone && <p className="text-xs">Tel: {settings.phone}</p>}
          {settings?.email && <p className="text-xs">{settings.email}</p>}
          {fullAddress && <p className="text-xs">{fullAddress}</p>}
        </div>

        <div className="text-center mb-3">
          <p className="text-sm font-bold">CUPOM NÃO FISCAL</p>
          <p className="text-xs">{sale.sale_number}</p>
          <p className="text-xs">{new Date(sale.created_at).toLocaleString('pt-BR')}</p>
        </div>

        {sale.customer_name && (
          <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
            <p className="text-xs font-bold mb-1">CLIENTE</p>
            <p className="text-xs">{sale.customer_name}</p>
            {sale.customer_phone && <p className="text-xs">{sale.customer_phone}</p>}
          </div>
        )}

        <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
          <p className="text-xs font-bold mb-2">ITENS</p>
          {items.map((item, index) => (
            <div key={index} className="mb-2">
              <div className="flex justify-between text-xs">
                <span className="font-medium">{item.product_name}</span>
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
            <span>Subtotal:</span>
            <span>R$ {sale.subtotal.toFixed(2)}</span>
          </div>
          {sale.discount > 0 && (
            <div className="flex justify-between text-xs mb-1">
              <span>Desconto:</span>
              <span>- R$ {sale.discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm border-t border-gray-400 pt-1 mt-1">
            <span>TOTAL:</span>
            <span>R$ {sale.total_amount.toFixed(2)}</span>
          </div>
        </div>

        <div className="text-center text-xs border-t border-dashed border-gray-400 pt-2 mb-3">
          <p>Forma de Pagamento:</p>
          <p className="font-bold">{getPaymentMethodLabel(sale.payment_method)}</p>
        </div>

        <div className="text-center text-xs">
          <p className="mb-2">Obrigado pela preferência!</p>
          <p>Volte sempre!</p>
        </div>
      </div>
    </>
  );
}
