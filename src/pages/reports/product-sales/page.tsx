import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import Sidebar from '../../../components/layout/Sidebar';

interface ProductSale {
  product_id: string;
  product_name: string;
  category: string;
  total_quantity: number;
  total_sales: number;
  average_cost: number;
  total_cost: number;
  total_profit: number;
  profit_margin: number;
}

interface DetailedSale {
  sale_date: string;
  order_id: string;
  customer_name: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  total_sale: number;
  total_cost: number;
  profit: number;
}

export default function ProductSalesReport() {
  const [loading, setLoading] = useState(true);
  const [productSales, setProductSales] = useState<ProductSale[]>([]);
  const [detailedSales, setDetailedSales] = useState<DetailedSale[]>([]);
  const [showDetailed, setShowDetailed] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1); // Primeiro dia do mês
    return date.toISOString().split('T')[0];
  });
  
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [filterCategory, setFilterCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

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
    loadProductSales();
  }, [startDate, endDate]);

  const loadProductSales = async () => {
    try {
      setLoading(true);

      // Buscar vendas de produtos das ordens de serviço
      const { data: osItems, error: osError } = await supabase
        .from('service_order_items')
        .select(`
          *,
          service_order:service_orders!inner(
            created_at,
            status
          ),
          product:products(
            name,
            category
          )
        `)
        .eq('item_type', 'product')
        .gte('service_order.created_at', startDate)
        .lte('service_order.created_at', endDate + 'T23:59:59')
        .in('service_order.status', ['delivered']);

      if (osError) throw osError;

      // Buscar vendas de produtos do PDV
      const { data: posItems, error: posError } = await supabase
        .from('pos_sale_items')
        .select(`
          *,
          pos_sale:pos_sales!inner(
            created_at
          ),
          product:products(
            name,
            category,
            cost_price
          )
        `)
        .gte('pos_sale.created_at', startDate)
        .lte('pos_sale.created_at', endDate + 'T23:59:59');

      if (posError) throw posError;

      // Processar dados
      const productMap = new Map<string, ProductSale>();

      // Processar itens de OS
      osItems?.forEach((item: any) => {
        if (!item.product_id) return;

        const key = item.product_id;
        const existing = productMap.get(key);
        
        const cost = item.cost_price || 0;
        const totalSale = item.total_price || (item.quantity * item.unit_price);
        const totalCost = cost * item.quantity;
        const profit = totalSale - totalCost;

        if (existing) {
          existing.total_quantity += item.quantity;
          existing.total_sales += totalSale;
          existing.total_cost += totalCost;
          existing.total_profit += profit;
          existing.average_cost = existing.total_cost / existing.total_quantity;
          existing.profit_margin = (existing.total_profit / existing.total_sales) * 100;
        } else {
          productMap.set(key, {
            product_id: item.product_id,
            product_name: item.product?.name || item.description,
            category: item.product?.category || 'outros',
            total_quantity: item.quantity,
            total_sales: totalSale,
            average_cost: cost,
            total_cost: totalCost,
            total_profit: profit,
            profit_margin: totalSale > 0 ? (profit / totalSale) * 100 : 0,
          });
        }
      });

      // Processar itens do PDV
      posItems?.forEach((item: any) => {
        if (!item.product_id) return;

        const key = item.product_id;
        const existing = productMap.get(key);
        
        const cost = item.product?.cost_price || 0;
        const totalSale = item.total_price || (item.quantity * item.unit_price);
        const totalCost = cost * item.quantity;
        const profit = totalSale - totalCost;

        if (existing) {
          existing.total_quantity += item.quantity;
          existing.total_sales += totalSale;
          existing.total_cost += totalCost;
          existing.total_profit += profit;
          existing.average_cost = existing.total_cost / existing.total_quantity;
          existing.profit_margin = (existing.total_profit / existing.total_sales) * 100;
        } else {
          productMap.set(key, {
            product_id: item.product_id,
            product_name: item.product?.name || item.product_name,
            category: item.product?.category || 'outros',
            total_quantity: item.quantity,
            total_sales: totalSale,
            average_cost: cost,
            total_cost: totalCost,
            total_profit: profit,
            profit_margin: totalSale > 0 ? (profit / totalSale) * 100 : 0,
          });
        }
      });

      const salesArray = Array.from(productMap.values());
      salesArray.sort((a, b) => b.total_sales - a.total_sales);
      
      setProductSales(salesArray);
    } catch (error) {
      console.error('Erro ao carregar relatório:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDetailedSales = async (productId: string) => {
    try {
      setLoading(true);
      setSelectedProduct(productId);

      // Buscar vendas detalhadas de OS
      const { data: osItems, error: osError } = await supabase
        .from('service_order_items')
        .select(`
          *,
          service_order:service_orders!inner(
            id,
            created_at,
            customer:customers(name)
          )
        `)
        .eq('product_id', productId)
        .gte('service_order.created_at', startDate)
        .lte('service_order.created_at', endDate + 'T23:59:59')
        .in('service_order.status', ['delivered']);

      if (osError) throw osError;

      // Buscar vendas detalhadas do PDV
      const { data: posItems, error: posError } = await supabase
        .from('pos_sale_items')
        .select(`
          *,
          pos_sale:pos_sales!inner(
            id,
            created_at,
            customer_name
          ),
          product:products(cost_price)
        `)
        .eq('product_id', productId)
        .gte('pos_sale.created_at', startDate)
        .lte('pos_sale.created_at', endDate + 'T23:59:59');

      if (posError) throw posError;

      const detailed: DetailedSale[] = [];

      // Processar OS
      osItems?.forEach((item: any) => {
        const cost = item.cost_price || 0;
        const totalSale = item.total_price || (item.quantity * item.unit_price);
        const totalCost = cost * item.quantity;

        detailed.push({
          sale_date: new Date(item.service_order.created_at).toLocaleDateString('pt-BR'),
          order_id: `OS-${item.service_order.id.slice(0, 8)}`,
          customer_name: item.service_order.customer?.name || 'N/A',
          quantity: item.quantity,
          unit_price: item.unit_price,
          cost_price: cost,
          total_sale: totalSale,
          total_cost: totalCost,
          profit: totalSale - totalCost,
        });
      });

      // Processar PDV
      posItems?.forEach((item: any) => {
        const cost = item.product?.cost_price || 0;
        const totalSale = item.total_price || (item.quantity * item.unit_price);
        const totalCost = cost * item.quantity;

        detailed.push({
          sale_date: new Date(item.pos_sale.created_at).toLocaleDateString('pt-BR'),
          order_id: `PDV-${item.pos_sale.id.slice(0, 8)}`,
          customer_name: item.pos_sale.customer_name || 'Cliente Avulso',
          quantity: item.quantity,
          unit_price: item.unit_price,
          cost_price: cost,
          total_sale: totalSale,
          total_cost: totalCost,
          profit: totalSale - totalCost,
        });
      });

      detailed.sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime());
      setDetailedSales(detailed);
      setShowDetailed(true);
    } catch (error) {
      console.error('Erro ao carregar vendas detalhadas:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryLabel = (value: string) => {
    return categories.find(c => c.value === value)?.label || value;
  };

  const filteredSales = productSales.filter(sale => {
    const matchesCategory = filterCategory === 'all' || sale.category === filterCategory;
    const matchesSearch = sale.product_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totals = filteredSales.reduce((acc, sale) => ({
    quantity: acc.quantity + sale.total_quantity,
    sales: acc.sales + sale.total_sales,
    cost: acc.cost + sale.total_cost,
    profit: acc.profit + sale.total_profit,
  }), { quantity: 0, sales: 0, cost: 0, profit: 0 });

  const overallMargin = totals.sales > 0 ? (totals.profit / totals.sales) * 100 : 0;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 overflow-auto ml-64">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Relatório de Vendas por Produto</h1>
            <p className="text-gray-600">Análise detalhada de vendas, custos e lucratividade</p>
          </div>

          {!showDetailed ? (
            <>
              {/* Filtros */}
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data Início</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data Fim</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent cursor-pointer"
                    >
                      <option value="all">Todas</option>
                      {categories.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Buscar Produto</label>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Nome do produto..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Cards de Resumo */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-600">Total Vendido</p>
                    <i className="ri-shopping-bag-line text-2xl text-blue-600"></i>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">R$ {totals.sales.toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mt-1">{totals.quantity} unidades</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-600">Custo Total</p>
                    <i className="ri-price-tag-3-line text-2xl text-orange-600"></i>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">R$ {totals.cost.toFixed(2)}</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-600">Lucro Total</p>
                    <i className="ri-money-dollar-circle-line text-2xl text-green-600"></i>
                  </div>
                  <p className="text-2xl font-bold text-green-600">R$ {totals.profit.toFixed(2)}</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-600">Margem Média</p>
                    <i className="ri-percent-line text-2xl text-purple-600"></i>
                  </div>
                  <p className="text-2xl font-bold text-purple-600">{overallMargin.toFixed(1)}%</p>
                </div>
              </div>

              {/* Tabela de Produtos */}
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
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Produto</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Categoria</th>
                          <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Qtd Vendida</th>
                          <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Custo Médio</th>
                          <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Total Vendas</th>
                          <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Lucro</th>
                          <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Margem</th>
                          <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredSales.map((sale) => (
                          <tr key={sale.product_id} className="hover:bg-gray-50 transition">
                            <td className="px-6 py-4">
                              <p className="font-medium text-gray-900">{sale.product_name}</p>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">{getCategoryLabel(sale.category)}</td>
                            <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">{sale.total_quantity}</td>
                            <td className="px-6 py-4 text-right text-sm text-gray-600">R$ {sale.average_cost.toFixed(2)}</td>
                            <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">R$ {sale.total_sales.toFixed(2)}</td>
                            <td className="px-6 py-4 text-right text-sm font-semibold text-green-600">R$ {sale.total_profit.toFixed(2)}</td>
                            <td className="px-6 py-4 text-right">
                              <span className={`text-sm font-semibold ${
                                sale.profit_margin > 30 ? 'text-green-600' : 
                                sale.profit_margin > 15 ? 'text-yellow-600' : 
                                'text-red-600'
                              }`}>
                                {sale.profit_margin.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => loadDetailedSales(sale.product_id)}
                                className="text-teal-600 hover:text-teal-700 cursor-pointer"
                                title="Ver detalhes"
                              >
                                <i className="ri-eye-line text-xl"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {filteredSales.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <i className="ri-inbox-line text-5xl mb-4"></i>
                      <p>Nenhuma venda encontrada no período</p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Vendas Detalhadas */}
              <div className="mb-6">
                <button
                  onClick={() => {
                    setShowDetailed(false);
                    setSelectedProduct(null);
                  }}
                  className="flex items-center gap-2 text-teal-600 hover:text-teal-700 cursor-pointer"
                >
                  <i className="ri-arrow-left-line"></i>
                  Voltar ao Resumo
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900">Vendas Detalhadas</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {productSales.find(p => p.product_id === selectedProduct)?.product_name}
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Data</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Pedido</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Cliente</th>
                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Qtd</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Custo Unit.</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Venda Unit.</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Total Venda</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Lucro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {detailedSales.map((sale, index) => (
                        <tr key={index} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 text-sm text-gray-900">{sale.sale_date}</td>
                          <td className="px-6 py-4 text-sm font-mono text-gray-900">{sale.order_id}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{sale.customer_name}</td>
                          <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">{sale.quantity}</td>
                          <td className="px-6 py-4 text-right text-sm text-gray-600">R$ {sale.cost_price.toFixed(2)}</td>
                          <td className="px-6 py-4 text-right text-sm text-gray-900">R$ {sale.unit_price.toFixed(2)}</td>
                          <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">R$ {sale.total_sale.toFixed(2)}</td>
                          <td className="px-6 py-4 text-right text-sm font-semibold text-green-600">R$ {sale.profit.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-right text-sm font-bold text-gray-900">TOTAIS:</td>
                        <td className="px-6 py-4 text-center text-sm font-bold text-gray-900">
                          {detailedSales.reduce((sum, s) => sum + s.quantity, 0)}
                        </td>
                        <td colSpan={2}></td>
                        <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">
                          R$ {detailedSales.reduce((sum, s) => sum + s.total_sale, 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-bold text-green-600">
                          R$ {detailedSales.reduce((sum, s) => sum + s.profit, 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
