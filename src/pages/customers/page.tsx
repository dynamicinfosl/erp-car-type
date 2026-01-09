import { useEffect, useState } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import { supabase, type Customer, type Vehicle } from '../../lib/supabase';

type CustomerWithVehicles = Customer & {
  vehicles: Vehicle[];
};

// 🔥 Funções utilitárias para CPF/CNPJ
const cleanDocument = (doc: string): string => {
  return doc.replace(/\D/g, '');
};

const isCPF = (doc: string): boolean => {
  const cleaned = cleanDocument(doc);
  return cleaned.length === 11;
};

const isCNPJ = (doc: string): boolean => {
  const cleaned = cleanDocument(doc);
  return cleaned.length === 14;
};

const formatCPF = (cpf: string): string => {
  const cleaned = cleanDocument(cpf);
  if (cleaned.length !== 11) return cpf;
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

const formatCNPJ = (cnpj: string): string => {
  const cleaned = cleanDocument(cnpj);
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

const formatDocument = (doc: string): string => {
  if (!doc) return '';
  const cleaned = cleanDocument(doc);
  if (cleaned.length === 11) return formatCPF(doc);
  if (cleaned.length === 14) return formatCNPJ(doc);
  return doc;
};

const getDocumentType = (doc: string): 'CPF' | 'CNPJ' | null => {
  if (!doc) return null;
  const cleaned = cleanDocument(doc);
  if (cleaned.length === 11) return 'CPF';
  if (cleaned.length === 14) return 'CNPJ';
  return null;
};

export default function Customers() {
  const [customers, setCustomers] = useState<CustomerWithVehicles[]>([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [documentType, setDocumentType] = useState<'CPF' | 'CNPJ' | null>(null);
  
  const [customerForm, setCustomerForm] = useState({
    name: '',
    phone: '',
    email: '',
    cpf: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    notes: '',
  });

  const [vehicleForm, setVehicleForm] = useState({
    model: '',
    brand: '',
    year: '',
    plate: '',
    color: '',
    chassis: '',
    km: '',
  });

  const [newCustomerVehicles, setNewCustomerVehicles] = useState<Array<{
    model: string;
    brand: string;
    year: string;
    plate: string;
    color: string;
    chassis: string;
    km: string;
  }>>([]);

  useEffect(() => {
    loadCustomers();
  }, []);

  // 🔥 Função para corrigir documentos existentes (CNPJs que estão no campo CPF)
  const fixExistingDocuments = async () => {
    if (!confirm('Esta ação irá corrigir todos os documentos cadastrados, identificando automaticamente CPFs e CNPJs. Deseja continuar?')) {
      return;
    }

    try {
      // Buscar todos os clientes com CPF preenchido
      const { data: allCustomers, error: fetchError } = await supabase
        .from('customers')
        .select('id, cpf')
        .not('cpf', 'is', null);

      if (fetchError) throw fetchError;

      if (!allCustomers || allCustomers.length === 0) {
        alert('Nenhum cliente com documento cadastrado encontrado.');
        return;
      }

      let fixed = 0;
      let unchanged = 0;

      // Processar cada cliente
      for (const customer of allCustomers) {
        if (!customer.cpf) continue;

        const cleaned = cleanDocument(customer.cpf);
        
        // Se já está correto (11 ou 14 dígitos), não precisa corrigir
        if (cleaned.length === 11 || cleaned.length === 14) {
          unchanged++;
          continue;
        }

        // Se tem mais de 11 dígitos mas menos de 14, pode ser um CNPJ incompleto
        // Ou se tem exatamente 14 dígitos mas não está formatado, é CNPJ
        if (cleaned.length === 14) {
          // É CNPJ, já está correto (só precisa garantir que está limpo)
          await supabase
            .from('customers')
            .update({ cpf: cleaned })
            .eq('id', customer.id);
          fixed++;
        } else if (cleaned.length > 11) {
          // Tem mais de 11 dígitos, provavelmente é CNPJ
          // Pegar apenas os primeiros 14 dígitos
          const cnpj = cleaned.substring(0, 14);
          await supabase
            .from('customers')
            .update({ cpf: cnpj })
            .eq('id', customer.id);
          fixed++;
        } else if (cleaned.length < 11 && cleaned.length > 0) {
          // Tem menos de 11 dígitos, pode ser CPF incompleto
          // Preencher com zeros à direita até ter 11 dígitos (ou deixar como está)
          // Na verdade, melhor deixar como está para não corromper dados
          unchanged++;
        }
      }

      alert(`Migração concluída!\n\nCorrigidos: ${fixed}\nInalterados: ${unchanged}\n\nOs documentos foram identificados e formatados automaticamente.`);
      loadCustomers();
    } catch (error: any) {
      console.error('Erro ao corrigir documentos:', error);
      alert(`Erro ao corrigir documentos: ${error.message}`);
    }
  };

  const loadCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*, vehicles(*)')
      .order('name');
    if (data) setCustomers(data as CustomerWithVehicles[]);
  };

  const openEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    const cpfValue = customer.cpf || '';
    setDocumentType(getDocumentType(cpfValue));
    setCustomerForm({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      cpf: formatDocument(cpfValue),
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      zip_code: customer.zip_code || '',
      notes: customer.notes || '',
    });
    setShowCustomerModal(true);
  };

  const saveCustomer = async () => {
    if (!customerForm.name || !customerForm.phone) {
      alert('Nome e telefone são obrigatórios');
      return;
    }

    // Limpar e salvar o documento sem formatação
    const documentToSave = customerForm.cpf ? cleanDocument(customerForm.cpf) : '';

    const customerData = {
      ...customerForm,
      cpf: documentToSave,
    };

    if (editingCustomer) {
      await supabase
        .from('customers')
        .update(customerData)
        .eq('id', editingCustomer.id);
    } else {
      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert(customerData)
        .select()
        .single();

      if (error) {
        alert('Erro ao criar cliente');
        return;
      }

      // Adicionar veículos se houver
      if (newCustomer && newCustomerVehicles.length > 0) {
        const vehiclesToInsert = newCustomerVehicles.map(v => ({
          customer_id: newCustomer.id,
          model: v.model,
          brand: v.brand || null,
          year: v.year ? parseInt(v.year) : null,
          plate: v.plate || null,
          color: v.color || null,
          chassis: v.chassis || null,
          km: v.km ? parseInt(v.km) : null,
        }));

        await supabase.from('vehicles').insert(vehiclesToInsert);
      }
    }

    setShowCustomerModal(false);
    setEditingCustomer(null);
    setDocumentType(null);
    setCustomerForm({
      name: '',
      phone: '',
      email: '',
      cpf: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      notes: '',
    });
    setNewCustomerVehicles([]);
    loadCustomers();
  };

  const deleteCustomer = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;
    
    await supabase.from('customers').delete().eq('id', id);
    loadCustomers();
  };

  const createVehicle = async () => {
    if (!selectedCustomer || !vehicleForm.model) {
      alert('Selecione um cliente e informe o modelo');
      return;
    }

    await supabase.from('vehicles').insert({
      customer_id: selectedCustomer.id,
      model: vehicleForm.model,
      brand: vehicleForm.brand || null,
      year: vehicleForm.year ? parseInt(vehicleForm.year) : null,
      plate: vehicleForm.plate || null,
      color: vehicleForm.color || null,
      chassis: vehicleForm.chassis || null,
      km: vehicleForm.km ? parseInt(vehicleForm.km) : null,
    });

    setShowVehicleModal(false);
    setVehicleForm({
      model: '',
      brand: '',
      year: '',
      plate: '',
      color: '',
      chassis: '',
      km: '',
    });
    setSelectedCustomer(null);
    loadCustomers();
  };

  const deleteVehicle = async (vehicleId: string) => {
    if (!confirm('Tem certeza que deseja excluir este veículo?')) return;
    
    await supabase.from('vehicles').delete().eq('id', vehicleId);
    loadCustomers();
  };

  const addVehicleToNewCustomer = () => {
    if (!vehicleForm.model) {
      alert('Informe o modelo do veículo');
      return;
    }

    setNewCustomerVehicles([...newCustomerVehicles, { ...vehicleForm }]);
    setVehicleForm({
      model: '',
      brand: '',
      year: '',
      plate: '',
      color: '',
      chassis: '',
      km: '',
    });
  };

  const removeVehicleFromNewCustomer = (index: number) => {
    setNewCustomerVehicles(newCustomerVehicles.filter((_, i) => i !== index));
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.cpf?.includes(searchTerm)
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 overflow-auto ml-64">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Clientes</h1>
              <p className="text-gray-600">Gerenciar clientes e veículos</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fixExistingDocuments}
                className="px-4 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition flex items-center gap-2 whitespace-nowrap text-sm"
                title="Corrigir documentos existentes (CPF/CNPJ)"
              >
                <i className="ri-refresh-line text-lg"></i>
                Corrigir Documentos
              </button>
              <button
                onClick={() => {
                  setEditingCustomer(null);
                  setDocumentType(null);
                  setCustomerForm({
                    name: '',
                    phone: '',
                    email: '',
                    cpf: '',
                    address: '',
                    city: '',
                    state: '',
                    zip_code: '',
                    notes: '',
                  });
                  setShowCustomerModal(true);
                }}
                className="px-6 py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition flex items-center gap-2 whitespace-nowrap"
              >
                <i className="ri-add-line text-xl"></i>
                Novo Cliente
              </button>
            </div>
          </div>

          <div className="mb-6">
            <div className="relative">
              <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl"></i>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, telefone, email, CPF ou CNPJ..."
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {filteredCustomers.map((customer) => (
              <div key={customer.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-700 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {customer.name.charAt(0).toUpperCase()}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 truncate">{customer.name}</h3>
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <i className="ri-phone-line text-teal-600"></i>
                          {customer.phone}
                        </span>
                        {customer.email && (
                          <span className="flex items-center gap-1 truncate">
                            <i className="ri-mail-line text-teal-600"></i>
                            <span className="truncate">{customer.email}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {customer.vehicles && customer.vehicles.length > 0 && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {customer.vehicles.slice(0, 2).map((vehicle) => (
                        <div key={vehicle.id} className="bg-gray-50 rounded px-2 py-1 border border-gray-200">
                          <p className="text-xs font-semibold text-gray-900 truncate max-w-[120px]">
                            {vehicle.brand ? `${vehicle.brand} ` : ''}{vehicle.model}
                          </p>
                          {vehicle.plate && (
                            <p className="text-xs font-mono text-gray-600">{vehicle.plate}</p>
                          )}
                        </div>
                      ))}
                      {customer.vehicles.length > 2 && (
                        <span className="text-xs text-gray-500">+{customer.vehicles.length - 2}</span>
                      )}
                    </div>
                  )}

                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setShowVehicleModal(true);
                      }}
                      className="px-2 py-1.5 bg-teal-50 text-teal-600 rounded text-sm font-medium hover:bg-teal-100 transition flex items-center gap-1 whitespace-nowrap cursor-pointer"
                      title="Adicionar veículo"
                    >
                      <i className="ri-car-line text-sm"></i>
                    </button>
                    <button
                      onClick={() => openEditCustomer(customer)}
                      className="px-2 py-1.5 bg-blue-50 text-blue-600 rounded text-sm font-medium hover:bg-blue-100 transition whitespace-nowrap cursor-pointer"
                      title="Editar cliente"
                    >
                      <i className="ri-edit-line text-sm"></i>
                    </button>
                    <button
                      onClick={() => deleteCustomer(customer.id)}
                      className="px-2 py-1.5 bg-red-50 text-red-600 rounded text-sm font-medium hover:bg-red-100 transition whitespace-nowrap cursor-pointer"
                      title="Excluir cliente"
                    >
                      <i className="ri-delete-bin-line text-sm"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredCustomers.length === 0 && (
            <div className="text-center py-12">
              <i className="ri-user-line text-6xl text-gray-300 mb-4"></i>
              <p className="text-gray-500">Nenhum cliente encontrado</p>
            </div>
          )}
        </div>
      </div>

      {showCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-8">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}
              </h2>
            </div>

            <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo *</label>
                  <input
                    type="text"
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="Nome completo do cliente"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Telefone *</label>
                  <input
                    type="tel"
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CPF/CNPJ {documentType && <span className="text-teal-600 text-xs">({documentType})</span>}
                  </label>
                  <input
                    type="text"
                    value={customerForm.cpf}
                    onChange={(e) => {
                      const value = e.target.value;
                      const cleaned = cleanDocument(value);
                      
                      // Limitar a 14 dígitos (tamanho máximo do CNPJ)
                      if (cleaned.length > 14) return;
                      
                      // Detectar tipo automaticamente
                      const detectedType = getDocumentType(value);
                      setDocumentType(detectedType);
                      
                      // Formatar automaticamente
                      const formatted = formatDocument(value);
                      setCustomerForm({ ...customerForm, cpf: formatted });
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    maxLength={18}
                  />
                  {documentType && (
                    <p className="text-xs text-gray-500 mt-1">
                      {documentType === 'CPF' ? 'CPF detectado (11 dígitos)' : 'CNPJ detectado (14 dígitos)'}
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="email@exemplo.com"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Endereço</label>
                  <input
                    type="text"
                    value={customerForm.address}
                    onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="Rua, número, complemento"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cidade</label>
                  <input
                    type="text"
                    value={customerForm.city}
                    onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="Cidade"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                  <input
                    type="text"
                    value={customerForm.state}
                    onChange={(e) => setCustomerForm({ ...customerForm, state: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="UF"
                    maxLength={2}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">CEP</label>
                  <input
                    type="text"
                    value={customerForm.zip_code}
                    onChange={(e) => setCustomerForm({ ...customerForm, zip_code: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="00000-000"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                  <textarea
                    value={customerForm.notes}
                    onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none resize-none"
                    placeholder="Observações sobre o cliente..."
                  />
                </div>
              </div>

              {editingCustomer && (
                <div className="mt-6 border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
                    <span>Veículos do Cliente</span>
                    <button
                      onClick={() => {
                        setSelectedCustomer(editingCustomer);
                        setShowVehicleModal(true);
                      }}
                      className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition flex items-center gap-1.5"
                    >
                      <i className="ri-add-line"></i>
                      Adicionar Veículo
                    </button>
                  </h3>
                  
                  {customers.find(c => c.id === editingCustomer.id)?.vehicles && 
                   customers.find(c => c.id === editingCustomer.id)!.vehicles.length > 0 ? (
                    <div className="space-y-2">
                      {customers.find(c => c.id === editingCustomer.id)!.vehicles.map((vehicle) => (
                        <div key={vehicle.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm">
                              {vehicle.brand ? `${vehicle.brand} ` : ''}{vehicle.model}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-600">
                              {vehicle.year && <span>Ano: {vehicle.year}</span>}
                              {vehicle.plate && <span className="font-mono bg-white px-2 py-0.5 rounded border border-gray-300">{vehicle.plate}</span>}
                              {vehicle.color && <span>Cor: {vehicle.color}</span>}
                              {vehicle.km && <span>KM: {vehicle.km.toLocaleString()}</span>}
                            </div>
                          </div>
                          <button
                            onClick={() => deleteVehicle(vehicle.id)}
                            className="text-red-600 hover:text-red-700 ml-2 cursor-pointer"
                            title="Excluir veículo"
                          >
                            <i className="ri-delete-bin-line text-sm"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">Nenhum veículo cadastrado</p>
                  )}
                </div>
              )}

              {!editingCustomer && (
                <div className="mt-6 border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Adicionar Veículos</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Marca</label>
                      <input
                        type="text"
                        value={vehicleForm.brand}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, brand: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm"
                        placeholder="Ex: Honda, Toyota"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Modelo</label>
                      <input
                        type="text"
                        value={vehicleForm.model}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm"
                        placeholder="Ex: Civic, Corolla"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Ano</label>
                      <input
                        type="number"
                        value={vehicleForm.year}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, year: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm"
                        placeholder="2024"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Placa</label>
                      <input
                        type="text"
                        value={vehicleForm.plate}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm"
                        placeholder="ABC-1234"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cor</label>
                      <input
                        type="text"
                        value={vehicleForm.color}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, color: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm"
                        placeholder="Ex: Preto, Branco"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Quilometragem</label>
                      <input
                        type="number"
                        value={vehicleForm.km}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, km: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm"
                        placeholder="Ex: 50000"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Chassi</label>
                      <input
                        type="text"
                        value={vehicleForm.chassis}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, chassis: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm"
                        placeholder="Número do chassi"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={addVehicleToNewCustomer}
                    className="w-full px-4 py-2 bg-teal-50 text-teal-600 rounded-lg hover:bg-teal-100 transition font-medium flex items-center justify-center gap-2"
                  >
                    <i className="ri-add-line"></i>
                    Adicionar Veículo
                  </button>

                  {newCustomerVehicles.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <h4 className="text-sm font-semibold text-gray-700">Veículos a serem cadastrados:</h4>
                      {newCustomerVehicles.map((vehicle, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">
                              {vehicle.brand ? `${vehicle.brand} ` : ''}{vehicle.model}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-600">
                              {vehicle.year && <span>Ano: {vehicle.year}</span>}
                              {vehicle.plate && <span className="font-mono bg-white px-2 py-0.5 rounded border border-gray-300">{vehicle.plate}</span>}
                              {vehicle.color && <span>Cor: {vehicle.color}</span>}
                              {vehicle.km && <span>KM: {parseInt(vehicle.km).toLocaleString()}</span>}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeVehicleFromNewCustomer(index)}
                            className="text-red-600 hover:text-red-700 ml-2"
                          >
                            <i className="ri-delete-bin-line"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowCustomerModal(false);
                  setEditingCustomer(null);
                  setNewCustomerVehicles([]);
                }}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                onClick={saveCustomer}
                className="px-6 py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition whitespace-nowrap"
              >
                {editingCustomer ? 'Salvar Alterações' : 'Criar Cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showVehicleModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Novo Veículo</h2>
              <p className="text-sm text-gray-600 mt-1">Cliente: {selectedCustomer.name}</p>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Marca</label>
                  <input
                    type="text"
                    value={vehicleForm.brand}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, brand: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="Ex: Honda, Toyota, Fiat"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Modelo *</label>
                  <input
                    type="text"
                    value={vehicleForm.model}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="Ex: Civic, Corolla, Uno"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ano</label>
                  <input
                    type="number"
                    value={vehicleForm.year}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, year: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="2024"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Placa</label>
                  <input
                    type="text"
                    value={vehicleForm.plate}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="ABC-1234"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cor</label>
                  <input
                    type="text"
                    value={vehicleForm.color}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, color: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="Ex: Preto, Branco, Prata"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quilometragem</label>
                  <input
                    type="number"
                    value={vehicleForm.km}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, km: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="Ex: 50000"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Chassi</label>
                  <input
                    type="text"
                    value={vehicleForm.chassis}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, chassis: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="Número do chassi"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowVehicleModal(false);
                  setSelectedCustomer(null);
                }}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                onClick={createVehicle}
                className="px-6 py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition whitespace-nowrap"
              >
                Adicionar Veículo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}