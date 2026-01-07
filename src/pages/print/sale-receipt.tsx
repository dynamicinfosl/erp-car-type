
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface Sale {
  id: string;
  customer_id: string;
  sale_date: string;
  total_amount: number;
  discount: number;
  final_amount: number;
  payment_method: string;
  status: string;
  notes: string;
  created_at: string;
  service_order_id?: string;
  customers?: {
    name: string;
    phone: string;
    email?: string;
  };
}

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
  products?: {
    name: string;
  };
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

export default function SaleReceipt() {
  const { id, type } = useParams();
  const [sale, setSale] = useState<Sale | POSSale | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [printFormat, setPrintFormat] = useState<'a4' | 'receipt'>('receipt');

  useEffect(() => {
    loadData();
  }, [id, type]);

  const loadData = async () => {
    try {
      if (!id || !type) {
        console.error('ID ou tipo não fornecido');
        setLoading(false);
        return;
      }

      let saleData = null;
      let itemsData: any[] = [];

      if (type === 'pos') {
        const { data: posData, error: posError } = await supabase
          .from('pos_sales')
          .select('*')
          .eq('id', id)
          .single();

        if (posError) throw posError;
        saleData = posData;

        const { data: posItems, error: itemsError } = await supabase
          .from('pos_sale_items')
          .select('*')
          .eq('sale_id', id);

        if (itemsError) throw itemsError;
        itemsData = posItems || [];
      } else {
        const { data: regularData, error: regularError } = await supabase
          .from('sales')
          .select('*, customers(name, phone, email)')
          .eq('id', id)
          .single();

        if (regularError) throw regularError;
        saleData = regularData;

        const { data: regularItems, error: itemsError } = await supabase
          .from('sale_items')
          .select('*, products(name)')
          .eq('sale_id', id);

        if (itemsError) throw itemsError;
        itemsData = (regularItems || []).map(item => ({
          ...item,
          product_name: item.products?.name || 'Produto'
        }));
      }

      const { data: settingsData } = await supabase
        .from('system_settings')
        .select('*')
        .single();

      setSale(saleData);
      setItems(itemsData);
      setSettings(settingsData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      alert('Erro ao carregar dados da venda');
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
      transferencia: 'Transferência',
      multiplo: 'Múltiplas Formas',
      'Venda na OS': 'Venda na OS',
    };
    return labels[method] || method;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
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

  const isPOS = type === 'pos';
  const customerName = isPOS 
    ? (sale as POSSale).customer_name || 'Cliente Avulso'
    : (sale as Sale).customers?.name || 'Cliente Avulso';
  const customerPhone = isPOS
    ? (sale as POSSale).customer_phone
    : (sale as Sale).customers?.phone;
  const saleDate = sale.created_at;
  const subtotal = isPOS ? (sale as POSSale).subtotal : (sale as Sale).total_amount;
  const discount = sale.discount || 0;
  const total = isPOS ? (sale as POSSale).total_amount : (sale as Sale).final_amount;
  const saleNumber = isPOS ? (sale as POSSale).sale_number : `#${sale.id.substring(0, 8).toUpperCase()}`;
  const notes = !isPOS ? (sale as Sale).notes : '';

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; }
          .print-a4 { width: 210mm; min-height: 297mm; }
          .print-receipt { width: 80mm; }
        }
        @page { margin: 0; }
      `}</style>

      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <select
          value={printFormat}
          onChange={(e) => setPrintFormat(e.target.value as 'a4' | 'receipt')}
          className="px-4 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer"
        >
          <option value="receipt">Formato Cupom (80mm)</option>
          <option value="a4">Formato A4</option>
        </select>
        <button
          onClick={handlePrint}
          className="px-6 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition flex items-center gap-2 whitespace-nowrap cursor-pointer"
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
        <div className="print-a4 bg-white p-12 mx-auto my-8 shadow-lg">
          <div className="border-b-4 border-teal-500 pb-6 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-4 mb-3">
                  {settings?.logo_url && (
                    <img 
                      src={settings.logo_url} 
                      alt="Logo" 
                      className="h-16 w-auto"
                    />
                  )}
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">{settings?.company_name || 'CAR TYPE MOTORS'}</h1>
                    <p className="text-gray-600">Centro Automotivo</p>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  {settings?.cnpj && <p>CNPJ: {settings.cnpj}</p>}
                  {settings?.phone && <p>Telefone: {settings.phone}</p>}
                  {settings?.email && <p>Email: {settings.email}</p>}
                  {fullAddress && <p>{fullAddress}</p>}
                </div>
              </div>
              <div className="text-right">
                <div className="bg-gradient-to-r from-teal-500 to-teal-600 text-white px-4 py-2 rounded-lg inline-block mb-2">
                  <p className="text-sm font-medium">CUPOM DE VENDA</p>
                  <p className="text-2xl font-bold">{saleNumber}</p>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Data: {new Date(saleDate).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg mb-8">
            <h3 className="font-bold text-gray-900 mb-3 text-lg">Dados do Cliente</h3>
            <p className="text-gray-900 font-semibold">{customerName}</p>
            {customerPhone && (
              <p className="text-gray-600 text-sm mt-1">Telefone: {customerPhone}</p>
            )}
          </div>

          {notes && (
            <div className="mb-8">
              <h3 className="font-bold text-gray-900 mb-2 text-lg">Observações</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-700">{notes}</p>
              </div>
            </div>
          )}

          <div className="mb-8">
            <h3 className="font-bold text-gray-900 mb-4 text-lg">Itens da Venda</h3>
            <table className="w-full border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 px-4 py-3 text-left text-sm font-semibold">Produto</th>
                  <th className="border border-gray-300 px-4 py-3 text-center text-sm font-semibold">Qtd</th>
                  <th className="border border-gray-300 px-4 py-3 text-right text-sm font-semibold">Valor Unit.</th>
                  <th className="border border-gray-300 px-4 py-3 text-right text-sm font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index}>
                    <td className="border border-gray-300 px-4 py-2 text-sm">{item.product_name}</td>
                    <td className="border border-gray-300 px-4 py-2 text-sm text-center">{item.quantity}</td>
                    <td className="border border-gray-300 px-4 py-2 text-sm text-right">
                      R$ {item.unit_price.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-sm text-right font-medium">
                      R$ {item.total_price.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end mb-8">
            <div className="w-80">
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">R$ {subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Desconto:</span>
                    <span className="text-red-600">- R$ {discount.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div className="border-t-2 border-gray-300 pt-2">
                <div className="flex justify-between text-xl font-bold">
                  <span>TOTAL:</span>
                  <span className="text-teal-600">R$ {total.toFixed(2)}</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Forma de Pagamento: <span className="font-semibold">{getPaymentMethodLabel(sale.payment_method)}</span>
              </p>
            </div>
          </div>

          <div className="border-t-2 border-gray-300 pt-6 mt-12">
            <div className="border-t border-gray-400 pt-2 mt-16 w-1/2 mx-auto">
              <p className="text-center text-sm text-gray-600">Assinatura do Cliente</p>
            </div>
          </div>

          <div className="text-center text-xs text-gray-500 mt-8">
            <p>Este documento é válido como comprovante de venda</p>
            <p className="mt-1">{settings?.company_name || 'Car Type Motors'} - Centro Automotivo</p>
          </div>
        </div>
      ) : (
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
            <p className="text-sm font-bold">CUPOM DE VENDA</p>
            <p className="text-lg font-bold">{saleNumber}</p>
            <p className="text-xs">{new Date(saleDate).toLocaleString('pt-BR')}</p>
          </div>

          <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
            <p className="text-xs font-bold mb-1">CLIENTE</p>
            <p className="text-xs">{customerName}</p>
            {customerPhone && <p className="text-xs">{customerPhone}</p>}
          </div>

          {notes && (
            <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
              <p className="text-xs font-bold mb-1">OBSERVAÇÕES</p>
              <p className="text-xs">{notes}</p>
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
              <span>R$ {subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-xs mb-1">
                <span>Desconto:</span>
                <span>- R$ {discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm border-t border-gray-400 pt-1 mt-1">
              <span>TOTAL:</span>
              <span>R$ {total.toFixed(2)}</span>
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
      )}
    </>
  );
}
