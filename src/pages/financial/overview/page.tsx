
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import Sidebar from '../../../components/layout/Sidebar';
import MobileTopBar from '../../../components/layout/MobileTopBar';

interface FinancialSummary {
  totalReceivables: number;
  totalReceived: number;
  totalPayables: number;
  totalPaid: number;
  balance: number;
}

export default function FinancialOverview() {
  const [loading, setLoading] = useState(true);
  const formatBRL = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  const [summary, setSummary] = useState<FinancialSummary>({
    totalReceivables: 0,
    totalReceived: 0,
    totalPayables: 0,
    totalPaid: 0,
    balance: 0,
  });

  useEffect(() => {
    loadFinancialSummary();
  }, []);

  const loadFinancialSummary = async () => {
    try {
      const [revenuesRes, expensesRes] = await Promise.all([
        supabase.from('revenues').select('amount, status'),
        supabase.from('expenses').select('amount, status'),
      ]);

      if (revenuesRes.error) throw revenuesRes.error;
      if (expensesRes.error) throw expensesRes.error;

      const revenues = revenuesRes.data || [];
      const expenses = expensesRes.data || [];

      const totalReceived = revenues
        .filter(r => r.status === 'received')
        .reduce((sum, r) => sum + (r.amount || 0), 0);

      const totalReceivables = revenues
        .filter(r => r.status === 'pending')
        .reduce((sum, r) => sum + (r.amount || 0), 0);

      const totalPaid = expenses
        .filter(e => e.status === 'paid')
        .reduce((sum, e) => sum + (e.amount || 0), 0);

      const totalPayables = expenses
        .filter(e => e.status === 'pending')
        .reduce((sum, e) => sum + (e.amount || 0), 0);

      setSummary({
        totalReceivables,
        totalReceived,
        totalPayables,
        totalPaid,
        balance: totalReceived - totalPaid,
      });
    } catch (error) {
      console.error('Erro ao carregar resumo financeiro:', error);
      // Optionally set error state or show user notification
    } finally {
      setLoading(false);
    }
  };

  const handleNavigation = (path: string) => {
    try {
      if (typeof window.REACT_APP_NAVIGATE === 'function') {
        window.REACT_APP_NAVIGATE(path);
      } else {
        console.warn('Navigation function not available');
        // Fallback navigation if needed
        window.location.href = path;
      }
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 overflow-auto md:ml-64">
        <MobileTopBar />
        <div className="p-4 md:p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Visão Geral Financeira</h1>
            <p className="text-gray-600 mt-1">Resumo completo das finanças</p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Recebido</h3>
                  <div className="w-10 h-10 flex items-center justify-center bg-green-100 rounded-lg">
                    <i className="ri-arrow-down-line text-green-600 text-xl"></i>
                  </div>
                </div>
                <p className="text-3xl font-bold text-green-600">
                  {formatBRL(summary.totalReceived)}
                </p>
                <p className="text-sm text-gray-500 mt-2">Total de receitas recebidas</p>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">A Receber</h3>
                  <div className="w-10 h-10 flex items-center justify-center bg-blue-100 rounded-lg">
                    <i className="ri-time-line text-blue-600 text-xl"></i>
                  </div>
                </div>
                <p className="text-3xl font-bold text-blue-600">
                  {formatBRL(summary.totalReceivables)}
                </p>
                <p className="text-sm text-gray-500 mt-2">Receitas pendentes</p>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-red-500">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Pago</h3>
                  <div className="w-10 h-10 flex items-center justify-center bg-red-100 rounded-lg">
                    <i className="ri-arrow-up-line text-red-600 text-xl"></i>
                  </div>
                </div>
                <p className="text-3xl font-bold text-red-600">
                  {formatBRL(summary.totalPaid)}
                </p>
                <p className="text-sm text-gray-500 mt-2">Total de despesas pagas</p>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-orange-500">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">A Pagar</h3>
                  <div className="w-10 h-10 flex items-center justify-center bg-orange-100 rounded-lg">
                    <i className="ri-time-line text-orange-600 text-xl"></i>
                  </div>
                </div>
                <p className="text-3xl font-bold text-orange-600">
                  {formatBRL(summary.totalPayables)}
                </p>
                <p className="text-sm text-gray-500 mt-2">Despesas pendentes</p>
              </div>

              <div className={`bg-white rounded-xl shadow-sm p-6 border-l-4 ${
                summary.balance >= 0 ? 'border-green-500' : 'border-red-500'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Saldo</h3>
                  <div className={`w-10 h-10 flex items-center justify-center rounded-lg ${
                    summary.balance >= 0 ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    <i className={`ri-wallet-line text-xl ${
                      summary.balance >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}></i>
                  </div>
                </div>
                <p className={`text-3xl font-bold ${
                  summary.balance >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatBRL(summary.balance)}
                </p>
                <p className="text-sm text-gray-500 mt-2">Receitas - Despesas</p>
              </div>

              <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow-sm p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium">Total Geral</h3>
                  <div className="w-10 h-10 flex items-center justify-center bg-white/20 rounded-lg">
                    <i className="ri-money-dollar-circle-line text-white text-xl"></i>
                  </div>
                </div>
                <p className="text-3xl font-bold">
                  {formatBRL(summary.totalReceived + summary.totalReceivables)}
                </p>
                <p className="text-sm opacity-90 mt-2">Receitas totais (recebidas + a receber)</p>
              </div>
            </div>
          )}

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Ações Rápidas</h3>
              <div className="space-y-3">
                <button
                  onClick={() => handleNavigation('/financial/receivables')}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center bg-green-100 rounded-lg">
                      <i className="ri-arrow-down-line text-green-600"></i>
                    </div>
                    <span className="font-medium text-gray-900">Contas a Receber</span>
                  </div>
                  <i className="ri-arrow-right-s-line text-gray-400"></i>
                </button>

                <button
                  onClick={() => handleNavigation('/financial/payables')}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center bg-red-100 rounded-lg">
                      <i className="ri-arrow-up-line text-red-600"></i>
                    </div>
                    <span className="font-medium text-gray-900">Contas a Pagar</span>
                  </div>
                  <i className="ri-arrow-right-s-line text-gray-400"></i>
                </button>

                <button
                  onClick={() => handleNavigation('/financial/cash-flow')}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center bg-blue-100 rounded-lg">
                      <i className="ri-line-chart-line text-blue-600"></i>
                    </div>
                    <span className="font-medium text-gray-900">Fluxo de Caixa</span>
                  </div>
                  <i className="ri-arrow-right-s-line text-gray-400"></i>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Dicas Financeiras</h3>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 flex items-center justify-center bg-orange-100 rounded-lg flex-shrink-0">
                    <i className="ri-lightbulb-line text-orange-600"></i>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Mantenha o controle</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Registre todas as receitas e despesas diariamente
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-8 h-8 flex items-center justify-center bg-orange-100 rounded-lg flex-shrink-0">
                    <i className="ri-calendar-check-line text-orange-600"></i>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Acompanhe vencimentos</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Fique atento às datas de pagamento e recebimento
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-8 h-8 flex items-center justify-center bg-orange-100 rounded-lg flex-shrink-0">
                    <i className="ri-pie-chart-line text-orange-600"></i>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Analise relatórios</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Use os relatórios para tomar decisões estratégicas
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
