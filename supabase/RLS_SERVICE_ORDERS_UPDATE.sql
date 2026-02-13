-- Se o PATCH em service_orders retorna 409, pode ser RLS bloqueando o UPDATE.
-- Este script permite que usuários autenticados atualizem ordens de serviço.
-- Execute no SQL Editor do Supabase.

-- Ativar RLS (se ainda não estiver)
alter table public.service_orders enable row level security;

-- Permitir SELECT para autenticados (listar e abrir OS)
drop policy if exists "Authenticated can read service_orders" on public.service_orders;
create policy "Authenticated can read service_orders"
  on public.service_orders for select
  to authenticated
  using (true);

-- Permitir UPDATE para autenticados (editar e confirmar pagamento)
drop policy if exists "Authenticated can update service_orders" on public.service_orders;
create policy "Authenticated can update service_orders"
  on public.service_orders for update
  to authenticated
  using (true)
  with check (true);

-- Permitir INSERT para autenticados (criar OS)
drop policy if exists "Authenticated can insert service_orders" on public.service_orders;
create policy "Authenticated can insert service_orders"
  on public.service_orders for insert
  to authenticated
  with check (true);

-- Permitir DELETE para autenticados (excluir OS)
drop policy if exists "Authenticated can delete service_orders" on public.service_orders;
create policy "Authenticated can delete service_orders"
  on public.service_orders for delete
  to authenticated
  using (true);
