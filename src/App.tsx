import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./router";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        // Se houver erro de token inválido, limpar sessão
        if (error) {
          console.error('Erro ao verificar autenticação:', error);
          await supabase.auth.signOut();
          localStorage.removeItem('user');
          setSession(null);
        } else {
          setSession(session);
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        // Limpar sessão em caso de erro
        await supabase.auth.signOut();
        localStorage.removeItem('user');
        setSession(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (_event === 'TOKEN_REFRESHED') {
        console.log('Token atualizado com sucesso');
      }
      
      if (_event === 'SIGNED_OUT' || !session) {
        localStorage.removeItem('user');
        setSession(null);
      } else {
        setSession(session);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <I18nextProvider i18n={i18n}>
      <BrowserRouter basename={__BASE_PATH__}>
        <AppRoutes session={session} />
      </BrowserRouter>
    </I18nextProvider>
  );
}

export default App;
