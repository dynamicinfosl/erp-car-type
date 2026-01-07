import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL e Anon Key são obrigatórios');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  created_at: string;
  updated_at: string;
};

export type Vehicle = {
  id: string;
  customer_id: string;
  model: string;
  year?: number;
  plate?: string;
  created_at: string;
  updated_at: string;
};

export type Conversation = {
  id: string;
  customer_id: string;
  last_message?: string;
  last_message_at: string;
  unread_count: number;
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_type: 'customer' | 'agent';
  content: string;
  sent_at: string;
  read_at?: string;
};

export type Appointment = {
  id: string;
  customer_id: string;
  vehicle_id: string;
  service_type: string;
  scheduled_date: string;
  scheduled_time: string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type ServiceOrder = {
  id: string;
  customer_id: string;
  vehicle_id: string;
  status: 'in_diagnosis' | 'waiting_approval' | 'in_service' | 'ready' | 'delivered';
  diagnosis?: string;
  budget?: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
};
