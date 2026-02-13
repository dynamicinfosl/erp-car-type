import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Sidebar from '../../components/layout/Sidebar';
import MobileTopBar from '../../components/layout/MobileTopBar';

interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  unit_price: number;
  estimated_time: number;
  active: boolean;
  created_at: string;
  codigo_servico_municipal?: string;
  issqn_aliquota?: number;
  isento_nfe?: boolean;
}

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'mecanica',
    unit_price: '',
    estimated_time: '',
    active: true,
    codigo_servico_municipal: '',
    issqn_aliquota: '5.00',
    isento_nfe: false,
    nbs_code: '',
    cnae_code: '',
  });

  const categories = [
    { value: 'mecanica', label: 'Mecânica Geral' },
    { value: 'eletrica', label: 'Elétrica' },
    { value: 'suspensao', label: 'Suspensão' },
    { value: 'freios', label: 'Freios' },
    { value: 'motor', label: 'Motor' },
    { value: 'cambio', label: 'Câmbio' },
    { value: 'ar_condicionado', label: 'Ar Condicionado' },
    { value: 'alinhamento', label: 'Alinhamento e Balanceamento' },
    { value: 'pneus', label: 'Pneus' },
    { value: 'estetica', label: 'Estética Automotiva' },
    { value: 'diagnostico', label: 'Diagnóstico' },
    { value: 'revisao', label: 'Revisão' },
    { value: 'outros', label: 'Outros' },
  ];

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('name');

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!formData.name || !formData.unit_price || !formData.estimated_time) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    try {
      const serviceData = {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        unit_price: parseFloat(formData.unit_price),
        estimated_time: parseInt(formData.estimated_time),
        active: formData.active,
        codigo_servico_municipal: formData.codigo_servico_municipal || null,
        issqn_aliquota: formData.issqn_aliquota ? parseFloat(formData.issqn_aliquota) : null,
        isento_nfe: formData.isento_nfe,
        nbs_code: formData.nbs_code || null,
        cnae_code: formData.cnae_code || null,
      };

      console.log('📝 FormData antes de salvar:', formData);
      console.log('💾 Dados que serão salvos no banco:', serviceData);

      if (editingService) {
        console.log('✏️ Atualizando serviço ID:', editingService.id);
        
        const { data, error } = await supabase
          .from('services')
          .update(serviceData)
          .eq('id', editingService.id)
          .select();

        if (error) {
          console.error('❌ Erro do Supabase:', error);
          throw error;
        }
        
        console.log('✅ Serviço atualizado! Dados retornados:', data);
      } else {
        console.log('➕ Criando novo serviço');
        
        const { data, error } = await supabase
          .from('services')
          .insert([serviceData])
          .select();

        if (error) {
          console.error('❌ Erro do Supabase:', error);
          throw error;
        }
        
        console.log('✅ Serviço criado! Dados retornados:', data);
      }

      setShowModal(false);
      resetForm();
      await fetchServices();
      await fetchMechanicCommissions();
      
      console.log('🔄 Serviços recarregados');
    } catch (error) {
      console.error('❌ Erro ao salvar serviço:', error);
      alert('Erro ao salvar serviço');
    }
  };

  const handleEdit = (service: Service) => {
    console.log('📖 Abrindo serviço para edição:', service);
    console.log('🔍 Campos fiscais do serviço:', {
      codigo_servico_municipal: service.codigo_servico_municipal,
      issqn_aliquota: service.issqn_aliquota,
      isento_nfe: service.isento_nfe,
      nbs_code: service.nbs_code,
      cnae_code: service.cnae_code,
    });
    
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || '',
      category: service.category,
      unit_price: service.unit_price.toString(),
      estimated_time: service.estimated_time.toString(),
      active: service.active,
      codigo_servico_municipal: service.codigo_servico_municipal || '',
      issqn_aliquota: service.issqn_aliquota?.toString() || '5.00',
      isento_nfe: service.isento_nfe || false,
      nbs_code: service.nbs_code || '',
      cnae_code: service.cnae_code || '',
    });
    
    console.log('📝 FormData preenchido:', {
      codigo_servico_municipal: service.codigo_servico_municipal || '',
      issqn_aliquota: service.issqn_aliquota?.toString() || '5.00',
      isento_nfe: service.isento_nfe || false,
      nbs_code: service.nbs_code || '',
      cnae_code: service.cnae_code || '',
    });
    
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este serviço?')) return;

    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchServices();
      fetchMechanicCommissions();
    } catch (error) {
      console.error('Erro ao excluir serviço:', error);
      alert('Erro ao excluir serviço');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'mecanica',
      unit_price: '',
      estimated_time: '',
      active: true,
      codigo_servico_municipal: '',
      issqn_aliquota: '5.00',
      isento_nfe: false,
      nbs_code: '',
      cnae_code: '',
    });
    setEditingService(null);
  };

  const filteredServices = services.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         service.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || service.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryLabel = (value: string) => {
    return categories.find(c => c.value === value)?.label || value;
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 overflow-auto md:ml-64">
        <MobileTopBar />
        <div className="p-4 md:p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Serviços</h1>
              <p className="text-gray-600 mt-1">Gerencie os serviços prestados pela oficina</p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 transition flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <i className="ri-add-line text-xl"></i>
              Novo Serviço
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input
                  type="text"
                  placeholder="Buscar serviços..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              </div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
              >
                <option value="all">Todas as Categorias</option>
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredServices.map((service) => (
                <div key={service.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-700 rounded-lg flex items-center justify-center">
                        <i className="ri-tools-line text-2xl text-white"></i>
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{service.name}</h3>
                        <p className="text-xs text-gray-500">{getCategoryLabel(service.category)}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      service.active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {service.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  {service.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{service.description}</p>
                  )}

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Valor:</span>
                      <span className="text-lg font-bold text-teal-600">
                        R$ {service.unit_price.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Tempo estimado:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {service.estimated_time} min
                      </span>
                    </div>
                    {service.codigo_servico_municipal && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Cód. Fiscal:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {service.codigo_servico_municipal}
                        </span>
                      </div>
                    )}
                    {service.isento_nfe && (
                      <div className="flex items-center justify-center mt-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <i className="ri-information-line mr-1"></i>
                          Isento de NF-e
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleEdit(service)}
                      className="flex-1 px-4 py-2 bg-teal-50 text-teal-600 rounded-lg hover:bg-teal-100 transition text-sm font-medium cursor-pointer"
                    >
                      <i className="ri-edit-line mr-1"></i>
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(service.id)}
                      className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-sm font-medium cursor-pointer"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && filteredServices.length === 0 && (
            <div className="text-center py-12 text-gray-500 bg-white rounded-xl">
              <i className="ri-tools-line text-5xl mb-4"></i>
              <p>Nenhum serviço encontrado</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingService ? 'Editar Serviço' : 'Novo Serviço'}
                </h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <i className="ri-close-line text-2xl"></i>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome do Serviço *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    placeholder="Ex: Troca de Óleo, Alinhamento e Balanceamento"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descrição
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm resize-none"
                    placeholder="Descrição detalhada do serviço..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Categoria *
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                  >
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Valor do Serviço (R$) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={formData.unit_price}
                        onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                        placeholder="0,00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tempo Estimado (minutos) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.estimated_time}
                      onChange={(e) => setFormData({ ...formData, estimated_time: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                      placeholder="Ex: 60"
                    />
                  </div>
                </div>

                {/* Seção de Dados Fiscais */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <i className="ri-file-text-line text-teal-600"></i>
                    Dados Fiscais (NF-e)
                  </h3>

                  <div className="space-y-4">
                    <div className="flex items-center">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isento_nfe}
                          onChange={(e) => setFormData({ ...formData, isento_nfe: e.target.checked })}
                          className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          <i className="ri-information-line text-yellow-600 mr-1"></i>
                          Este serviço é isento de emissão de NF-e
                        </span>
                      </label>
                    </div>

                    {!formData.isento_nfe && (
                      <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Código do Serviço Municipal *
                            </label>
                            <input
                              type="text"
                              value={formData.codigo_servico_municipal}
                              onChange={(e) => setFormData({ ...formData, codigo_servico_municipal: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                              placeholder="Ex: 010101"
                              maxLength={6}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              6 dígitos - Código do serviço conforme lista municipal
                            </p>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Código NBS *
                            </label>
                            <input
                              type="text"
                              value={formData.nbs_code}
                              onChange={(e) => setFormData({ ...formData, nbs_code: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                              placeholder="Ex: 116010100"
                              maxLength={9}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              9 dígitos - Nomenclatura Brasileira de Serviços
                            </p>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Código CNAE
                            </label>
                            <input
                              type="text"
                              value={formData.cnae_code}
                              onChange={(e) => setFormData({ ...formData, cnae_code: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                              placeholder="Ex: 4520001"
                              maxLength={7}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              7 dígitos - Classificação Nacional de Atividades Econômicas
                            </p>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Alíquota ISS (%)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={formData.issqn_aliquota}
                              onChange={(e) => setFormData({ ...formData, issqn_aliquota: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                              placeholder="5.00"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Alíquota de ISS do seu município
                            </p>
                          </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex gap-2">
                            <i className="ri-information-line text-blue-600 text-lg flex-shrink-0"></i>
                            <div className="text-xs text-blue-800">
                              <p className="font-medium mb-1">Campos obrigatórios para NFS-e:</p>
                              <ul className="list-disc list-inside space-y-1">
                                <li><strong>Código do Serviço Municipal:</strong> 6 dígitos (ex: 010101)</li>
                                <li><strong>Código NBS:</strong> 9 dígitos (ex: 116010100)</li>
                                <li><strong>Código CNAE:</strong> Opcional, mas recomendado</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
                    />
                    <span className="ml-2 text-sm text-gray-700">Serviço Ativo</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition whitespace-nowrap cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition whitespace-nowrap cursor-pointer"
                >
                  {editingService ? 'Salvar Alterações' : 'Criar Serviço'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
