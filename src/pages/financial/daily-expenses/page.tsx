import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import Toast from '../../../components/common/Toast';
import Sidebar from '../../../components/layout/Sidebar';
import MobileTopBar from '../../../components/layout/MobileTopBar';

interface DailyExpense {
  id: string;
  description: string;
  amount: number;
  date: string;
  created_at: string;
}

export default function DailyExpenses() {
  const formatBRL = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<DailyExpense | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadExpenses();
  }, [dateFilter]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    setToast({ message, type });
  };

  const getDateRange = (filter: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (filter) {
      case 'today':
        const todayStr = today.toISOString().split('T')[0];
        return { start: todayStr, end: todayStr };
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return {
          start: weekStart.toISOString().split('T')[0],
          end: weekEnd.toISOString().split('T')[0],
        };
      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return {
          start: monthStart.toISOString().split('T')[0],
          end: monthEnd.toISOString().split('T')[0],
        };
      case 'all':
        return null;
      default:
        return null;
    }
  };

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const dateRange = getDateRange(dateFilter);
      
      let query = supabase
        .from('expenses')
        .select('*')
        .eq('category', 'Gastos Diários')
        .order('date', { ascending: false });

      if (dateRange) {
        query = query.gte('date', dateRange.start).lte('date', dateRange.end);
      }

      const { data, error } = await query;

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('Erro ao carregar gastos diários:', error);
      showToast('Erro ao carregar gastos diários', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description || formData.amount <= 0) {
      showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    try {
      const expenseData = {
        description: formData.description,
        amount: formData.amount,
        category: 'Gastos Diários',
        date: formData.date,
        status: 'paid', // Gastos diários são sempre pagos
      };

      if (editingItem) {
        const { error } = await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', editingItem.id);

        if (error) throw error;
        showToast('Gasto atualizado com sucesso!', 'success');
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert([expenseData]);

        if (error) throw error;
        showToast('Gasto registrado com sucesso!', 'success');
      }

      resetForm();
      loadExpenses();
    } catch (error) {
      console.error('Erro ao salvar gasto:', error);
      showToast('Erro ao salvar gasto', 'error');
    }
  };

  const handleEdit = (item: DailyExpense) => {
    setEditingItem(item);
    setFormData({
      description: item.description,
      amount: item.amount,
      date: item.date,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este gasto?')) return;

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast('Gasto excluído com sucesso!', 'success');
      loadExpenses();
    } catch (error) {
      console.error('Erro ao excluir gasto:', error);
      showToast('Erro ao excluir gasto', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      description: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
    });
    setEditingItem(null);
    setShowModal(false);
  };

  const filteredExpenses = expenses.filter(item => {
    const matchesSearch = 
      item.description.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const totalExpenses = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);

  const todayTotal = expenses
    .filter(item => item.date === new Date().toISOString().split('T')[0])
    .reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 overflow-auto md:ml-64">
        <MobileTopBar />
        <div className="p-4 md:p-8">
          {toast && (
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => setToast(null)}
            />
          )}

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Gastos Diários</h1>
            <p className="text-gray-600">Controle de pequenos gastos do dia a dia</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Gastos de Hoje</p>
                  <p className="text-2xl font-bold text-orange-600">{formatBRL(todayTotal)}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <i className="ri-calendar-line text-2xl text-orange-600"></i>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total no Período</p>
                  <p className="text-2xl font-bold text-red-600">{formatBRL(totalExpenses)}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <i className="ri-money-dollar-circle-line text-2xl text-red-600"></i>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total de Registros</p>
                  <p className="text-2xl font-bold text-gray-900">{filteredExpenses.length}</p>
                </div>
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  <i className="ri-file-list-3-line text-2xl text-gray-600"></i>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl"></i>
                  <input
                    type="text"
                    placeholder="Buscar por descrição..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none cursor-pointer"
                >
                  <option value="today">Hoje</option>
                  <option value="week">Esta Semana</option>
                  <option value="month">Este Mês</option>
                  <option value="all">Todos</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <i className="ri-add-line text-xl"></i>
                Novo Gasto
              </button>
            </div>
          </div>

          {loading ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <i className="ri-loader-4-line text-4xl text-orange-600 animate-spin mb-4"></i>
              <p className="text-gray-600">Carregando gastos...</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                      <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                      <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredExpenses.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                          {new Date(item.date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{item.description}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right whitespace-nowrap">
                          {formatBRL(item.amount)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(item)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Editar"
                            >
                              <i className="ri-edit-line text-lg"></i>
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title="Excluir"
                            >
                              <i className="ri-delete-bin-line text-lg"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredExpenses.length === 0 && (
                <div className="p-12 text-center">
                  <i className="ri-money-dollar-circle-line text-6xl text-gray-300 mb-4"></i>
                  <p className="text-gray-500 text-lg">Nenhum gasto encontrado</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingItem ? 'Editar Gasto' : 'Novo Gasto Diário'}
              </h2>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Descrição *</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Ex: Sacolas, Café, Material de limpeza..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Valor *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.amount || ''}
                      onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition cursor-pointer whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition cursor-pointer whitespace-nowrap"
                >
                  {editingItem ? 'Atualizar' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
