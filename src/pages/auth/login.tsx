
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Limpar qualquer sessão inválida ao carregar a página de login
    const clearInvalidSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          // Se houver erro ao obter a sessão, limpar tudo
          await supabase.auth.signOut();
          localStorage.removeItem('user');
        }
      } catch (err) {
        console.error('Erro ao verificar sessão:', err);
        await supabase.auth.signOut();
        localStorage.removeItem('user');
      }
    };

    clearInvalidSession();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Login no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (authError) throw authError;

      // 2. Buscar dados do usuário na tabela system_users
      const { data: userData, error: userError } = await supabase
        .from('system_users')
        .select('*')
        .eq('email', email)
        .single();

      if (userError) {
        await supabase.auth.signOut();
        throw new Error('Usuário não encontrado no sistema');
      }

      // 3. Verificar se o usuário está ativo
      if (!userData.active) {
        await supabase.auth.signOut();
        throw new Error('Usuário inativo. Entre em contato com o administrador.');
      }

      // 4. Salvar dados do usuário no localStorage (SEMPRE COM DADOS ATUALIZADOS DO BANCO)
      localStorage.setItem('user', JSON.stringify({
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        permissions: userData.permissions || [],
      }));

      // 5. Redirecionar baseado no role e permissões
      if (userData.role === 'master' || userData.role === 'admin') {
        window.REACT_APP_NAVIGATE('/dashboard');
      } else {
        // Para operadores e caixas, redirecionar para a primeira página com permissão
        const permissions = userData.permissions || [];
        
        const routeMap: { [key: string]: string } = {
          dashboard: '/dashboard',
          service_orders: '/service-orders',
          sales: '/sales',
          pos: '/pos',
          customers: '/customers',
          products: '/products',
          services: '/services',
          stock: '/stock',
          financial: '/financial',
          appointments: '/appointments',
          reports: '/reports',
          settings: '/settings/company',
        };

        let redirectPath = '/no-access';
        for (const permission of permissions) {
          if (routeMap[permission]) {
            redirectPath = routeMap[permission];
            break;
          }
        }

        window.REACT_APP_NAVIGATE(redirectPath);
      }
    } catch (err: any) {
      console.error('Erro no login:', err);
      setError(err.message || 'Erro ao fazer login. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <i className="ri-car-line text-3xl text-white"></i>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Car Type Motors</h1>
          <p className="text-gray-600">Sistema de Gestão</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition text-sm"
              placeholder="seu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition text-sm"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-lg"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
