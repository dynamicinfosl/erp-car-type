-- Atualiza service_orders com privilégios elevados (contorna RLS que pode causar 409).
-- Execute no SQL Editor do Supabase.

create or replace function public.update_service_order_payment(p_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.service_orders
  set
    status = coalesce((p_payload->>'status')::text, status),
    payment_status = coalesce((p_payload->>'payment_status')::text, payment_status),
    total_amount = coalesce((p_payload->>'total_amount')::numeric, total_amount),
    advance_payment = coalesce((p_payload->>'advance_payment')::numeric, advance_payment),
    discount = coalesce((p_payload->>'discount')::numeric, discount),
    final_amount = coalesce((p_payload->>'final_amount')::numeric, final_amount),
    payment_method = coalesce((p_payload->>'payment_method')::text, payment_method),
    mechanic_id = case when p_payload ? 'mechanic_id' and (p_payload->>'mechanic_id') is not null and (p_payload->>'mechanic_id') <> '' then (p_payload->>'mechanic_id')::uuid else mechanic_id end,
    commission_percent = coalesce((p_payload->>'commission_percent')::numeric, commission_percent),
    commission_amount = coalesce((p_payload->>'commission_amount')::numeric, commission_amount)
  where id = p_id;
end;
$$;

grant execute on function public.update_service_order_payment(uuid, jsonb) to authenticated;
grant execute on function public.update_service_order_payment(uuid, jsonb) to anon;
