import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import Sidebar from '../../../components/layout/Sidebar';
import MobileTopBar from '../../../components/layout/MobileTopBar';
import Toast from '../../../components/common/Toast';
import ConfirmDialog from '../../../components/common/ConfirmDialog';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  active: boolean;
  created_at: string;
}

const availablePermissions = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'service_orders', label: 'Ordens de Serviço' },
  { id: 'sales', label: 'Vendas' },
  { id: 'pos', label: 'PDV' },
  { id: 'customers', label: 'Clientes' },
  { id: 'products', label: 'Produtos' },
  { id: 'services', label: 'Serviços' },
  { id: 'stock', label: 'Estoque' },
  { id: 'financial', label: 'Financeiro' },
  { id: 'appointments', label: 'Agendamentos' },
  { id: 'reports', label: 'Relatórios' },
  { id: 'settings', label: 'Configurações' },
];

export default function UsersSettings() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isEditingOwnProfile, setIsEditingOwnProfile] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'operator',
    permissions: [] as string[],
    active: true,
  });

  useEffect(() => {
    loadCurrentUser();
    loadUsers();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('system_users')
          .select('*')
          .eq('email', user.email)
          .maybeSingle();
        
        if (error) {
          console.error('Erro ao buscar usuário:', error);
          return;
        }

        // Se o usuário não existe na tabela system_users, cria automaticamente como master
        if (!data) {
          const { data: newUser, error: insertError } = await supabase
            .from('system_users')
            .insert([{
              email: user.email,
              name: user.email.split('@')[0],
              role: 'master',
              permissions: ['dashboard', 'service_orders', 'sales', 'pos', 'customers', 'products', 'services', 'stock', 'financial', 'appointments', 'reports', 'settings'],
              active: true,
              password: 'master123', // Senha padrão inicial - usuário deve alterar depois
            }])
            .select()
            .single();

          if (insertError) {
            console.error('Erro ao criar usuário:', insertError);
            return;
          }

          setCurrentUser(newUser);
          setToast({ message: 'Bem-vindo! Sua conta foi configurada como Master. Por favor, altere sua senha.', type: 'success' });
        } else {
          setCurrentUser(data);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar usuário atual:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: currentUserData } = await supabase
        .from('system_users')
        .select('*')
        .eq('email', user.email)
        .single();

      let query = supabase.from('system_users').select('*');

      // Master vê todos
      // Admin vê operadores e caixas
      // Operador/Caixa vê apenas ele mesmo
      if (currentUserData?.role === 'admin') {
        query = query.in('role', ['operator', 'cashier', 'admin']);
      } else if (currentUserData?.role === 'operator' || currentUserData?.role === 'cashier') {
        query = query.eq('email', user.email);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      setToast({ message: 'Erro ao carregar usuários', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const canManageUsers = () => {
    return currentUser?.role === 'master' || currentUser?.role === 'admin';
  };

  const canEditUser = (user: User) => {
    if (currentUser?.role === 'master') return true;
    if (currentUser?.role === 'admin' && user.role !== 'master' && user.role !== 'admin') return true;
    return currentUser?.id === user.id;
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email) {
      setToast({ message: 'Preencha todos os campos obrigatórios', type: 'warning' });
      return;
    }

    if (!editingUser && !formData.password) {
      setToast({ message: 'A senha é obrigatória para novos usuários', type: 'warning' });
      return;
    }

    try {
      if (editingUser) {
        const updateData: any = {
          name: formData.name,
          email: formData.email,
          updated_at: new Date().toISOString(),
        };

        // Apenas master e admin podem alterar role e permissões
        if (canManageUsers() && !isEditingOwnProfile) {
          updateData.role = formData.role;
          updateData.permissions = formData.permissions;
          updateData.active = formData.active;
        }

        if (formData.password) {
          updateData.password = formData.password;
        }

        const { error } = await supabase
          .from('system_users')
          .update(updateData)
          .eq('id', editingUser.id);

        if (error) throw error;
        setToast({ message: 'Usuário atualizado com sucesso!', type: 'success' });
      } else {
        // Apenas master e admin podem criar usuários
        if (!canManageUsers()) {
          setToast({ message: 'Você não tem permissão para criar usuários', type: 'error' });
          return;
        }

        // Chamar Edge Function para criar usuário no Supabase Auth
        const { data: { session } } = await supabase.auth.getSession();
        
        const response = await fetch(
          `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/create-system-user`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
              name: formData.name,
              role: formData.role,
              permissions: formData.permissions,
              active: formData.active,
            }),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Erro ao criar usuário');
        }

        setToast({ message: 'Usuário criado com sucesso!', type: 'success' });
      }

      resetForm();
      loadUsers();
      if (isEditingOwnProfile) {
        loadCurrentUser();
      }
    } catch (error: any) {
      console.error('Erro ao salvar usuário:', error);
      if (error.message.includes('already registered') || error.message.includes('já está cadastrado')) {
        setToast({ message: 'Este e-mail já está cadastrado', type: 'error' });
      } else {
        setToast({ message: error.message || 'Erro ao salvar usuário', type: 'error' });
      }
    }
  };

  const handleEdit = (user: User) => {
    const editingOwn = currentUser?.id === user.id;
    setIsEditingOwnProfile(editingOwn);
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      permissions: user.permissions || [],
      active: user.active,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!canManageUsers()) {
      setToast({ message: 'Você não tem permissão para excluir usuários', type: 'error' });
      return;
    }

    setConfirmDialog({
      message: 'Tem certeza que deseja excluir este usuário?',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('system_users')
            .delete()
            .eq('id', id);

          if (error) throw error;
          setToast({ message: 'Usuário excluído com sucesso!', type: 'success' });
          loadUsers();
        } catch (error) {
          console.error('Erro ao excluir usuário:', error);
          setToast({ message: 'Erro ao excluir usuário', type: 'error' });
        }
        setConfirmDialog(null);
      },
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'operator',
      permissions: [],
      active: true,
    });
    setEditingUser(null);
    setIsEditingOwnProfile(false);
    setShowModal(false);
  };

  const togglePermission = (permissionId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId],
    }));
  };

  const getRoleLabel = (role: string) => {
    const labels: { [key: string]: string } = {
      master: 'Master',
      admin: 'Administrador',
      operator: 'Operador',
      cashier: 'Caixa',
    };
    return labels[role] || role;
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: { [key: string]: string } = {
      master: 'bg-purple-100 text-purple-700',
      admin: 'bg-orange-100 text-orange-700',
      operator: 'bg-blue-100 text-blue-700',
      cashier: 'bg-gray-100 text-gray-700',
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 overflow-auto md:ml-64">
        <MobileTopBar />
        <div className="p-4 md:p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {canManageUsers() ? 'Usuários do Sistema' : 'Meu Perfil'}
              </h1>
              <p className="text-gray-600 mt-1">
                {canManageUsers() 
                  ? 'Gerencie os usuários e suas permissões' 
                  : 'Gerencie suas informações pessoais'}
              </p>
            </div>
            {canManageUsers() && (
              <button
                onClick={() => setShowModal(true)}
                className="px-6 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <i className="ri-add-line"></i>
                Novo Usuário
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Nome</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">E-mail</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Função</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{user.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          user.active 
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {user.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {canEditUser(user) && (
                            <button
                              onClick={() => handleEdit(user)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Editar"
                            >
                              <i className="ri-edit-line text-lg"></i>
                            </button>
                          )}
                          {canManageUsers() && user.role !== 'master' && currentUser?.id !== user.id && (
                            <button
                              onClick={() => handleDelete(user.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title="Excluir"
                            >
                              <i className="ri-delete-bin-line text-lg"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              {users.length === 0 && (
                <div className="text-center py-12">
                  <i className="ri-user-line text-5xl text-gray-300 mb-4"></i>
                  <p className="text-gray-500">Nenhum usuário cadastrado</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingUser ? (isEditingOwnProfile ? 'Editar Meu Perfil' : 'Editar Usuário') : 'Novo Usuário'}
              </h2>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Nome completo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    E-mail *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="email@exemplo.com"
                    disabled={isEditingOwnProfile}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Senha {editingUser ? '(deixe em branco para não alterar)' : '*'}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>

                {canManageUsers() && !isEditingOwnProfile && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Função *
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent cursor-pointer"
                    >
                      {currentUser?.role === 'master' && <option value="admin">Administrador</option>}
                      <option value="operator">Operador</option>
                      <option value="cashier">Caixa</option>
                    </select>
                  </div>
                )}
              </div>

              {canManageUsers() && !isEditingOwnProfile && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Permissões de Acesso
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {availablePermissions.map((permission) => (
                        <label
                          key={permission.id}
                          className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(permission.id)}
                            onChange={() => togglePermission(permission.id)}
                            className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"
                          />
                          <span className="text-sm text-gray-700">{permission.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.active}
                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                        className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"
                      />
                      <span className="text-sm font-medium text-gray-700">Usuário ativo</span>
                    </label>
                  </div>
                </>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={resetForm}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition whitespace-nowrap cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition whitespace-nowrap cursor-pointer"
              >
                {editingUser ? 'Atualizar' : 'Criar Usuário'}
              </button>
            </div>
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
        />
      )}
    </div>
  );
}
