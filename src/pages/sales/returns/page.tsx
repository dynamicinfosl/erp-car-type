import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import Sidebar from '../../../components/layout/Sidebar';
import MobileTopBar from '../../../components/layout/MobileTopBar';

interface Return {
  id: string;
  sale_id: string;
  sale_type: string;
  customer_name: string;
  return_date: string;
  total_amount: number;
  reason: string;
  status: string;
  items: ReturnItem[];
}

interface ReturnItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Sale {
  id: string;
  type: string;
  customer: string;
  date: string;
  total: number;
  items: any[];
}

export default function Returns() {
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [returnReason, setReturnReason] = useState('');
  const [returnType, setReturnType] = useState<'full' | 'partial'>('full');

  useEffect(() => {
    fetchReturns();
  }, []);

  const fetchReturns = async () => {
    try {
      const { data, error } = await supabase
        .from('returns')
        .select('*')
        .order('return_date', { ascending: false });

      if (error) throw error;

      // Buscar itens de cada devolução
      const returnsWithItems = await Promise.all(
        (data || []).map(async (ret) => {
          const { data: items } = await supabase
            .from('return_items')
            .select('*')
            .eq('return_id', ret.id);

          return {
            ...ret,
            items: items || [],
          };
        })
      );

      setReturns(returnsWithItems);
    } catch (error) {
      console.error('Erro ao carregar devoluções:', error);
    } finally {
      setLoading(false);
    }
  };

  const openReturnModal = async (sale: any) => {
    try {
      let saleItems: any[] = [];

      if (sale.type === 'pos') {
        const { data } = await supabase
          .from('pos_sale_items')
          .select('*')
          .eq('sale_id', sale.id);
        saleItems = data || [];
      } else {
        const { data } = await supabase
          .from('sale_items')
          .select('*')
          .eq('sale_id', sale.id);
        saleItems = data || [];
      }

      setSelectedSale({
        ...sale,
        items: saleItems,
      });

      // Inicializar itens de devolução com todos os itens da venda
      setReturnItems(
        saleItems.map((item) => ({
          product_id: item.product_id || '',
          product_name: item.product_name || '',
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        }))
      );

      setShowModal(true);
    } catch (error) {
      console.error('Erro ao abrir modal de devolução:', error);
      alert('Erro ao carregar dados da venda');
    }
  };

  const updateReturnItemQuantity = (index: number, newQuantity: number) => {
    const newItems = [...returnItems];
    newItems[index].quantity = newQuantity;
    newItems[index].total_price = newQuantity * newItems[index].unit_price;
    setReturnItems(newItems);
  };

  const handleSubmitReturn = async () => {
    if (!selectedSale) return;
    if (!returnReason.trim()) {
      alert('Por favor, informe o motivo da devolução');
      return;
    }

    const itemsToReturn = returnItems.filter((item) => item.quantity > 0);
    if (itemsToReturn.length === 0) {
      alert('Selecione pelo menos um item para devolução');
      return;
    }

    try {
      const totalAmount = itemsToReturn.reduce(
        (sum, item) => sum + item.total_price,
        0
      );

      // Criar registro de devolução
      const { data: returnData, error: returnError } = await supabase
        .from('returns')
        .insert([
          {
            sale_id: selectedSale.id,
            sale_type: selectedSale.type,
            customer_name: selectedSale.customer,
            total_amount: totalAmount,
            reason: returnReason,
            status: 'completed',
          },
        ])
        .select()
        .single();

      if (returnError) throw returnError;

      // Inserir itens da devolução
      const { error: itemsError } = await supabase.from('return_items').insert(
        itemsToReturn.map((item) => ({
          return_id: returnData.id,
          product_id: item.product_id || null,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        }))
      );

      if (itemsError) throw itemsError;

      // Devolver produtos ao estoque
      for (const item of itemsToReturn) {
        if (item.product_id) {
          // Produto com ID (venda regular)
          const { data: productData } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', item.product_id)
            .single();

          if (productData) {
            await supabase
              .from('products')
              .update({
                stock_quantity: productData.stock_quantity + item.quantity,
              })
              .eq('id', item.product_id);

            // Registrar movimento de estoque
            await supabase.from('stock_movements').insert([
              {
                product_id: item.product_id,
                movement_type: 'in',
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_value: item.total_price,
                reason: 'Devolução',
                reference_id: returnData.id,
                reference_type: 'return',
              },
            ]);
          }
        } else {
          // Produto sem ID (venda PDV - buscar pelo nome)
          const { data: productData } = await supabase
            .from('products')
            .select('id, stock_quantity')
            .eq('name', item.product_name)
            .single();

          if (productData) {
            await supabase
              .from('products')
              .update({
                stock_quantity: productData.stock_quantity + item.quantity,
              })
              .eq('id', productData.id);

            // Registrar movimento de estoque
            await supabase.from('stock_movements').insert([
              {
                product_id: productData.id,
                movement_type: 'in',
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_value: item.total_price,
                reason: 'Devolução',
                reference_id: returnData.id,
                reference_type: 'return',
              },
            ]);
          }
        }
      }

      // Registrar despesa (devolução de dinheiro)
      await supabase.from('expenses').insert([
        {
          description: `Devolução - ${returnReason}`,
          amount: totalAmount,
          category: 'devolucao',
          date: new Date().toISOString(),
        },
      ]);

      setShowModal(false);
      setSelectedSale(null);
      setReturnItems([]);
      setReturnReason('');
      fetchReturns();
      alert('Devolução registrada com sucesso! Produtos devolvidos ao estoque.');
    } catch (error) {
      console.error('Erro ao registrar devolução:', error);
      alert('Erro ao registrar devolução');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: string } = {
      completed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    const labels: { [key: string]: string } = {
      completed: 'Concluída',
      pending: 'Pendente',
      cancelled: 'Cancelada',
    };
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          badges[status] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 overflow-auto md:ml-64">
        <MobileTopBar />
        <div className="p-4 md:p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Devoluções e Trocas
              </h1>
              <p className="text-gray-600 mt-1">
                Gerencie devoluções de produtos
              </p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                      Data
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                      Cliente
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                      Motivo
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                      Valor
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                      Itens
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {returns.map((ret) => (
                    <tr
                      key={ret.id}
                      className="hover:bg-gray-50 transition"
                    >
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(ret.return_date).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {ret.customer_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {ret.reason}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        R$ {ret.total_amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(ret.status)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {ret.items.length} item(s)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {returns.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <i className="ri-arrow-go-back-line text-5xl mb-4"></i>
                  <p>Nenhuma devolução registrada</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Nova Devolução */}
      {showModal && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                Registrar Devolução
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Cliente: {selectedSale.customer} | Data da Venda:{' '}
                {new Date(selectedSale.date).toLocaleDateString('pt-BR')}
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Tipo de Devolução */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Devolução
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="full"
                      checked={returnType === 'full'}
                      onChange={(e) =>
                        setReturnType(e.target.value as any)
                      }
                      className="w-4 h-4 text-teal-600 border-gray-300 focus:ring-teal-500 cursor-pointer"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Devolução Total
                    </span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="partial"
                      checked={returnType === 'partial'}
                      onChange={(e) =>
                        setReturnType(e.target.value as any)
                      }
                      className="w-4 h-4 text-teal-600 border-gray-300 focus:ring-teal-500 cursor-pointer"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Devolução Parcial
                    </span>
                  </label>
                </div>
              </div>

              {/* Motivo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo da Devolução *
                </label>
                <textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  rows={3}
                  placeholder="Descreva o motivo da devolução..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Itens */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Itens para Devolução
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-gray-600">
                        <th className="pb-2">Produto</th>
                        <th className="pb-2">Qtd Original</th>
                        <th className="pb-2">Qtd Devolver</th>
                        <th className="pb-2">Preço Unit.</th>
                        <th className="pb-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnItems.map((item, index) => (
                        <tr key={index} className="border-t border-gray-200">
                          <td className="py-2 text-sm">{item.product_name}</td>
                          <td className="py-2 text-sm">
                            {selectedSale.items[index]?.quantity || 0}
                          </td>
                          <td className="py-2">
                            <input
                              type="number"
                              min="0"
                              max={selectedSale.items[index]?.quantity || 0}
                              value={item.quantity}
                              onChange={(e) =>
                                updateReturnItemQuantity(
                                  index,
                                  parseInt(e.target.value) || 0
                                )
                              }
                              disabled={returnType === 'full'}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100"
                            />
                          </td>
                          <td className="py-2 text-sm">
                            R$ {item.unit_price.toFixed(2)}
                          </td>
                          <td className="py-2 text-sm font-medium">
                            R$ {item.total_price.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total */}
              <div className="bg-teal-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">
                    Total a Devolver:
                  </span>
                  <span className="text-2xl font-bold text-teal-600">
                    R${' '}
                    {returnItems
                      .reduce((sum, item) => sum + item.total_price, 0)
                      .toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedSale(null);
                  setReturnItems([]);
                  setReturnReason('');
                }}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition whitespace-nowrap cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitReturn}
                className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition whitespace-nowrap cursor-pointer"
              >
                Confirmar Devolução
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}