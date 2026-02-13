-- Tabela de mecânicos (apenas nome e telefone de contato).
-- Execute no SQL Editor do Supabase.

create table if not exists public.mechanics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_phone text,
  created_at timestamptz default now()
);

-- Índice para ordenação por nome
create index if not exists idx_mechanics_name on public.mechanics (name);

-- RLS
alter table public.mechanics enable row level security;

-- Autenticados podem ler, inserir, atualizar e excluir
drop policy if exists "Authenticated can manage mechanics" on public.mechanics;
create policy "Authenticated can manage mechanics"
  on public.mechanics
  for all
  to authenticated
  using (true)
  with check (true);

-- Comentários
comment on table public.mechanics is 'Cadastro de mecânicos (nome e telefone de contato).';
