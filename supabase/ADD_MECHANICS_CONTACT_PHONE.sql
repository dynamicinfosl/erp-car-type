-- Adiciona a coluna contact_phone na tabela mechanics (se não existir).
-- Execute no SQL Editor do Supabase.

alter table public.mechanics
  add column if not exists contact_phone text;

comment on column public.mechanics.contact_phone is 'Telefone de contato do mecânico.';
