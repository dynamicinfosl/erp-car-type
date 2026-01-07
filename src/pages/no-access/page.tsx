import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function NoAccess() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <i className="ri-lock-line text-4xl text-orange-500"></i>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          Acesso Negado
        </h1>
        
        <p className="text-gray-600 mb-6">
          Você não tem permissão para acessar nenhuma página do sistema. Entre em contato com o administrador para solicitar acesso.
        </p>

        <div className="space-y-3">
          <button
            onClick={handleLogout}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition cursor-pointer whitespace-nowrap"
          >
            Fazer Logout
          </button>
          
          <p className="text-sm text-gray-500">
            Precisa de ajuda? Entre em contato com o administrador do sistema.
          </p>
        </div>
      </div>
    </div>
  );
}
