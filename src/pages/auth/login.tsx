
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [logoUrl, setLogoUrl] = useState(
    'https://static.readdy.ai/image/016995f7e8292e3ea703f912413c6e1c/55707f5ad0b973e9e1fbd88859e769d0.png'
  );
  const navigate = useNavigate();

  useEffect(() => {
    const loadCompanyLogo = async () => {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('logo_url')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (data?.logo_url) {
          setLogoUrl(data.logo_url);
        }
      } catch (error) {
        console.error('Erro ao carregar logo:', error);
      }
    };

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

    loadCompanyLogo();
    clearInvalidSession();
  }, []);

  // Função auxiliar para retry de requisições
  const retryRequest = async <T,>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> => {
    let lastError: any;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        if (i > 0) {
          setRetrying(true);
          setError(`Tentando novamente... (${i}/${maxRetries - 1})`);
        }
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // Se não for erro de rede, não tenta novamente
        if (error?.message && !error.message.includes('NetworkError') && !error.message.includes('fetch') && !error.message.includes('CORS')) {
          setRetrying(false);
          throw error;
        }
        
        // Se não for a última tentativa, aguarda antes de tentar novamente
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        } else {
          setRetrying(false);
        }
      }
    }
    
    setRetrying(false);
    throw lastError;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setRetrying(false);

    try {
      // 1. Login no Supabase Auth com retry
      const { data: authData, error: authError } = await retryRequest(
        () => supabase.auth.signInWithPassword({
          email: email,
          password: password,
        }),
        3, // 3 tentativas
        1000 // 1 segundo de delay inicial
      );

      if (authError) throw authError;

      // 2. Buscar dados do usuário na tabela system_users com retry
      const { data: userData, error: userError } = await retryRequest(
        () => supabase
          .from('system_users')
          .select('*')
          .eq('email', email)
          .single(),
        3,
        1000
      );

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
        // Mobile: abrir o sidebar automaticamente ao entrar no dashboard pela primeira vez após login
        try {
          const isMobile = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
          if (isMobile) localStorage.setItem('open_sidebar_on_dashboard_once', '1');
        } catch {}
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

        // Mobile: se a primeira página for dashboard, abrir sidebar automaticamente na primeira entrada
        try {
          const isMobile = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
          if (isMobile && redirectPath === '/dashboard') {
            localStorage.setItem('open_sidebar_on_dashboard_once', '1');
          }
        } catch {}

        window.REACT_APP_NAVIGATE(redirectPath);
      }
      
      // Reset retry state on success
      setRetrying(false);
    } catch (err: any) {
      console.error('Erro no login:', err);
      
      // Mensagens de erro mais amigáveis
      let errorMessage = 'Erro ao fazer login. Verifique suas credenciais.';
      const msg = err?.message ?? '';
      const isNetworkError = msg.includes('NetworkError') || msg.includes('fetch') || msg.includes('CORS') || msg.includes('Failed to fetch') || (err?.name && err.name.includes('AuthRetryableFetchError'));
      
      if (isNetworkError) {
        errorMessage = 'Não foi possível conectar ao servidor. Verifique: (1) sua internet, (2) se o projeto Supabase está ativo em app.supabase.com, (3) se reiniciou o app após configurar o .env (npm run dev).';
      } else if (msg.includes('Invalid login credentials') || msg.includes('Email not confirmed')) {
        errorMessage = 'Email ou senha incorretos.';
      } else if (msg.includes('Usuário não encontrado')) {
        errorMessage = 'Usuário não encontrado no sistema.';
      } else if (msg.includes('inativo')) {
        errorMessage = 'Usuário inativo. Entre em contato com o administrador.';
      } else if (!isNetworkError && msg) {
        errorMessage = msg;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg border border-gray-100">
            <img
              src={logoUrl}
              alt="Logo da Empresa"
              className="w-14 h-14 object-contain"
              onError={(e) => {
                // Fallback visual caso a URL esteja quebrada
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Car Type Motors</h1>
          <p className="text-gray-600">Sistema de Gestão</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className={`px-4 py-3 rounded-lg text-sm ${
              retrying 
                ? 'bg-yellow-50 border border-yellow-200 text-yellow-700' 
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              <div className="flex items-center gap-2">
                {retrying && (
                  <i className="ri-loader-4-line text-lg animate-spin"></i>
                )}
                <span>{error}</span>
              </div>
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
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-lg flex items-center justify-center gap-2"
          >
            {loading && (
              <i className="ri-loader-4-line text-xl animate-spin"></i>
            )}
            {loading ? 'Conectando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
