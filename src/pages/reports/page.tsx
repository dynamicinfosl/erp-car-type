import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import MobileTopBar from '../../components/layout/MobileTopBar';

interface ReportData {
  sales: {
    total: number;
    count: number;
    byPaymentMethod: { method: string; total: number; count: number }[];
  };
  serviceOrders: {
    total: number;
    count: number;
    byStatus: { status: string; count: number }[];
  };
  revenues: {
    total: number;
    byCategory: { category: string; total: number }[];
  };
  expenses: {
    total: number;
    byCategory: { category: string; total: number }[];
  };
  profit: number;
}

export default function Reports() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const formatBRL = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

  const formatCount = (value: number) => new Intl.NumberFormat('pt-BR').format(Number(value || 0));

  const formatPaymentMethod = (method: string) => {
    const normalized = (method || '').toLowerCase();
    const map: Record<string, string> = {
      dinheiro: 'Dinheiro',
      pix: 'PIX',
      'cartao_credito': 'Cartão de Crédito',
      'cartao_debito': 'Cartão de Débito',
      'cartão de crédito': 'Cartão de Crédito',
      'cartão de débito': 'Cartão de Débito',
      transferencia: 'Transferência',
      transferência: 'Transferência',
      multiplo: 'Múltiplo',
      outros: 'Outros',
    };
    if (map[normalized]) return map[normalized];
    // fallback: replace underscores and capitalize words
    return normalized
      .replace(/_/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const [dateRange, setDateRange] = useState({
    // Avoid UTC issues when using toISOString() (can shift date depending on timezone)
    start: new Intl.DateTimeFormat('en-CA').format(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    end: new Intl.DateTimeFormat('en-CA').format(new Date()),
  });

  // UI: Datas em DD/MM/AAAA (sem depender do formato do navegador)
  const isoToBR = (iso: string) => {
    const [y, m, d] = (iso || '').split('-');
    if (!y || !m || !d) return '';
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  };

  const isValidISODate = (iso: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(`${iso}T00:00:00`);
    return dt.getFullYear() === y && dt.getMonth() + 1 === m && dt.getDate() === d;
  };

  const brToISO = (br: string) => {
    const digits = (br || '').replace(/\D/g, '').slice(0, 8);
    if (digits.length !== 8) return null;
    const d = digits.slice(0, 2);
    const m = digits.slice(2, 4);
    const y = digits.slice(4, 8);
    const iso = `${y}-${m}-${d}`;
    return isValidISODate(iso) ? iso : null;
  };

  const maskBRDate = (value: string) => {
    const digits = (value || '').replace(/\D/g, '').slice(0, 8);
    const d = digits.slice(0, 2);
    const m = digits.slice(2, 4);
    const y = digits.slice(4, 8);
    if (digits.length <= 2) return d;
    if (digits.length <= 4) return `${d}/${m}`;
    return `${d}/${m}/${y}`;
  };

  const [dateInput, setDateInput] = useState(() => ({
    start: isoToBR(new Intl.DateTimeFormat('en-CA').format(new Date(new Date().getFullYear(), new Date().getMonth(), 1))),
    end: isoToBR(new Intl.DateTimeFormat('en-CA').format(new Date())),
  }));

  const startPickerRef = useRef<HTMLInputElement | null>(null);
  const endPickerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadReports();
  }, [dateRange]);

  const loadReports = async () => {
    try {
      setLoading(true);

      // Build inclusive local date range (avoids timezone shifting)
      const startDate = new Date(`${dateRange.start}T00:00:00`).toISOString();
      const endDate = new Date(`${dateRange.end}T23:59:59.999`).toISOString();

      // Buscar receitas
      const { data: revenues, error: revenuesError } = await supabase
        .from('revenues')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      if (revenuesError) throw revenuesError;

      // Buscar despesas
      const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      if (expensesError) throw expensesError;

      // Buscar vendas do PDV
      const { data: posSales, error: posSalesError } = await supabase
        .from('pos_sales')
        .select(`
          *,
          pos_sale_items:pos_sale_items(
            *,
            product:products(cost_price)
          )
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (posSalesError) throw posSalesError;

      // Buscar ordens de serviço
      const { data: serviceOrders, error: osError } = await supabase
        .from('service_orders')
        .select(`
          *,
          service_order_items:service_order_items(*)
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (osError) throw osError;

      // Calcular totais de receitas
      const totalRevenues = revenues?.reduce((sum, r) => sum + r.amount, 0) || 0;
      
      // Agrupar receitas por categoria
      const revenuesByCategory: { [key: string]: number } = {};
      revenues?.forEach((r: any) => {
        const category = r.category || 'outros';
        revenuesByCategory[category] = (revenuesByCategory[category] || 0) + r.amount;
      });

      // Calcular totais de despesas
      const totalExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
      
      // Agrupar despesas por categoria
      const expensesByCategory: { [key: string]: number } = {};
      expenses?.forEach((e: any) => {
        const category = e.category || 'outros';
        expensesByCategory[category] = (expensesByCategory[category] || 0) + e.amount;
      });

      // Calcular vendas do PDV
      let posSalesTotal = 0;
      let posSalesCount = posSales?.length || 0;
      const posSalesByPayment: { [key: string]: { total: number; count: number } } = {};

      posSales?.forEach((sale: any) => {
        const total = parseFloat(sale.total_amount) || 0;
        posSalesTotal += total;
        
        const method = sale.payment_method || 'outros';
        if (!posSalesByPayment[method]) {
          posSalesByPayment[method] = { total: 0, count: 0 };
        }
        posSalesByPayment[method].total += total;
        posSalesByPayment[method].count += 1;
      });

      // Calcular ordens de serviço
      let osTotal = 0;
      let osCount = serviceOrders?.length || 0;
      const osByStatus: { [key: string]: number } = {};

      serviceOrders?.forEach((os: any) => {
        const total = parseFloat(os.final_amount || os.total_amount) || 0;
        osTotal += total;
        
        const status = os.status || 'in_diagnosis';
        osByStatus[status] = (osByStatus[status] || 0) + 1;
      });

      // Calcular lucro do PDV (para análise detalhada, mas não será somado ao lucro total)
      // NOTA: Vendas do PDV já criam entradas em 'revenues', então não devemos somar o lucro separadamente
      let posSalesProfit = 0;
      posSales?.forEach((sale: any) => {
        sale.pos_sale_items?.forEach((item: any) => {
          const cost = item.product?.cost_price || 0;
          const totalSale = item.total_price || (item.quantity * item.unit_price);
          const totalCost = cost * item.quantity;
          posSalesProfit += (totalSale - totalCost);
        });
      });

      // Calcular lucro das OSs (apenas produtos entregues) - para análise detalhada
      // NOTA: Produtos vendidos dentro de OSs já estão incluídos no valor total da OS,
      // e se a OS criar entrada em 'revenues', já está contabilizada. Não devemos somar separadamente.
      let osProfit = 0;
      serviceOrders?.forEach((os: any) => {
        if (os.status === 'delivered') {
          os.service_order_items?.forEach((item: any) => {
            // Filtrar apenas produtos (não serviços)
            if (item.item_type === 'product') {
              const cost = item.cost_price || 0;
              const totalSale = item.total_price || (item.quantity * item.unit_price);
              const totalCost = cost * item.quantity;
              osProfit += (totalSale - totalCost);
            }
          });
        }
      });

      // Lucro total = receitas - despesas
      // NÃO somamos lucros de produtos separadamente porque:
      // 1. Vendas do PDV já criam entradas em 'revenues' (receitas)
      // 2. Produtos vendidos dentro de OSs já estão no valor total da OS
      // Somar lucros separadamente causaria duplicação
      const totalProfit = totalRevenues - totalExpenses;

      // Montar dados do relatório
      setReportData({
        sales: {
          total: posSalesTotal,
          count: posSalesCount,
          byPaymentMethod: Object.entries(posSalesByPayment).map(([method, data]) => ({
            method,
            total: data.total,
            count: data.count,
          })),
        },
        serviceOrders: {
          total: osTotal,
          count: osCount,
          byStatus: Object.entries(osByStatus).map(([status, count]) => ({
            status,
            count,
          })),
        },
        revenues: {
          total: totalRevenues,
          byCategory: Object.entries(revenuesByCategory).map(([category, total]) => ({
            category,
            total,
          })),
        },
        expenses: {
          total: totalExpenses,
          byCategory: Object.entries(expensesByCategory).map(([category, total]) => ({
            category,
            total,
          })),
        },
        profit: totalProfit,
      });
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
    } finally {
      setLoading(false);
    }
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

  const getCategoryLabel = (category: string) => {
    const labels: { [key: string]: string } = {
      servico: 'Serviços',
      venda: 'Vendas',
      outros: 'Outros',
      pecas: 'Peças',
      salarios: 'Salários',
      aluguel: 'Aluguel',
      contas: 'Contas',
    };
    return labels[category] || category;
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 overflow-auto md:ml-64">
        <MobileTopBar />
        <div className="p-4 md:p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Relatórios</h1>
            <p className="text-gray-600 mt-1">Análise completa do desempenho do negócio</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Inicial
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={dateInput.start}
                    onChange={(e) => {
                      const masked = maskBRDate(e.target.value);
                      setDateInput((prev) => ({ ...prev, start: masked }));
                      const iso = brToISO(masked);
                      if (iso) setDateRange((prev) => ({ ...prev, start: iso }));
                    }}
                    placeholder="DD/MM/AAAA"
                    className="px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent w-[170px]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const el = startPickerRef.current as any;
                      if (!el) return;
                      if (typeof el.showPicker === 'function') el.showPicker();
                      else el.click();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-teal-600 cursor-pointer"
                    title="Selecionar data"
                  >
                    <i className="ri-calendar-line text-lg"></i>
                  </button>
                  <input
                    ref={startPickerRef}
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => {
                      const iso = e.target.value;
                      setDateRange((prev) => ({ ...prev, start: iso }));
                      setDateInput((prev) => ({ ...prev, start: isoToBR(iso) }));
                    }}
                    className="absolute inset-0 opacity-0 pointer-events-none"
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Final
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={dateInput.end}
                    onChange={(e) => {
                      const masked = maskBRDate(e.target.value);
                      setDateInput((prev) => ({ ...prev, end: masked }));
                      const iso = brToISO(masked);
                      if (iso) setDateRange((prev) => ({ ...prev, end: iso }));
                    }}
                    placeholder="DD/MM/AAAA"
                    className="px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent w-[170px]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const el = endPickerRef.current as any;
                      if (!el) return;
                      if (typeof el.showPicker === 'function') el.showPicker();
                      else el.click();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-teal-600 cursor-pointer"
                    title="Selecionar data"
                  >
                    <i className="ri-calendar-line text-lg"></i>
                  </button>
                  <input
                    ref={endPickerRef}
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => {
                      const iso = e.target.value;
                      setDateRange((prev) => ({ ...prev, end: iso }));
                      setDateInput((prev) => ({ ...prev, end: isoToBR(iso) }));
                    }}
                    className="absolute inset-0 opacity-0 pointer-events-none"
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                </div>
              </div>
              <button
                onClick={loadReports}
                className="mt-7 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition whitespace-nowrap"
              >
                <i className="ri-refresh-line mr-2"></i>
                Atualizar
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
            </div>
          ) : reportData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-600">Receitas</h3>
                    <i className="ri-arrow-up-line text-teal-600 text-xl"></i>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatBRL(reportData.revenues.total)}
                  </p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-600">Despesas</h3>
                    <i className="ri-arrow-down-line text-rose-600 text-xl"></i>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatBRL(reportData.expenses.total)}
                  </p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-600">Lucro</h3>
                    <i className={`ri-money-dollar-circle-line text-xl ${
                      reportData.profit >= 0 ? 'text-teal-600' : 'text-rose-600'
                    }`}></i>
                  </div>
                  <p className={`text-2xl font-bold ${
                    reportData.profit >= 0 ? 'text-teal-600' : 'text-rose-600'
                  }`}>
                    {formatBRL(reportData.profit)}
                  </p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-600">Vendas</h3>
                    <i className="ri-shopping-cart-line text-teal-600 text-xl"></i>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCount(reportData.sales.count)}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {formatBRL(reportData.sales.total)}
                  </p>
                </div>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <button
                  onClick={() => navigate('/reports/product-sales')}
                  className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition text-left cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-teal-500 to-teal-600 rounded-lg flex items-center justify-center">
                      <i className="ri-shopping-bag-line text-2xl text-white"></i>
                    </div>
                    <i className="ri-arrow-right-line text-2xl text-gray-400"></i>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Vendas por Produto</h3>
                  <p className="text-sm text-gray-600">
                    Análise detalhada de vendas, custos, lucros e margem por produto
                  </p>
                </button>

                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Vendas por Forma de Pagamento
                  </h3>
                  {reportData.sales.byPaymentMethod.length > 0 ? (
                    <div className="space-y-3">
                      {reportData.sales.byPaymentMethod.map((item: any) => (
                        <div key={item.method} className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-gray-900">{formatPaymentMethod(item.method)}</p>
                            <p className="text-sm text-gray-600">{formatCount(item.count)} vendas</p>
                          </div>
                          <p className="font-semibold text-gray-900">
                            {formatBRL(item.total)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Nenhuma venda no período selecionado.</p>
                  )}
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Ordens de Serviço por Status
                  </h3>
                  {reportData.serviceOrders.byStatus.length > 0 ? (
                    <div className="space-y-3">
                      {reportData.serviceOrders.byStatus.map((item: any) => (
                        <div key={item.status} className="flex justify-between items-center">
                          <p className="font-medium text-gray-900">{getStatusLabel(item.status)}</p>
                          <p className="font-semibold text-gray-900">{formatCount(item.count)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Nenhuma OS no período selecionado.</p>
                  )}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <p className="font-semibold text-gray-900">Total de OS</p>
                      <p className="font-bold text-teal-600">{formatCount(reportData.serviceOrders.count)}</p>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <p className="text-sm text-gray-600">Valor Total</p>
                      <p className="font-semibold text-gray-900">
                        {formatBRL(reportData.serviceOrders.total)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Receitas por Categoria
                  </h3>
                  {reportData.revenues.byCategory.length > 0 ? (
                    <div className="space-y-3">
                      {reportData.revenues.byCategory.map((item: any) => (
                        <div key={item.category} className="flex justify-between items-center">
                          <p className="font-medium text-gray-900">{getCategoryLabel(item.category)}</p>
                          <p className="font-semibold text-teal-700">
                            {formatBRL(item.total)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Nenhuma receita no período selecionado.</p>
                  )}
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Despesas por Categoria
                  </h3>
                  {reportData.expenses.byCategory.length > 0 ? (
                    <div className="space-y-3">
                      {reportData.expenses.byCategory.map((item: any) => (
                        <div key={item.category} className="flex justify-between items-center">
                          <p className="font-medium text-gray-900">{getCategoryLabel(item.category)}</p>
                          <p className="font-semibold text-rose-700">
                            {formatBRL(item.total)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Nenhuma despesa no período selecionado.</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
