-- Políticas RLS para system_users (login + cadastro de mecânicos/usuários).
-- Usa função SECURITY DEFINER para evitar recursão (500).
-- Cole tudo no SQL Editor do Supabase e execute.

-- 1) Função que verifica se o usuário atual é master ou admin (ignora RLS = sem recursão)
create or replace function public.is_system_master_or_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.system_users
    where email = (auth.jwt()->>'email')
    and role in ('master', 'admin')
  );
$$;

grant execute on function public.is_system_master_or_admin() to authenticated;
grant execute on function public.is_system_master_or_admin() to anon;

-- 2) Ativar RLS na tabela
alter table public.system_users enable row level security;

-- SELECT: usuário pode ler a própria linha (login) OU master/admin podem ler todas
drop policy if exists "Users can read own system_users row" on public.system_users;
create policy "Users can read own system_users row"
  on public.system_users for select
  using ((auth.jwt()->>'email') = email);

drop policy if exists "Master or admin can read all system_users" on public.system_users;
create policy "Master or admin can read all system_users"
  on public.system_users for select
  using (public.is_system_master_or_admin());

-- Usuários autenticados podem ler mecânicos (necessário para o dropdown na ordem de serviço)
drop policy if exists "Authenticated can read mechanics" on public.system_users;
create policy "Authenticated can read mechanics"
  on public.system_users for select
  using (role = 'mechanic');

-- INSERT: apenas master ou admin podem cadastrar novos usuários (ex.: mecânicos)
drop policy if exists "Master or admin can insert system_users" on public.system_users;
create policy "Master or admin can insert system_users"
  on public.system_users for insert
  with check (public.is_system_master_or_admin());

-- UPDATE: apenas master ou admin podem editar usuários
drop policy if exists "Master or admin can update system_users" on public.system_users;
create policy "Master or admin can update system_users"
  on public.system_users for update
  using (public.is_system_master_or_admin());

-- DELETE: apenas master ou admin podem excluir usuários
drop policy if exists "Master or admin can delete system_users" on public.system_users;
create policy "Master or admin can delete system_users"
  on public.system_users for delete
  using (public.is_system_master_or_admin());
