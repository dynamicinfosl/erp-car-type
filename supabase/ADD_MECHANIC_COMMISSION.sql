-- Adiciona campos de mecânico e comissionamento nas ordens de serviço
-- Execute no SQL Editor do Supabase

alter table public.service_orders
  add column if not exists mechanic_id uuid null,
  add column if not exists commission_percent numeric(5,2) not null default 0,
  add column if not exists commission_amount numeric(12,2) not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_orders_mechanic_id_fkey'
  ) then
    alter table public.service_orders
      add constraint service_orders_mechanic_id_fkey
      foreign key (mechanic_id)
      references public.system_users(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_service_orders_mechanic_id
  on public.service_orders(mechanic_id);

update public.service_orders
set
  commission_percent = coalesce(commission_percent, 0),
  commission_amount = coalesce(commission_amount, 0)
where
  commission_percent is null
  or commission_amount is null;
