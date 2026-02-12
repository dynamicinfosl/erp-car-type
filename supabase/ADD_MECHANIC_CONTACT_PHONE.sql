-- Adiciona telefone de contato para usuários/mecânicos
-- Execute no SQL Editor do Supabase

alter table public.system_users
  add column if not exists contact_phone text;

create index if not exists idx_system_users_contact_phone
  on public.system_users(contact_phone);
