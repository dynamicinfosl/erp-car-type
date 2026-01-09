import { useEffect, useState } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import { supabase, type Appointment, type Customer, type Vehicle } from '../../lib/supabase';

// 🔥 Funções utilitárias para CPF/CNPJ
const cleanDocument = (doc: string): string => {
  return doc.replace(/\D/g, '');
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

type AppointmentWithDetails = Appointment & {
  customer: Customer;
  vehicle: Vehicle;
};

export default function Appointments() {
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [formData, setFormData] = useState({
    vehicle_id: '',
    service_type: '',
    scheduled_date: '',
    scheduled_time: '',
    notes: '',
  });

  const [newCustomerDocumentType, setNewCustomerDocumentType] = useState<'CPF' | 'CNPJ' | null>(null);
  const [newCustomerForm, setNewCustomerForm] = useState({
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

  const [newCustomerVehicles, setNewCustomerVehicles] = useState<Array<{
    model: string;
    brand: string;
    year: string;
    plate: string;
    color: string;
    chassis: string;
    km: string;
  }>>([]);

  const [tempVehicleForm, setTempVehicleForm] = useState({
    model: '',
    brand: '',
    year: '',
    plate: '',
    color: '',
    chassis: '',
    km: '',
  });

  useEffect(() => {
    loadAppointments();
    loadCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      loadVehicles(selectedCustomer);
    }
  }, [selectedCustomer]);

  const loadAppointments = async () => {
    const { data } = await supabase
      .from('appointments')
      .select('*, customer:customers(*), vehicle:vehicles(*)')
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    if (data) {
      setAppointments(data as AppointmentWithDetails[]);
    }
  };

  const loadCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('name');
    if (data) setCustomers(data);
  };

  const loadVehicles = async (customerId: string) => {
    const { data } = await supabase
      .from('vehicles')
      .select('*')
      .eq('customer_id', customerId);
    if (data) setVehicles(data);
  };

  const createAppointment = async () => {
    if (!selectedCustomer || !formData.vehicle_id || !formData.service_type || !formData.scheduled_date || !formData.scheduled_time) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    await supabase.from('appointments').insert({
      customer_id: selectedCustomer,
      ...formData,
    });

    setShowModal(false);
    setSelectedCustomer('');
    setFormData({
      vehicle_id: '',
      service_type: '',
      scheduled_date: '',
      scheduled_time: '',
      notes: '',
    });
    loadAppointments();
  };

  const createNewCustomer = async () => {
    if (!newCustomerForm.name || !newCustomerForm.phone) {
      alert('Nome e telefone são obrigatórios');
      return;
    }

    // Limpar e salvar o documento sem formatação
    const customerData = {
      ...newCustomerForm,
      cpf: newCustomerForm.cpf ? cleanDocument(newCustomerForm.cpf) : '',
    };

    const { data, error } = await supabase
      .from('customers')
      .insert(customerData)
      .select()
      .single();

    if (error) {
      alert('Erro ao criar cliente');
      return;
    }

    if (data) {
      // Adicionar veículos se houver
      if (newCustomerVehicles.length > 0) {
        const vehiclesToInsert = newCustomerVehicles.map(v => ({
          customer_id: data.id,
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

      setShowNewCustomerModal(false);
      setNewCustomerDocumentType(null);
      setNewCustomerForm({ 
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
      setTempVehicleForm({
        model: '',
        brand: '',
        year: '',
        plate: '',
        color: '',
        chassis: '',
        km: '',
      });
      await loadCustomers();
      setSelectedCustomer(data.id);
    }
  };

  const addVehicleToNewCustomer = () => {
    if (!tempVehicleForm.model) {
      alert('Informe o modelo do veículo');
      return;
    }

    setNewCustomerVehicles([...newCustomerVehicles, { ...tempVehicleForm }]);
    setTempVehicleForm({
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

  const getStatusColor = (status: string) => {
    const colors = {
      scheduled: 'bg-blue-100 text-blue-700',
      confirmed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
      completed: 'bg-gray-100 text-gray-700',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      scheduled: 'Agendado',
      confirmed: 'Confirmado',
      cancelled: 'Cancelado',
      completed: 'Concluído',
    };
    return labels[status as keyof typeof labels] || status;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 overflow-auto ml-64">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Agenda</h1>
              <p className="text-gray-600">Gerenciar agendamentos</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition flex items-center gap-2 whitespace-nowrap"
            >
              <i className="ri-add-line text-xl"></i>
              Novo Agendamento
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Data/Hora</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Cliente</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Veículo</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Serviço</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {appointments.map((apt) => (
                    <tr key={apt.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {new Date(apt.scheduled_date).toLocaleDateString('pt-BR')}
                        </div>
                        <div className="text-sm text-gray-600">{apt.scheduled_time}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{apt.customer.name}</div>
                        <div className="text-sm text-gray-600">{apt.customer.phone}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{apt.vehicle.model}</div>
                        {apt.vehicle.plate && (
                          <div className="text-sm text-gray-600">{apt.vehicle.plate}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{apt.service_type}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(apt.status)}`}>
                          {getStatusLabel(apt.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button className="text-blue-600 hover:text-blue-700 cursor-pointer">
                          <i className="ri-more-2-fill text-xl"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Novo Agendamento</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cliente</label>
                <div className="flex gap-2">
                  <select
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none pr-8"
                  >
                    <option value="">Selecione um cliente</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} - {customer.phone}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowNewCustomerModal(true)}
                    className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition whitespace-nowrap"
                    title="Novo Cliente"
                  >
                    <i className="ri-add-line text-xl"></i>
                  </button>
                </div>
              </div>

              {selectedCustomer && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Veículo</label>
                  <select
                    value={formData.vehicle_id}
                    onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none pr-8"
                  >
                    <option value="">Selecione um veículo</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.model} {vehicle.year ? `- ${vehicle.year}` : ''} {vehicle.plate ? `(${vehicle.plate})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Serviço</label>
                <input
                  type="text"
                  value={formData.service_type}
                  onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Ex: Revisão, Troca de óleo..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
                  <input
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Horário</label>
                  <input
                    type="time"
                    value={formData.scheduled_time}
                    onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                  placeholder="Observações adicionais..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                onClick={createAppointment}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition whitespace-nowrap"
              >
                Criar Agendamento
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-8">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Novo Cliente</h2>
            </div>

            <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo *</label>
                  <input
                    type="text"
                    value={newCustomerForm.name}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Nome completo do cliente"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Telefone *</label>
                  <input
                    type="tel"
                    value={newCustomerForm.phone}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CPF/CNPJ {newCustomerDocumentType && <span className="text-blue-600 text-xs">({newCustomerDocumentType})</span>}
                  </label>
                  <input
                    type="text"
                    value={newCustomerForm.cpf}
                    onChange={(e) => {
                      const value = e.target.value;
                      const cleaned = cleanDocument(value);
                      
                      // Limitar a 14 dígitos (tamanho máximo do CNPJ)
                      if (cleaned.length > 14) return;
                      
                      // Detectar tipo automaticamente
                      const detectedType = getDocumentType(value);
                      setNewCustomerDocumentType(detectedType);
                      
                      // Formatar automaticamente
                      const formatted = formatDocument(value);
                      setNewCustomerForm({ ...newCustomerForm, cpf: formatted });
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    maxLength={18}
                  />
                  {newCustomerDocumentType && (
                    <p className="text-xs text-gray-500 mt-1">
                      {newCustomerDocumentType === 'CPF' ? 'CPF detectado (11 dígitos)' : 'CNPJ detectado (14 dígitos)'}
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={newCustomerForm.email}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="email@exemplo.com"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Endereço</label>
                  <input
                    type="text"
                    value={newCustomerForm.address}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Rua, número, complemento"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cidade</label>
                  <input
                    type="text"
                    value={newCustomerForm.city}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, city: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Cidade"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                  <input
                    type="text"
                    value={newCustomerForm.state}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, state: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="UF"
                    maxLength={2}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">CEP</label>
                  <input
                    type="text"
                    value={newCustomerForm.zip_code}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, zip_code: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="00000-000"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                  <textarea
                    value={newCustomerForm.notes}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                    placeholder="Observações sobre o cliente..."
                  />
                </div>
              </div>

              <div className="mt-6 border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Adicionar Veículos</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Marca</label>
                    <input
                      type="text"
                      value={tempVehicleForm.brand}
                      onChange={(e) => setTempVehicleForm({ ...tempVehicleForm, brand: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                      placeholder="Ex: Honda, Toyota"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Modelo</label>
                    <input
                      type="text"
                      value={tempVehicleForm.model}
                      onChange={(e) => setTempVehicleForm({ ...tempVehicleForm, model: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                      placeholder="Ex: Civic, Corolla"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ano</label>
                    <input
                      type="number"
                      value={tempVehicleForm.year}
                      onChange={(e) => setTempVehicleForm({ ...tempVehicleForm, year: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                      placeholder="2024"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Placa</label>
                    <input
                      type="text"
                      value={tempVehicleForm.plate}
                      onChange={(e) => setTempVehicleForm({ ...tempVehicleForm, plate: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                      placeholder="ABC-1234"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cor</label>
                    <input
                      type="text"
                      value={tempVehicleForm.color}
                      onChange={(e) => setTempVehicleForm({ ...tempVehicleForm, color: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                      placeholder="Ex: Preto, Branco"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Quilometragem</label>
                    <input
                      type="number"
                      value={tempVehicleForm.km}
                      onChange={(e) => setTempVehicleForm({ ...tempVehicleForm, km: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                      placeholder="Ex: 50000"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Chassi</label>
                    <input
                      type="text"
                      value={tempVehicleForm.chassis}
                      onChange={(e) => setTempVehicleForm({ ...tempVehicleForm, chassis: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                      placeholder="Número do chassi"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addVehicleToNewCustomer}
                  className="w-full px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition font-medium flex items-center justify-center gap-2"
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
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowNewCustomerModal(false);
                  setNewCustomerForm({ 
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
                  setTempVehicleForm({
                    model: '',
                    brand: '',
                    year: '',
                    plate: '',
                    color: '',
                    chassis: '',
                    km: '',
                  });
                }}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                onClick={createNewCustomer}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition whitespace-nowrap"
              >
                Criar Cliente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
