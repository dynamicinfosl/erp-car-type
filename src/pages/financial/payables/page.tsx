import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import Toast from '../../../components/common/Toast';
import Sidebar from '../../../components/layout/Sidebar';
import MobileTopBar from '../../../components/layout/MobileTopBar';

interface Payable {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  status: 'pending' | 'paid';
  supplier_name?: string;
  due_date?: string;
  created_at: string;
}

export default function Payables() {
  const formatBRL = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  const [payables, setPayables] = useState<Payable[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Payable | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [formData, setFormData] = useState({
    description: '',
    amount: 0,
    category: 'Fornecedores',
    date: new Date().toISOString().split('T')[0],
    status: 'pending' as 'pending' | 'paid',
    supplier_name: '',
    due_date: '',
  });

  useEffect(() => {
    loadPayables();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    setToast({ message, type });
  };

  const loadPayables = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setPayables(data || []);
    } catch (error) {
      console.error('Erro ao carregar contas a pagar:', error);
      showToast('Erro ao carregar contas a pagar', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description || formData.amount <= 0) {
      showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    try {
      if (editingItem) {
        const { error } = await supabase
          .from('expenses')
          .update(formData)
          .eq('id', editingItem.id);

        if (error) throw error;
        showToast('Conta atualizada com sucesso!', 'success');
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert([formData]);

        if (error) throw error;
        showToast('Conta criada com sucesso!', 'success');
      }

      resetForm();
      loadPayables();
    } catch (error) {
      console.error('Erro ao salvar conta:', error);
      showToast('Erro ao salvar conta', 'error');
    }
  };

  const handleEdit = (item: Payable) => {
    setEditingItem(item);
    setFormData({
      description: item.description,
      amount: item.amount,
      category: item.category,
      date: item.date,
      status: item.status,
      supplier_name: item.supplier_name || '',
      due_date: item.due_date || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta conta?')) return;

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast('Conta excluída com sucesso!', 'success');
      loadPayables();
    } catch (error) {
      console.error('Erro ao excluir conta:', error);
      showToast('Erro ao excluir conta', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      description: '',
      amount: 0,
      category: 'Fornecedores',
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
      supplier_name: '',
      due_date: '',
    });
    setEditingItem(null);
    setShowModal(false);
  };

  const filteredPayables = payables.filter(item => {
    const matchesSearch = 
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.supplier_name && item.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const totalPending = filteredPayables
    .filter(item => item.status === 'pending')
    .reduce((sum, item) => sum + item.amount, 0);

  const totalPaid = filteredPayables
    .filter(item => item.status === 'paid')
    .reduce((sum, item) => sum + item.amount, 0);

  const categories = ['Fornecedores', 'Aluguel', 'Salários', 'Impostos', 'Energia', 'Água', 'Internet', 'Outros'];

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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Contas a Pagar</h1>
            <p className="text-gray-600">Gerencie os pagamentos e despesas</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total a Pagar</p>
                  <p className="text-2xl font-bold text-red-600">{formatBRL(totalPending)}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <i className="ri-time-line text-2xl text-red-600"></i>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Pago</p>
                  <p className="text-2xl font-bold text-green-600">{formatBRL(totalPaid)}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <i className="ri-check-line text-2xl text-green-600"></i>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Geral</p>
                  <p className="text-2xl font-bold text-gray-900">{formatBRL(totalPending + totalPaid)}</p>
                </div>
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  <i className="ri-money-dollar-circle-line text-2xl text-gray-600"></i>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl"></i>
                  <input
                    type="text"
                    placeholder="Buscar por descrição ou fornecedor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none cursor-pointer"
                >
                  <option value="all">Todos os Status</option>
                  <option value="pending">Pendente</option>
                  <option value="paid">Pago</option>
                </select>
              </div>

              <div>
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

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <i className="ri-add-line text-xl"></i>
                Nova Conta a Pagar
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Fornecedor</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPayables.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(item.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{item.description}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.supplier_name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.category}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                      {formatBRL(item.amount)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {item.status === 'paid' ? (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Pago
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Pendente
                        </span>
                      )}
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

            {filteredPayables.length === 0 && (
              <div className="p-12 text-center">
                <i className="ri-money-dollar-circle-line text-6xl text-gray-300 mb-4"></i>
                <p className="text-gray-500 text-lg">Nenhuma conta a pagar encontrada</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingItem ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}
              </h2>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Descrição *</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fornecedor</label>
                  <input
                    type="text"
                    value={formData.supplier_name}
                    onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Categoria *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none cursor-pointer"
                    required
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'pending' | 'paid' })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none cursor-pointer"
                    required
                  >
                    <option value="pending">Pendente</option>
                    <option value="paid">Pago</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data de Vencimento</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
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
                  {editingItem ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
