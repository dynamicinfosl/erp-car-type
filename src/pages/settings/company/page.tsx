import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import Toast from '../../../components/common/Toast';
import Sidebar from '../../../components/layout/Sidebar';
import MobileTopBar from '../../../components/layout/MobileTopBar';

interface SystemSettings {
  id?: string;
  company_name: string;
  cnpj: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  logo_url: string;
  focus_nfe_token: string;
  focus_nfe_environment: string;
  inscricao_estadual: string;
  inscricao_municipal: string;
  regime_tributario: string;
  cnae: string;
  city_code: string;
}

export default function CompanySettings() {
  const [activeTab, setActiveTab] = useState<'general' | 'fiscal'>('general');
  const [settings, setSettings] = useState<SystemSettings>({
    company_name: '',
    cnpj: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    logo_url: '',
    focus_nfe_token: '',
    focus_nfe_environment: 'homologacao',
    inscricao_estadual: '',
    inscricao_municipal: '',
    regime_tributario: '1',
    cnae: '',
    city_code: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        console.log('📥 Dados carregados do banco:', data);
        console.log('🔍 Código do Município carregado:', data.city_code);
        setSettings(data);
      }
    } catch (error: any) {
      console.error('Erro ao carregar configurações:', error);
      setToast({ message: 'Erro ao carregar configurações', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings.company_name || !settings.phone || !settings.email) {
      setToast({ message: 'Preencha todos os campos obrigatórios', type: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        company_name: settings.company_name,
        cnpj: settings.cnpj || '',
        phone: settings.phone,
        email: settings.email,
        address: settings.address || '',
        city: settings.city || '',
        state: settings.state || '',
        zip_code: settings.zip_code || '',
        logo_url: settings.logo_url || '',
        focus_nfe_token: settings.focus_nfe_token || '',
        focus_nfe_environment: settings.focus_nfe_environment || 'homologacao',
        inscricao_estadual: settings.inscricao_estadual || '',
        inscricao_municipal: settings.inscricao_municipal || '',
        regime_tributario: settings.regime_tributario || '1',
        cnae: settings.cnae || '',
        city_code: settings.city_code || '',
        updated_at: new Date().toISOString(),
      };

      console.log('💾 Dados que serão salvos:', dataToSave);
      console.log('🔍 Código do Município especificamente:', settings.city_code);
      console.log('🔍 ID do registro:', settings.id);

      if (settings.id) {
        console.log('📝 Atualizando registro existente...');
        const { data, error } = await supabase
          .from('system_settings')
          .update(dataToSave)
          .eq('id', settings.id)
          .select()
          .single();

        console.log('✅ Resposta do Supabase (update):', { data, error });
        
        if (error) throw error;
        
        if (data) {
          console.log('🔄 Dados atualizados no estado:', data);
          console.log('✅ Código do Município salvo:', data.city_code);
          setSettings(data);
        }
      } else {
        console.log('➕ Criando novo registro...');
        const { data, error } = await supabase
          .from('system_settings')
          .insert([{
            ...dataToSave,
            created_at: new Date().toISOString(),
          }])
          .select()
          .single();

        console.log('✅ Resposta do Supabase (insert):', { data, error });
        
        if (error) throw error;
        
        if (data) {
          console.log('🔄 Dados criados no estado:', data);
          console.log('✅ Código do Município salvo:', data.city_code);
          setSettings(data);
        }
      }

      setToast({ message: 'Configurações salvas com sucesso!', type: 'success' });
      
      console.log('🔄 Recarregando dados...');
      await loadSettings();
      console.log('✅ Dados recarregados!');
    } catch (error: any) {
      console.error('❌ Erro ao salvar configurações:', error);
      setToast({ message: `Erro ao salvar: ${error.message}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!settings.focus_nfe_token) {
      setToast({ message: 'Preencha o token da Focus NFe', type: 'warning' });
      return;
    }

    setTestingConnection(true);
    try {
      const { data, error } = await supabase.functions.invoke('focus-nfe-test-connection', {
        body: {
          token: settings.focus_nfe_token,
          environment: settings.focus_nfe_environment,
        },
      });

      if (error) throw error;

      if (data.success) {
        setToast({ message: 'Conexão testada com sucesso!', type: 'success' });
      } else {
        setToast({ message: data.message || 'Erro ao testar conexão', type: 'error' });
      }
    } catch (error: any) {
      console.error('Erro ao testar conexão:', error);
      setToast({ message: 'Erro ao testar conexão com Focus NFe', type: 'error' });
    } finally {
      setTestingConnection(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 overflow-auto md:ml-64">
          <MobileTopBar />
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-auto md:ml-64">
        <MobileTopBar />
        <div className="p-4 md:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Configurações da Empresa</h1>
            <p className="text-gray-600 mt-1">Gerencie as informações da sua empresa</p>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('general')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'general'
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <i className="ri-building-line mr-2"></i>
                Dados Gerais
              </button>
              <button
                onClick={() => setActiveTab('fiscal')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'fiscal'
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <i className="ri-file-text-line mr-2"></i>
                Configurações Fiscais (NF-e)
              </button>
            </nav>
          </div>

          {/* Dados Gerais */}
          {activeTab === 'general' && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome da Empresa *
                  </label>
                  <input
                    type="text"
                    value={settings.company_name}
                    onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Nome da sua empresa"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CNPJ
                  </label>
                  <input
                    type="text"
                    value={settings.cnpj}
                    onChange={(e) => {
                      // Remover tudo que não é número
                      let value = e.target.value.replace(/\D/g, '');
                      
                      // Limitar a 14 dígitos
                      if (value.length > 14) {
                        value = value.slice(0, 14);
                      }
                      
                      // Aplicar máscara: 00.000.000/0000-00
                      if (value.length > 0) {
                        value = value.replace(/^(\d{2})(\d)/, '$1.$2');
                        value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
                        value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
                        value = value.replace(/(\d{4})(\d)/, '$1-$2');
                      }
                      
                      setSettings({ ...settings, cnpj: value });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefone *
                  </label>
                  <input
                    type="text"
                    value={settings.phone}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    E-mail *
                  </label>
                  <input
                    type="email"
                    value={settings.email}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="contato@empresa.com"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Endereço
                  </label>
                  <input
                    type="text"
                    value={settings.address}
                    onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Rua, número, complemento"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={settings.city}
                    onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Cidade"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estado
                  </label>
                  <input
                    type="text"
                    value={settings.state}
                    onChange={(e) => setSettings({ ...settings, state: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="UF"
                    maxLength={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CEP
                  </label>
                  <input
                    type="text"
                    value={settings.zip_code}
                    onChange={(e) => setSettings({ ...settings, zip_code: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="00000-000"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    URL da Logo
                  </label>
                  <input
                    type="text"
                    value={settings.logo_url}
                    onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="https://exemplo.com/logo.png"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Cole aqui o link da logo da sua empresa (formato PNG, JPG ou SVG)
                  </p>
                  {settings.logo_url && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-2">Pré-visualização:</p>
                      <img 
                        src={settings.logo_url} 
                        alt="Preview da Logo" 
                        className="h-16 w-auto object-contain"
                        onError={(e) => {
                          e.currentTarget.src = '';
                          e.currentTarget.alt = 'Erro ao carregar imagem';
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {saving ? 'Salvando...' : 'Salvar Configurações'}
                </button>
              </div>
            </div>
          )}

          {/* Configurações Fiscais */}
          {activeTab === 'fiscal' && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <i className="ri-information-line text-blue-600 text-xl mr-3 mt-0.5"></i>
                    <div>
                      <h3 className="font-medium text-blue-900 mb-1">Integração com Focus NFe</h3>
                      <p className="text-sm text-blue-700">
                        Configure sua integração com a Focus NFe para emitir notas fiscais eletrônicas diretamente do sistema.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Token Focus NFe
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={settings.focus_nfe_token}
                      onChange={(e) => setSettings({ ...settings, focus_nfe_token: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="Seu token da Focus NFe"
                    />
                    <button
                      onClick={handleTestConnection}
                      disabled={testingConnection || !settings.focus_nfe_token}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {testingConnection ? 'Testando...' : 'Testar Conexão'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ambiente
                  </label>
                  <select
                    value={settings.focus_nfe_environment}
                    onChange={(e) => setSettings({ ...settings, focus_nfe_environment: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="homologacao">Homologação (Testes)</option>
                    <option value="producao">Produção</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Inscrição Estadual
                  </label>
                  <input
                    type="text"
                    value={settings.inscricao_estadual}
                    onChange={(e) => setSettings({ ...settings, inscricao_estadual: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="000.000.000.000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Inscrição Municipal *
                  </label>
                  <input
                    type="text"
                    value={settings.inscricao_municipal}
                    onChange={(e) => setSettings({ ...settings, inscricao_municipal: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="000000000"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Obrigatório para emissão de NFS-e
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Código do Município (IBGE) *
                  </label>
                  <input
                    type="text"
                    value={settings.city_code}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 7);
                      console.log('🔄 Alterando Código do Município:', value);
                      setSettings({ ...settings, city_code: value });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Ex: 3550308 (São Paulo)"
                    maxLength={7}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Código IBGE de 7 dígitos do município. 
                    <a 
                      href="https://www.ibge.gov.br/explica/codigos-dos-municipios.php" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-teal-600 hover:text-teal-700 ml-1"
                    >
                      Consultar código
                    </a>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Regime Tributário
                  </label>
                  <select
                    value={settings.regime_tributario}
                    onChange={(e) => setSettings({ ...settings, regime_tributario: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="1">Simples Nacional</option>
                    <option value="2">Simples Nacional - Excesso</option>
                    <option value="3">Regime Normal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CNAE Principal
                  </label>
                  <input
                    type="text"
                    value={settings.cnae}
                    onChange={(e) => setSettings({ ...settings, cnae: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="0000-0/00"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {saving ? 'Salvando...' : 'Salvar Configurações Fiscais'}
                </button>
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
        </div>
      </div>
    </div>
  );
}
