import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Sidebar from '../../components/layout/Sidebar';
import MobileTopBar from '../../components/layout/MobileTopBar';

interface Stats {
  totalCustomers: number;
  activeOrders: number;
  todayAppointments: number;
  monthRevenue: number;
  monthExpenses: number;
}

interface Appointment {
  id: string;
  service_type: string;
  scheduled_date: string;
  customer: {
    name: string;
  };
  vehicle: {
    model: string;
    plate: string;
  };
}

interface ServiceOrder {
  id: string;
  status: string;
  diagnosis: string;
  customer: {
    name: string;
  };
  vehicle: {
    model: string;
    plate: string;
  };
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalCustomers: 0,
    activeOrders: 0,
    todayAppointments: 0,
    monthRevenue: 0,
    monthExpenses: 0,
  });
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [activeServiceOrders, setActiveServiceOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Data atual
      const today = new Date().toISOString().split('T')[0];
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const lastDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

      // Total de clientes
      const { count: customersCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true });

      // Ordens de serviço ativas
      const { data: activeOrders } = await supabase
        .from('service_orders')
        .select('*, customer:customers(name), vehicle:vehicles(model, plate)')
        .in('status', ['in_diagnosis', 'waiting_approval', 'in_service']);

      // Agendamentos de hoje
      const { data: appointments } = await supabase
        .from('appointments')
        .select('*, customer:customers(name), vehicle:vehicles(model, plate)')
        .eq('scheduled_date', today)
        .order('scheduled_date', { ascending: true });

      // Receitas do mês
      const { data: revenues } = await supabase
        .from('revenues')
        .select('amount')
        .gte('date', firstDayOfMonth)
        .lte('date', lastDayOfMonth);

      // Despesas do mês
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount')
        .gte('date', firstDayOfMonth)
        .lte('date', lastDayOfMonth);

      const totalRevenue = revenues?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;
      const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      setStats({
        totalCustomers: customersCount || 0,
        activeOrders: activeOrders?.length || 0,
        todayAppointments: appointments?.length || 0,
        monthRevenue: totalRevenue,
        monthExpenses: totalExpenses,
      });

      setTodayAppointments(appointments || []);
      setActiveServiceOrders(activeOrders || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      in_diagnosis: 'bg-blue-100 text-blue-800',
      waiting_approval: 'bg-yellow-100 text-yellow-800',
      in_service: 'bg-purple-100 text-purple-800',
      ready: 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      in_diagnosis: 'Em Diagnóstico',
      waiting_approval: 'Aguardando Aprovação',
      in_service: 'Em Serviço',
      ready: 'Pronto',
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-3">
          <i className="ri-loader-4-line text-4xl text-teal-600 animate-spin"></i>
          <p className="text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  const monthProfit = stats.monthRevenue - stats.monthExpenses;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-auto md:ml-64">
        <MobileTopBar />
        <div className="p-4 md:p-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Visão geral do sistema</p>
          </div>

          {/* Cards de Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total de Clientes</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalCustomers}</p>
                </div>
                <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                  <i className="ri-user-line text-2xl text-teal-600"></i>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Ordens Ativas</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.activeOrders}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <i className="ri-tools-line text-2xl text-purple-600"></i>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Agendamentos Hoje</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.todayAppointments}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <i className="ri-calendar-check-line text-2xl text-blue-600"></i>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Receitas do Mês</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    R$ {stats.monthRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <i className="ri-arrow-up-line text-2xl text-green-600"></i>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Despesas do Mês</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">
                    R$ {stats.monthExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <i className="ri-arrow-down-line text-2xl text-red-600"></i>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Agendamentos de Hoje */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <i className="ri-calendar-line text-xl text-blue-600"></i>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Agendamentos de Hoje</h2>
                    <p className="text-sm text-gray-600">{todayAppointments.length} agendamento(s)</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {todayAppointments.length === 0 ? (
                  <div className="text-center py-8">
                    <i className="ri-calendar-check-line text-5xl text-gray-300"></i>
                    <p className="text-gray-500 mt-3">Nenhum agendamento para hoje</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todayAppointments.map((appointment) => (
                      <div key={appointment.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <i className="ri-time-line text-blue-600"></i>
                              <span className="font-semibold text-gray-900">
                                {new Date(appointment.scheduled_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-gray-900">{appointment.service_type}</p>
                            <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                              <i className="ri-user-line"></i>
                              <span>{appointment.customer.name}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                              <i className="ri-car-line"></i>
                              <span>{appointment.vehicle.model}</span>
                              {appointment.vehicle.plate && (
                                <span className="bg-gray-200 px-2 py-0.5 rounded text-xs font-mono">
                                  {appointment.vehicle.plate}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Carros em Serviço */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <i className="ri-car-line text-xl text-purple-600"></i>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Carros em Serviço</h2>
                    <p className="text-sm text-gray-600">{activeServiceOrders.length} veículo(s)</p>
                  </div>
                </div>
              </div>
              <div className="p-6 max-h-96 overflow-y-auto">
                {activeServiceOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <i className="ri-car-line text-5xl text-gray-300"></i>
                    <p className="text-gray-500 mt-3">Nenhum carro em serviço</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeServiceOrders.map((order) => (
                      <div key={order.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-purple-300 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 bg-white rounded-lg border-2 border-gray-300 flex items-center justify-center flex-shrink-0">
                            <i className="ri-car-fill text-2xl text-gray-600"></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-bold text-gray-900">{order.vehicle.model}</span>
                              {order.vehicle.plate && (
                                <span className="bg-gray-900 text-white px-2 py-0.5 rounded text-xs font-mono">
                                  {order.vehicle.plate}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <i className="ri-user-line text-gray-500"></i>
                              <span className="text-sm text-gray-700 font-medium">{order.customer.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                {getStatusLabel(order.status)}
                              </span>
                            </div>
                            {order.diagnosis && (
                              <p className="text-sm text-gray-600 mt-2 line-clamp-2">{order.diagnosis}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}