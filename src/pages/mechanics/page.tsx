import { useState, useEffect } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import MobileTopBar from '../../components/layout/MobileTopBar';
import { supabase } from '../../lib/supabase';

interface Mechanic {
  id: string;
  name: string;
  contact_phone: string | null;
  created_at?: string;
}

interface CommissionSummary {
  mechanic_id: string;
  mechanic_name: string;
  total_a_receber: number;
  ordens_pagas: number;
}

export default function Mechanics() {
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [commissions, setCommissions] = useState<CommissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', contact_phone: '' });

  useEffect(() => {
    loadMechanics();
    loadCommissions();
  }, []);

  const loadCommissions = async () => {
    try {
      const { data, error } = await supabase
        .from('service_orders')
        .select('mechanic_id, commission_amount, mechanic:mechanics(id, name)')
        .eq('payment_status', 'paid')
        .not('mechanic_id', 'is', null);

      if (error) throw error;

      const byMechanic: Record<string, { name: string; total: number; count: number }> = {};
      for (const row of data || []) {
        const mid = row.mechanic_id;
        const amount = Number(row.commission_amount) || 0;
        const mechanic = row.mechanic as { id: string; name: string } | null;
        const name = mechanic?.name || 'Mecânico';
        if (!byMechanic[mid]) {
          byMechanic[mid] = { name, total: 0, count: 0 };
        }
        byMechanic[mid].total += amount;
        byMechanic[mid].count += 1;
      }
      setCommissions(
        Object.entries(byMechanic).map(([mechanic_id, v]) => ({
          mechanic_id,
          mechanic_name: v.name,
          total_a_receber: v.total,
          ordens_pagas: v.count,
        }))
      );
    } catch (error) {
      console.error('Erro ao carregar comissões:', error);
      setCommissions([]);
    }
  };

  const loadMechanics = async () => {
    try {
      const { data, error } = await supabase
        .from('mechanics')
        .select('id, name, contact_phone, created_at')
        .order('name');

      if (error) throw error;
      setMechanics(data || []);
    } catch (error) {
      console.error('Erro ao carregar mecânicos:', error);
      setMechanics([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formData.name.trim();
    if (!name) return;

    try {
      const { error } = await supabase.from('mechanics').insert([
        { name, contact_phone: formData.contact_phone.trim() || null },
      ]);

      if (error) throw error;
      setShowModal(false);
      setFormData({ name: '', contact_phone: '' });
      await loadMechanics();
      await loadCommissions();
    } catch (error: any) {
      console.error('Erro ao cadastrar mecânico:', error);
      alert(error?.message || 'Erro ao cadastrar mecânico.');
    }
  };

  const handleDelete = async (mechanic: Mechanic) => {
    if (!confirm(`Excluir o mecânico "${mechanic.name}"?`)) return;
    try {
      const { error } = await supabase.from('mechanics').delete().eq('id', mechanic.id);
      if (error) throw error;
      await loadMechanics();
      await loadCommissions();
    } catch (error: any) {
      console.error('Erro ao excluir mecânico:', error);
      alert(error?.message || 'Erro ao excluir mecânico.');
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <MobileTopBar title="Mecânicos" />
      <main className="flex-1 md:pl-64 pt-16 md:pt-0 min-h-screen">
        <div className="p-4 md:p-6 max-w-4xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Mecânicos</h1>
            <button
              type="button"
              onClick={() => { loadCommissions(); loadMechanics(); }}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition cursor-pointer text-sm"
              title="Atualizar"
            >
              <i className="ri-refresh-line"></i>
              Atualizar
            </button>
            <button
              type="button"
              onClick={() => {
                setFormData({ name: '', contact_phone: '' });
                setShowModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition cursor-pointer"
            >
              <i className="ri-add-line text-xl"></i>
              Novo Mecânico
            </button>
          </div>

          {commissions.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <i className="ri-money-dollar-circle-line text-orange-600"></i>
                  Comissões a receber (OS pagas)
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-600">
                      <th className="px-4 py-3 font-medium">Mecânico</th>
                      <th className="px-4 py-3 font-medium text-center">OS pagas</th>
                      <th className="px-4 py-3 font-medium text-right">Total a receber</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.map((c) => (
                      <tr key={c.mechanic_id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{c.mechanic_name}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{c.ordens_pagas}</td>
                        <td className="px-4 py-3 text-right font-semibold text-green-700">
                          R$ {c.total_a_receber.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent"></div>
            </div>
          ) : mechanics.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
              <i className="ri-user-search-line text-4xl text-gray-300 mb-3 block"></i>
              Nenhum mecânico cadastrado. Clique em &quot;Novo Mecânico&quot; para adicionar.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <ul className="divide-y divide-gray-200">
                {mechanics.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{m.name}</p>
                      {m.contact_phone && (
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                          <i className="ri-phone-line"></i>
                          {m.contact_phone}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(m)}
                      className="text-red-600 hover:text-red-700 text-sm font-medium cursor-pointer"
                      title="Excluir"
                    >
                      <i className="ri-delete-bin-line text-lg align-middle"></i> Excluir
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>

      {/* Modal Novo Mecânico */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Novo Mecânico</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder="Nome do mecânico"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone de contato</label>
                <input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition cursor-pointer"
                >
                  Cadastrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
