-- Campos de perfil de mecânico na tabela system_users
-- Execute no SQL Editor do Supabase

alter table public.system_users
  add column if not exists contact_phone text,
  add column if not exists commission_percent numeric(5,2) not null default 0;

create index if not exists idx_system_users_contact_phone
  on public.system_users(contact_phone);

update public.system_users
set commission_percent = coalesce(commission_percent, 0)
where role = 'mechanic';
