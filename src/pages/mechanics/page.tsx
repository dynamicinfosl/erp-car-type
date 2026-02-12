import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Sidebar from '../../components/layout/Sidebar';
import MobileTopBar from '../../components/layout/MobileTopBar';
import Toast from '../../components/common/Toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';

interface MechanicRow {
  id: string;
  name: string;
  contact_phone?: string;
  commission_percent?: number;
  active: boolean;
  finalized_services_count: number;
  finalized_services_total: number;
  payable_amount: number;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const hasMissingColumn = (error: any, column: string) => {
  const msg = String(error?.message || '');
  const details = String(error?.details || '');
  return msg.includes(column) || details.includes(column);
};

export default function MechanicsPage() {
  const [loading, setLoading] = useState(true);
  const [mechanics, setMechanics] = useState<MechanicRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingMechanic, setEditingMechanic] = useState<MechanicRow | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    contact_phone: '',
    commission_percent: 0,
    active: true,
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    setToast({ message, type });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      contact_phone: '',
      commission_percent: 0,
      active: true,
    });
    setEditingMechanic(null);
    setShowModal(false);
  };

  const loadMechanics = async () => {
    try {
      setLoading(true);

      const { data: usersData, error: usersError } = await supabase
        .from('system_users')
        .select('*')
        .eq('role', 'mechanic')
        .order('name');

      if (usersError) throw usersError;

      const { data: deliveredOrders, error: ordersError } = await supabase
        .from('service_orders')
        .select('mechanic_id, status, total_amount, final_amount')
        .eq('status', 'delivered');

      if (ordersError) throw ordersError;

      const statsByMechanic = new Map<string, { count: number; total: number }>();
      (deliveredOrders || []).forEach((order: any) => {
        if (!order.mechanic_id) return;
        const total = Number(parseFloat(order.final_amount || order.total_amount) || 0);
        const current = statsByMechanic.get(order.mechanic_id) || { count: 0, total: 0 };
        current.count += 1;
        current.total += total;
        statsByMechanic.set(order.mechanic_id, current);
      });

      const mapped: MechanicRow[] = (usersData || []).map((item: any) => {
        const stats = statsByMechanic.get(item.id) || { count: 0, total: 0 };
        const percent = Number(item.commission_percent || 0);
        return {
          id: item.id,
          name: item.name || '',
          contact_phone: item.contact_phone || '',
          commission_percent: percent,
          active: Boolean(item.active),
          finalized_services_count: stats.count,
          finalized_services_total: stats.total,
          payable_amount: stats.total * (percent / 100),
        };
      });

      setMechanics(mapped);
    } catch (error) {
      console.error('Erro ao carregar mecânicos:', error);
      showToast('Erro ao carregar mecânicos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMechanics();
  }, []);

  const filteredMechanics = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return mechanics;
    return mechanics.filter((m) =>
      (m.name || '').toLowerCase().includes(term) ||
      (m.contact_phone || '').toLowerCase().includes(term)
    );
  }, [mechanics, searchTerm]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.contact_phone) {
      showToast('Preencha nome e contato do mecânico', 'warning');
      return;
    }

    const normalizedPercent = Number.isNaN(Number(formData.commission_percent))
      ? 0
      : Math.max(0, Math.min(100, Number(formData.commission_percent)));

    try {
      if (editingMechanic) {
        let payload: any = {
          name: formData.name.trim(),
          contact_phone: formData.contact_phone.trim(),
          commission_percent: normalizedPercent,
          active: formData.active,
          updated_at: new Date().toISOString(),
        };

        let { error } = await supabase
          .from('system_users')
          .update(payload)
          .eq('id', editingMechanic.id)
          .eq('role', 'mechanic');

        if (error && hasMissingColumn(error, 'contact_phone')) {
          delete payload.contact_phone;
          const retry = await supabase
            .from('system_users')
            .update(payload)
            .eq('id', editingMechanic.id)
            .eq('role', 'mechanic');
          error = retry.error;
          if (!error) showToast('Telefone salvo apenas localmente na tela. Rode a migration de contact_phone.', 'warning');
        }

        if (error && hasMissingColumn(error, 'commission_percent')) {
          delete payload.commission_percent;
          const retry = await supabase
            .from('system_users')
            .update(payload)
            .eq('id', editingMechanic.id)
            .eq('role', 'mechanic');
          error = retry.error;
          if (!error) showToast('Percentual salvo apenas na OS. Rode a migration de commission_percent no system_users.', 'warning');
        }

        if (error) throw error;
        showToast('Mecânico atualizado com sucesso!', 'success');
      } else {
        const phoneDigits = formData.contact_phone.replace(/\D/g, '');
        const syntheticEmail = `mechanic.${phoneDigits || Date.now()}.${Date.now()}@erp.local`;
        const syntheticPassword = `mec_${Date.now()}`;

        let payload: any = {
          name: formData.name.trim(),
          email: syntheticEmail,
          password: syntheticPassword,
          role: 'mechanic',
          permissions: ['service_orders', 'dashboard', 'reports'],
          active: formData.active,
          contact_phone: formData.contact_phone.trim(),
          commission_percent: normalizedPercent,
        };

        let { error } = await supabase
          .from('system_users')
          .insert([payload]);

        if (error && hasMissingColumn(error, 'contact_phone')) {
          delete payload.contact_phone;
          const retry = await supabase.from('system_users').insert([payload]);
          error = retry.error;
          if (!error) showToast('Mecânico criado. Rode a migration de contact_phone para salvar contato no banco.', 'warning');
        }

        if (error && hasMissingColumn(error, 'commission_percent')) {
          delete payload.commission_percent;
          const retry = await supabase.from('system_users').insert([payload]);
          error = retry.error;
          if (!error) showToast('Mecânico criado. Rode a migration de commission_percent para salvar % no banco.', 'warning');
        }

        if (error) throw error;
        showToast('Mecânico cadastrado com sucesso!', 'success');
      }

      resetForm();
      await loadMechanics();
    } catch (error: any) {
      console.error('Erro ao salvar mecânico:', error);
      showToast(error?.message || 'Erro ao salvar mecânico', 'error');
    }
  };

  const handleEdit = (mechanic: MechanicRow) => {
    setEditingMechanic(mechanic);
    setFormData({
      name: mechanic.name || '',
      contact_phone: mechanic.contact_phone || '',
      commission_percent: Number(mechanic.commission_percent || 0),
      active: mechanic.active,
    });
    setShowModal(true);
  };

  const handleDelete = (mechanic: MechanicRow) => {
    setConfirmDialog({
      message: `Tem certeza que deseja excluir o mecânico ${mechanic.name}?`,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('system_users')
            .delete()
            .eq('id', mechanic.id)
            .eq('role', 'mechanic');

          if (error) throw error;
          showToast('Mecânico excluído com sucesso!', 'success');
          loadMechanics();
        } catch (error: any) {
          console.error('Erro ao excluir mecânico:', error);
          showToast(error?.message || 'Erro ao excluir mecânico', 'error');
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 overflow-auto md:ml-64">
        <MobileTopBar />

        <div className="p-4 md:p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Mecânicos</h1>
              <p className="text-gray-600 mt-1">Gerencie contato, serviços finalizados e porcentagem a pagar</p>
            </div>
            <button
              onClick={() => {
                setEditingMechanic(null);
                setShowModal(true);
              }}
              className="bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 transition flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <i className="ri-add-line text-xl"></i>
              Novo Mecânico
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="relative max-w-xl">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                placeholder="Buscar por nome ou contato..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Mecânico</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Contato</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Serviços Finalizados</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Base Finalizada</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">% a Pagar</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Valor a Pagar</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Status</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredMechanics.map((mechanic) => (
                      <tr key={mechanic.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{mechanic.name}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{mechanic.contact_phone || '-'}</td>
                        <td className="px-6 py-4 text-sm font-medium text-center text-gray-900">{mechanic.finalized_services_count}</td>
                        <td className="px-6 py-4 text-sm text-right text-gray-900">{formatBRL(mechanic.finalized_services_total)}</td>
                        <td className="px-6 py-4 text-sm font-medium text-center text-blue-700">
                          {Number(mechanic.commission_percent || 0).toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-right text-amber-700">
                          {formatBRL(mechanic.payable_amount)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            mechanic.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {mechanic.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleEdit(mechanic)}
                            className="text-teal-600 hover:text-teal-700 mr-3 cursor-pointer"
                            title="Editar mecânico"
                          >
                            <i className="ri-edit-line text-lg"></i>
                          </button>
                          <button
                            onClick={() => handleDelete(mechanic)}
                            className="text-red-600 hover:text-red-700 cursor-pointer"
                            title="Excluir mecânico"
                          >
                            <i className="ri-delete-bin-line text-lg"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredMechanics.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <i className="ri-user-search-line text-5xl mb-4"></i>
                    <p>Nenhum mecânico encontrado</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingMechanic ? 'Editar Mecânico' : 'Novo Mecânico'}
                </h2>
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <i className="ri-close-line text-2xl"></i>
                </button>
              </div>
            </div>

            <form onSubmit={handleSave} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    placeholder="Nome do mecânico"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contato *</label>
                  <input
                    type="text"
                    required
                    value={formData.contact_phone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, contact_phone: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    placeholder="Telefone/WhatsApp"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Porcentagem a pagar (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={formData.commission_percent}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        const normalized = Number.isNaN(value) ? 0 : Math.max(0, Math.min(100, value));
                        setFormData((prev) => ({ ...prev, commission_percent: normalized }));
                      }}
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                  </div>
                </div>

                <div className="flex items-end">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData((prev) => ({ ...prev, active: e.target.checked }))}
                      className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
                    />
                    <span className="ml-2 text-sm text-gray-700">Mecânico ativo</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition whitespace-nowrap cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition whitespace-nowrap cursor-pointer"
                >
                  {editingMechanic ? 'Salvar Alterações' : 'Criar Mecânico'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
          confirmText="Excluir"
          cancelText="Cancelar"
          type="danger"
        />
      )}
    </div>
  );
}
