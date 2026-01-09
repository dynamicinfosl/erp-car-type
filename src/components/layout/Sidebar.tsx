import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['/financial', '/settings', '/service-orders']);
  const [logoUrl, setLogoUrl] = useState('https://static.readdy.ai/image/016995f7e8292e3ea703f912413c6e1c/55707f5ad0b973e9e1fbd88859e769d0.png');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [userPermissions, setUserPermissions] = useState<any>([]);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    loadCompanyLogo();
    loadUserInfo();
  }, []);

  // Mobile: por padrão fecha ao navegar, mas ao entrar no Dashboard pela primeira vez após login pode abrir automaticamente
  useEffect(() => {
    try {
      const isMobile = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
      const shouldOpenOnce = localStorage.getItem('open_sidebar_on_dashboard_once') === '1';

      if (isMobile && location.pathname === '/dashboard' && shouldOpenOnce) {
        setMobileOpen(true);
        localStorage.removeItem('open_sidebar_on_dashboard_once');
        return;
      }
    } catch {}

    setMobileOpen(false);
  }, [location.pathname]);

  const loadCompanyLogo = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('logo_url')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data?.logo_url) {
        setLogoUrl(data.logo_url);
        try {
          localStorage.setItem('company_logo_url', data.logo_url);
        } catch {}
      }
    } catch (error) {
      console.error('Erro ao carregar logo:', error);
    }
  };

  const loadUserInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
        
        // Buscar informações do usuário na tabela system_users
        const { data: userData } = await supabase
          .from('system_users')
          .select('name, role, permissions')
          .eq('email', user.email)
          .single();
        
        if (userData) {
          setUserName(userData.name);
          setUserRole(userData.role);
          // Garantir que permissões seja sempre um array
          setUserPermissions(Array.isArray(userData.permissions) ? userData.permissions : []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
    }
  };

  const allMenuItems = [
    { icon: 'ri-dashboard-line', label: 'Dashboard', path: '/dashboard', permission: 'dashboard' },
    { icon: 'ri-message-3-line', label: 'Conversas', path: '/inbox', permission: 'inbox' },
    { icon: 'ri-calendar-line', label: 'Agendamentos', path: '/appointments', permission: 'appointments' },
    { 
      icon: 'ri-file-list-3-line', 
      label: 'Ordens de Serviço', 
      path: '/service-orders',
      permission: 'service_orders',
      submenu: [
        { label: 'Ordens de Serviço', path: '/service-orders', permission: 'service_orders' },
        { label: 'Notas Fiscais', path: '/invoices', permission: 'service_orders' },
      ]
    },
    { icon: 'ri-user-line', label: 'Clientes', path: '/customers', permission: 'customers' },
    { icon: 'ri-shopping-bag-line', label: 'Produtos', path: '/products', permission: 'products' },
    { icon: 'ri-tools-line', label: 'Serviços', path: '/services', permission: 'services' },
    { icon: 'ri-store-line', label: 'Estoque', path: '/stock', permission: 'stock' },
    { icon: 'ri-shopping-cart-line', label: 'PDV', path: '/pos', permission: 'pos' },
    { icon: 'ri-shopping-bag-3-line', label: 'Vendas', path: '/sales', permission: 'sales' },
    { icon: 'ri-bar-chart-box-line', label: 'Relatórios', path: '/reports', permission: 'reports' },
    { 
      icon: 'ri-wallet-3-line', 
      label: 'Financeiro', 
      path: '/financial',
      permission: 'financial',
      submenu: [
        { label: 'Visão Geral', path: '/financial', permission: 'financial' },
        { label: 'Contas a Receber', path: '/financial/receivables', permission: 'financial' },
        { label: 'Contas a Pagar', path: '/financial/payables', permission: 'financial' },
        { label: 'Fluxo de Caixa', path: '/financial/cash-flow', permission: 'financial' },
      ]
    },
    { 
      icon: 'ri-settings-3-line', 
      label: 'Configurações', 
      path: '/settings',
      permission: 'settings',
      submenu: [
        { label: 'Dados da Empresa', path: '/settings/company', permission: 'settings' },
        { label: 'Usuários', path: '/settings/users', permission: 'settings' },
      ]
    },
  ];

  // Filtrar menus baseado nas permissões
  const menuItems = allMenuItems.filter(item => {
    // Master tem acesso a tudo
    if (userRole === 'master') return true;
    
    // Verificar se tem permissão para o item (permissões como array)
    if (item.permission && Array.isArray(userPermissions) && userPermissions.includes(item.permission)) {
      // Se tem submenu, filtrar os subitens também
      if (item.submenu) {
        item.submenu = item.submenu.filter(subItem => 
          userRole === 'master' || (subItem.permission && userPermissions.includes(subItem.permission))
        );
        // Só mostrar o menu pai se tiver pelo menos um submenu visível
        return item.submenu.length > 0;
      }
      return true;
    }
    
    return false;
  });

  const toggleMenu = (path: string) => {
    setExpandedMenus(prev => 
      prev.includes(path) 
        ? prev.filter(p => p !== path)
        : [...prev, path]
    );
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth/login');
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

  return (
    <>
      {/* Botão hambúrguer (mobile) */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className={[
          "fixed top-3 left-3 z-[60] md:hidden bg-gray-900/90 text-white rounded-lg p-2 shadow-lg border border-gray-700 cursor-pointer",
          mobileOpen ? "hidden" : "block",
        ].join(" ")}
        aria-label="Abrir menu"
        title="Menu"
      >
        <i className="ri-menu-line text-xl"></i>
      </button>

      {/* Overlay (mobile) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[55] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        className={[
          "w-64 bg-gradient-to-b from-gray-900 to-gray-800 text-white h-screen fixed left-0 top-0 flex flex-col z-[56]",
          "transition-transform duration-200 ease-out",
          "md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        ].join(" ")}
        role="navigation"
        aria-label="Sidebar"
      >
        {/* Header (mobile) */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <img
              src={logoUrl}
              alt="Car Type Motors"
              className="w-9 h-9 rounded-lg object-cover"
            />
            <div>
              <h1 className="font-bold text-base leading-tight">Car Type Motors</h1>
              <p className="text-[11px] text-gray-400 leading-tight">Sistema de Gestão</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="text-gray-300 hover:text-white hover:bg-white/10 rounded-lg p-2 transition cursor-pointer"
            aria-label="Fechar menu"
            title="Fechar"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

      <div className="p-6 border-b border-gray-700">
        <div className="hidden md:flex items-center gap-3">
          <img 
            src={logoUrl} 
            alt="Car Type Motors" 
            className="w-10 h-10 rounded-lg object-cover"
          />
          <div>
            <h1 className="font-bold text-lg">Car Type Motors</h1>
            <p className="text-xs text-gray-400">Sistema de Gestão</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => (
          <div key={item.path}>
            <button
              onClick={() => {
                if (item.submenu) {
                  toggleMenu(item.path);
                } else {
                  navigate(item.path);
                }
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition cursor-pointer whitespace-nowrap ${
                location.pathname === item.path
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <i className={`${item.icon} text-xl`}></i>
                <span className="font-medium">{item.label}</span>
              </div>
              {item.submenu && (
                <i className={`ri-arrow-${expandedMenus.includes(item.path) ? 'down' : 'right'}-s-line text-lg transition-transform`}></i>
              )}
            </button>
            {item.submenu && expandedMenus.includes(item.path) && (
              <div className="ml-4 mt-2 space-y-1">
                {item.submenu.map((subItem) => (
                  <button
                    key={subItem.path}
                    onClick={() => navigate(subItem.path)}
                    className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition cursor-pointer whitespace-nowrap ${
                      location.pathname === subItem.path
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    <i className="ri-arrow-right-s-line text-sm"></i>
                    <span>{subItem.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Seção de Usuário */}
      <div className="p-4 border-t border-gray-700">
        <div className="bg-gray-700/50 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center flex-shrink-0">
              <i className="ri-user-line text-xl text-white"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{userName || 'Carregando...'}</p>
              <p className="text-xs text-gray-400 truncate">{userEmail || 'Carregando...'}</p>
              {userRole && (
                <p className="text-xs text-orange-400 font-medium mt-0.5">{getRoleLabel(userRole)}</p>
              )}
            </div>
          </div>
        </div>
        
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-700 transition cursor-pointer whitespace-nowrap"
        >
          <i className="ri-logout-box-line text-xl"></i>
          <span className="font-medium">Sair</span>
        </button>
      </div>
      </div>
    </>
  );
}
