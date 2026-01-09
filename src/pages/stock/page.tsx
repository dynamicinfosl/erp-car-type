import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Sidebar from '../../components/layout/Sidebar';
import MobileTopBar from '../../components/layout/MobileTopBar';

interface Product {
  id: string;
  name: string;
  stock_quantity: number;
  min_stock: number;
  unit_price: number;
}

interface StockMovement {
  id: string;
  product_id: string;
  movement_type: string;
  quantity: number;
  unit_price: number;
  total_value: number;
  reason: string;
  created_at: string;
  products: Product;
}

export default function Stock() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const formatBRL = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'movements'>('products');

  const [formData, setFormData] = useState({
    product_id: '',
    movement_type: 'in',
    quantity: '',
    unit_price: '',
    reason: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [productsRes, movementsRes] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase
          .from('stock_movements')
          .select('*, products(*)')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (movementsRes.error) throw movementsRes.error;

      setProducts(productsRes.data || []);
      setMovements(movementsRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const quantity = parseInt(formData.quantity);
      const unitPrice = parseFloat(formData.unit_price);
      const totalValue = quantity * unitPrice;

      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert([{
          product_id: formData.product_id,
          movement_type: formData.movement_type,
          quantity,
          unit_price: unitPrice,
          total_value: totalValue,
          reason: formData.reason,
        }]);

      if (movementError) throw movementError;

      const product = products.find(p => p.id === formData.product_id);
      if (product) {
        const newQuantity = formData.movement_type === 'in'
          ? product.stock_quantity + quantity
          : product.stock_quantity - quantity;

        const { error: updateError } = await supabase
          .from('products')
          .update({ stock_quantity: newQuantity })
          .eq('id', formData.product_id);

        if (updateError) throw updateError;
      }

      setShowModal(false);
      setFormData({
        product_id: '',
        movement_type: 'in',
        quantity: '',
        unit_price: '',
        reason: '',
      });
      fetchData();
    } catch (error) {
      console.error('Erro ao registrar movimentação:', error);
      alert('Erro ao registrar movimentação');
    }
  };

  const lowStockProducts = products.filter(p => p.stock_quantity <= p.min_stock);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 overflow-auto md:ml-64">
        <MobileTopBar />
        <div className="p-4 md:p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Controle de Estoque</h1>
              <p className="text-gray-600 mt-1">Gerencie entradas e saídas de produtos</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 transition flex items-center gap-2 whitespace-nowrap"
            >
              <i className="ri-add-line text-xl"></i>
              Nova Movimentação
            </button>
          </div>

          {lowStockProducts.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <i className="ri-alert-line text-red-600 text-xl mt-0.5"></i>
                <div>
                  <h3 className="font-semibold text-red-900 mb-2">Produtos com Estoque Baixo</h3>
                  <div className="space-y-1">
                    {lowStockProducts.map(product => (
                      <p key={product.id} className="text-sm text-red-800">
                        <strong>{product.name}</strong> - Estoque: {product.stock_quantity} (Mínimo: {product.min_stock})
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm mb-6">
            <div className="border-b border-gray-200">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('products')}
                  className={`px-6 py-4 font-medium transition ${
                    activeTab === 'products'
                      ? 'text-teal-600 border-b-2 border-teal-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Produtos em Estoque
                </button>
                <button
                  onClick={() => setActiveTab('movements')}
                  className={`px-6 py-4 font-medium transition ${
                    activeTab === 'movements'
                      ? 'text-teal-600 border-b-2 border-teal-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Histórico de Movimentações
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
              </div>
            ) : activeTab === 'products' ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Produto</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Estoque Atual</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Estoque Mínimo</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Valor Unitário</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Valor Total</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {products.map((product) => {
                      const totalValue = product.stock_quantity * product.unit_price;
                      const isLowStock = product.stock_quantity <= product.min_stock;
                      
                      return (
                        <tr key={product.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 font-medium text-gray-900">{product.name}</td>
                          <td className="px-6 py-4">
                            <span className={`font-semibold ${isLowStock ? 'text-red-600' : 'text-gray-900'}`}>
                              {product.stock_quantity}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-600">{product.min_stock}</td>
                          <td className="px-6 py-4 text-gray-900">{formatBRL(product.unit_price)}</td>
                          <td className="px-6 py-4 font-medium text-gray-900">{formatBRL(totalValue)}</td>
                          <td className="px-6 py-4">
                            {isLowStock ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <i className="ri-alert-line mr-1"></i> Baixo
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <i className="ri-checkbox-circle-line mr-1"></i> Normal
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Data</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Produto</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Tipo</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Quantidade</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Valor Total</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {movements.map((movement) => (
                      <tr key={movement.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(movement.created_at).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {movement.products?.name}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            movement.movement_type === 'in'
                              ? 'bg-green-100 text-green-800'
                              : movement.movement_type === 'out'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {movement.movement_type === 'in' && <i className="ri-arrow-down-line mr-1"></i>}
                            {movement.movement_type === 'out' && <i className="ri-arrow-up-line mr-1"></i>}
                            {movement.movement_type === 'adjustment' && <i className="ri-refresh-line mr-1"></i>}
                            {movement.movement_type === 'in' ? 'Entrada' : movement.movement_type === 'out' ? 'Saída' : 'Ajuste'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-900">{movement.quantity}</td>
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {formatBRL(movement.total_value)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{movement.reason || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Nova Movimentação</h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Produto *
                  </label>
                  <select
                    required
                    value={formData.product_id}
                    onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="">Selecione um produto</option>
                    {products.map(product => (
                      <option key={product.id} value={product.id}>
                        {product.name} (Estoque: {product.stock_quantity})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Movimentação *
                  </label>
                  <select
                    required
                    value={formData.movement_type}
                    onChange={(e) => setFormData({ ...formData, movement_type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="in">Entrada</option>
                    <option value="out">Saída</option>
                    <option value="adjustment">Ajuste</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantidade *
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Valor Unitário (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.unit_price}
                      onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Motivo
                  </label>
                  <input
                    type="text"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="Ex: Compra de fornecedor, venda, ajuste de inventário..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition whitespace-nowrap"
                >
                  Registrar Movimentação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
