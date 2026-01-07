import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  type: 'revenue' | 'expense';
}

export default function CashFlow() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    loadTransactions();
  }, [startDate, endDate]);

  const loadTransactions = async () => {
    try {
      const { data: revenues, error: revenuesError } = await supabase
        .from('revenues')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('status', 'received');

      const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('status', 'paid');

      if (revenuesError) throw revenuesError;
      if (expensesError) throw expensesError;

      const allTransactions: Transaction[] = [
        ...(revenues || []).map(r => ({ ...r, type: 'revenue' as const })),
        ...(expenses || []).map(e => ({ ...e, type: 'expense' as const })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setTransactions(allTransactions);
    } catch (error) {
      console.error('Erro ao carregar transações:', error);
    }
  };

  const filteredTransactions = transactions.filter(t => 
    categoryFilter === 'all' || t.category === categoryFilter
  );

  const totalRevenues = filteredTransactions
    .filter(t => t.type === 'revenue')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalRevenues - totalExpenses;

  const categories = Array.from(new Set(transactions.map(t => t.category)));

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 overflow-auto ml-64">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Fluxo de Caixa</h1>
            <p className="text-gray-600">Visualize entradas e saídas do período</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total de Receitas</p>
                  <p className="text-2xl font-bold text-green-600">R$ {totalRevenues.toFixed(2)}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <i className="ri-arrow-up-line text-2xl text-green-600"></i>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total de Despesas</p>
                  <p className="text-2xl font-bold text-red-600">R$ {totalExpenses.toFixed(2)}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <i className="ri-arrow-down-line text-2xl text-red-600"></i>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Saldo do Período</p>
                  <p className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    R$ {balance.toFixed(2)}
                  </p>
                </div>
                <div className={`w-12 h-12 ${balance >= 0 ? 'bg-green-100' : 'bg-red-100'} rounded-lg flex items-center justify-center`}>
                  <i className={`ri-wallet-line text-2xl ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}></i>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Inicial</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Final</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none cursor-pointer"
                >
                  <option value="all">Todas as Categorias</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTransactions.map((transaction) => (
                  <tr key={`${transaction.type}-${transaction.id}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(transaction.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{transaction.description}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{transaction.category}</td>
                    <td className="px-6 py-4 text-center">
                      {transaction.type === 'revenue' ? (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 inline-flex items-center gap-1">
                          <i className="ri-arrow-up-line"></i>
                          Receita
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 inline-flex items-center gap-1">
                          <i className="ri-arrow-down-line"></i>
                          Despesa
                        </span>
                      )}
                    </td>
                    <td className={`px-6 py-4 text-sm font-semibold text-right ${
                      transaction.type === 'revenue' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.type === 'revenue' ? '+' : '-'} R$ {transaction.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                    Saldo do Período:
                  </td>
                  <td className={`px-6 py-4 text-right text-lg font-bold ${
                    balance >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    R$ {balance.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {filteredTransactions.length === 0 && (
              <div className="p-12 text-center">
                <i className="ri-line-chart-line text-6xl text-gray-300 mb-4"></i>
                <p className="text-gray-500 text-lg">Nenhuma transação encontrada no período</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
