import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const DEFAULT_LOGO_URL =
  'https://static.readdy.ai/image/016995f7e8292e3ea703f912413c6e1c/55707f5ad0b973e9e1fbd88859e769d0.png';

export default function MobileTopBar() {
  const [logoUrl, setLogoUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('company_logo_url') || DEFAULT_LOGO_URL;
    } catch {
      return DEFAULT_LOGO_URL;
    }
  });

  useEffect(() => {
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

    loadCompanyLogo();
  }, []);

  return (
    <div className="md:hidden sticky top-0 z-40">
      <div className="h-3 bg-orange-600"></div>
      <div className="bg-white border-b border-gray-200 py-4 flex items-center justify-center">
        <img src={logoUrl} alt="Logo" className="h-10 w-auto object-contain" />
      </div>
    </div>
  );
}

