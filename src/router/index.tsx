
import { useRoutes, Navigate, useLocation, useNavigate, type NavigateFunction } from "react-router-dom";
import { Suspense, useEffect, useState, useRef } from "react";
import routes from "./config";
import { supabase } from "../lib/supabase";

let navigateResolver: (navigate: ReturnType<typeof useNavigate>) => void;

declare global {
  interface Window {
    REACT_APP_NAVIGATE: ReturnType<typeof useNavigate>;
  }
}

export const navigatePromise = new Promise<NavigateFunction>((resolve) => {
  navigateResolver = resolve;
});

function ProtectedRoute({ children, session }: { children: React.ReactNode; session: any }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const checkingRef = useRef(false);

  useEffect(() => {
    if (checkingRef.current) return;
    checkAccess();
  }, [location.pathname, session]);

  const checkAccess = async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;

    try {
      // Páginas públicas - NÃO PRECISAM DE AUTENTICAÇÃO
      const publicPaths = ['/auth/login', '/auth/register', '/404', '/print'];
      const isPublicPath = publicPaths.some(path => location.pathname.startsWith(path));
      
      if (isPublicPath) {
        setHasAccess(true);
        setIsChecking(false);
        checkingRef.current = false;
        return;
      }

      // Se não estiver logado, redireciona para login
      if (!session) {
        navigate('/auth/login', { replace: true });
        setIsChecking(false);
        checkingRef.current = false;
        return;
      }

      // Verificar se o token ainda é válido
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user?.email) {
        console.error('Erro ao verificar usuário:', userError);
        // Token inválido, fazer logout e redirecionar
        await supabase.auth.signOut();
        localStorage.removeItem('user');
        navigate('/auth/login', { replace: true });
        setIsChecking(false);
        checkingRef.current = false;
        return;
      }

      // Buscar permissões do usuário
      const { data: userData, error: dbError } = await supabase
        .from('system_users')
        .select('role, permissions, active')
        .eq('email', user.email)
        .maybeSingle();

      if (dbError) {
        console.error('Erro ao buscar usuário:', dbError);
        navigate('/auth/login', { replace: true });
        setIsChecking(false);
        checkingRef.current = false;
        return;
      }

      if (!userData || !userData.active) {
        await supabase.auth.signOut();
        localStorage.removeItem('user');
        navigate('/auth/login', { replace: true });
        setIsChecking(false);
        checkingRef.current = false;
        return;
      }

      // Master tem acesso a tudo
      if (userData.role === 'master') {
        setHasAccess(true);
        setIsChecking(false);
        checkingRef.current = false;
        return;
      }

      // Mapear rotas para permissões
      const routePermissions: { [key: string]: string } = {
        '/dashboard': 'dashboard',
        '/inbox': 'inbox',
        '/appointments': 'appointments',
        '/service-orders': 'service_orders',
        '/customers': 'customers',
        '/products': 'products',
        '/services': 'services',
        '/stock': 'stock',
        '/pos': 'pos',
        '/sales': 'sales',
        '/sales/returns': 'sales',
        '/reports': 'reports',
        '/reports/product-sales': 'reports',
        '/financial': 'financial',
        '/financial/receivables': 'financial',
        '/financial/payables': 'financial',
        '/financial/cash-flow': 'financial',
        '/settings/users': 'settings',
        '/settings/company': 'settings',
      };

      const currentPath = location.pathname;
      const requiredPermission = routePermissions[currentPath];

      // Se não encontrou a permissão necessária, permite acesso
      if (!requiredPermission) {
        setHasAccess(true);
        setIsChecking(false);
        checkingRef.current = false;
        return;
      }

      const permissions = userData.permissions || [];
      
      // Verifica se tem permissão (suporta tanto array quanto objeto)
      const hasPermission = Array.isArray(permissions) 
        ? permissions.includes(requiredPermission)
        : permissions[requiredPermission] === true;

      if (hasPermission) {
        setHasAccess(true);
        setIsChecking(false);
        checkingRef.current = false;
        return;
      }

      // Se não tem permissão, redireciona para a primeira página com acesso
      const availableRoutes = [
        { path: '/dashboard', permission: 'dashboard' },
        { path: '/inbox', permission: 'inbox' },
        { path: '/appointments', permission: 'appointments' },
        { path: '/service-orders', permission: 'service_orders' },
        { path: '/customers', permission: 'customers' },
        { path: '/products', permission: 'products' },
        { path: '/services', permission: 'services' },
        { path: '/stock', permission: 'stock' },
        { path: '/pos', permission: 'pos' },
        { path: '/sales', permission: 'sales' },
        { path: '/reports', permission: 'reports' },
        { path: '/financial', permission: 'financial' },
        { path: '/settings/company', permission: 'settings' },
        { path: '/settings/users', permission: 'settings' },
      ];

      const firstAvailableRoute = availableRoutes.find(route => {
        if (Array.isArray(permissions)) {
          return permissions.includes(route.permission);
        }
        return permissions[route.permission] === true;
      });

      if (firstAvailableRoute) {
        navigate(firstAvailableRoute.path, { replace: true });
        setIsChecking(false);
        checkingRef.current = false;
      } else {
        // Se não tem acesso a nenhuma página, redireciona para página de sem acesso
        navigate('/no-access', { replace: true });
        setIsChecking(false);
        checkingRef.current = false;
      }
    } catch (error) {
      console.error('Erro ao verificar permissões:', error);
      // Em caso de erro, fazer logout e redirecionar
      await supabase.auth.signOut();
      localStorage.removeItem('user');
      navigate('/auth/login', { replace: true });
      setIsChecking(false);
      checkingRef.current = false;
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return <>{children}</>;
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Carregando...</p>
      </div>
    </div>
  );
}

export function AppRoutes({ session }: { session: any }) {
  const element = useRoutes(routes);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    window.REACT_APP_NAVIGATE = navigate;
    navigateResolver(window.REACT_APP_NAVIGATE);
  }, [navigate]);

  // Páginas que não precisam de proteção - TOTALMENTE PÚBLICAS
  const publicPaths = ['/auth/login', '/auth/register', '/404', '/print'];
  const isPublicPath = publicPaths.some(path => location.pathname.startsWith(path));

  // Se for página pública, renderiza direto SEM verificação
  if (isPublicPath) {
    return <Suspense fallback={<LoadingFallback />}>{element}</Suspense>;
  }

  // Páginas protegidas passam pela verificação
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ProtectedRoute session={session}>
        {element}
      </ProtectedRoute>
    </Suspense>
  );
}
