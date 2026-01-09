import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Sidebar from '../../components/layout/Sidebar';
import MobileTopBar from '../../components/layout/MobileTopBar';

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  unit_price: number;
  cost_price: number;
  stock_quantity: number;
  min_stock: number;
  sku: string;
  active: boolean;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'pneu',
    unit_price: '',
    cost_price: '',
    stock_quantity: '',
    min_stock: '',
    sku: '',
    active: true,
  });

  const categories = [
    { value: 'pneu', label: 'Pneus' },
    { value: 'oleo', label: 'Óleos e Lubrificantes' },
    { value: 'filtro', label: 'Filtros' },
    { value: 'bateria', label: 'Baterias' },
    { value: 'pastilha', label: 'Pastilhas e Lonas' },
    { value: 'lampada', label: 'Lâmpadas' },
    { value: 'peca', label: 'Peças Diversas' },
    { value: 'acessorio', label: 'Acessórios' },
    { value: 'servico', label: 'Serviços' },
  ];

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const productData = {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        unit_price: parseFloat(formData.unit_price),
        cost_price: parseFloat(formData.cost_price || '0'),
        stock_quantity: parseInt(formData.stock_quantity),
        min_stock: parseInt(formData.min_stock),
        sku: formData.sku.trim() || null, // Se estiver vazio, salva null ao invés de string vazia
        active: formData.active,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .insert([productData]);

        if (error) throw error;
      }

      setShowModal(false);
      resetForm();
      fetchProducts();
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      alert('Erro ao salvar produto');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      category: product.category,
      unit_price: product.unit_price.toString(),
      cost_price: (product.cost_price || 0).toString(),
      stock_quantity: product.stock_quantity.toString(),
      min_stock: product.min_stock.toString(),
      sku: product.sku || '',
      active: product.active,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchProducts();
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
      alert('Erro ao excluir produto');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'pneu',
      unit_price: '',
      cost_price: '',
      stock_quantity: '',
      min_stock: '',
      sku: '',
      active: true,
    });
    setEditingProduct(null);
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || product.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryLabel = (value: string) => {
    return categories.find(c => c.value === value)?.label || value;
  };

  const calculateMargin = (salePrice: number, costPrice: number) => {
    if (!costPrice || costPrice === 0) return 0;
    return ((salePrice - costPrice) / salePrice) * 100;
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 overflow-auto md:ml-64">
        <MobileTopBar />
        <div className="p-4 md:p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Produtos</h1>
              <p className="text-gray-600 mt-1">Gerencie o catálogo de produtos e peças</p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 transition flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <i className="ri-add-line text-xl"></i>
              Novo Produto
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input
                  type="text"
                  placeholder="Buscar por nome ou SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              </div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
              >
                <option value="all">Todas as Categorias</option>
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">SKU</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Produto</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Categoria</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Custo</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Preço Venda</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Margem</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Estoque</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Status</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredProducts.map((product) => {
                      const margin = calculateMargin(product.unit_price, product.cost_price || 0);
                      return (
                        <tr key={product.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{product.sku || '-'}</td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{product.name}</div>
                            {product.description && (
                              <div className="text-sm text-gray-500 mt-1 max-w-xs truncate">{product.description}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{getCategoryLabel(product.category)}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                            R$ {(product.cost_price || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                            R$ {product.unit_price.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-medium ${
                              margin > 30 ? 'text-green-600' : margin > 15 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {margin.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-medium ${
                              product.stock_quantity <= product.min_stock 
                                ? 'text-red-600' 
                                : 'text-gray-900'
                            }`}>
                              {product.stock_quantity}
                            </span>
                            {product.stock_quantity <= product.min_stock && (
                              <span className="ml-2 text-xs text-red-600">
                                <i className="ri-alert-line"></i> Baixo
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              product.active 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {product.active ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            <button
                              onClick={() => handleEdit(product)}
                              className="text-teal-600 hover:text-teal-700 mr-3 cursor-pointer"
                            >
                              <i className="ri-edit-line text-lg"></i>
                            </button>
                            <button
                              onClick={() => handleDelete(product.id)}
                              className="text-red-600 hover:text-red-700 cursor-pointer"
                            >
                              <i className="ri-delete-bin-line text-lg"></i>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredProducts.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <i className="ri-inbox-line text-5xl mb-4"></i>
                  <p>Nenhum produto encontrado</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingProduct ? 'Editar Produto' : 'Novo Produto'}
                </h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <i className="ri-close-line text-2xl"></i>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome do Produto *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    placeholder="Ex: Pneu Michelin 205/55 R16"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descrição
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    placeholder="Descrição detalhada do produto..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SKU
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    placeholder="Código do produto"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Categoria *
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                  >
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preço de Custo (R$) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.cost_price}
                      onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                      placeholder="0,00"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Valor que você paga pelo produto</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preço de Venda (R$) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.unit_price}
                      onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                      placeholder="0,00"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Valor que você cobra do cliente</p>
                </div>

                {formData.cost_price && formData.unit_price && (
                  <div className="md:col-span-2 bg-teal-50 border border-teal-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Margem de Lucro</p>
                        <p className="text-xs text-gray-600 mt-1">
                          Lucro: R$ {(parseFloat(formData.unit_price) - parseFloat(formData.cost_price)).toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl font-bold ${
                          calculateMargin(parseFloat(formData.unit_price), parseFloat(formData.cost_price)) > 30 
                            ? 'text-green-600' 
                            : calculateMargin(parseFloat(formData.unit_price), parseFloat(formData.cost_price)) > 15 
                            ? 'text-yellow-600' 
                            : 'text-red-600'
                        }`}>
                          {calculateMargin(parseFloat(formData.unit_price), parseFloat(formData.cost_price)).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantidade em Estoque *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estoque Mínimo *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.min_stock}
                    onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">Alerta quando atingir este valor</p>
                </div>

                <div className="md:col-span-2 flex items-center">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
                    />
                    <span className="ml-2 text-sm text-gray-700">Produto Ativo</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition whitespace-nowrap cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition whitespace-nowrap cursor-pointer"
                >
                  {editingProduct ? 'Salvar Alterações' : 'Criar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
