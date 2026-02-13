-- Execute no SQL Editor do Supabase para investigar o 409 no PATCH service_orders
-- Isso lista triggers, constraints e políticas RLS que podem causar conflito

-- 1. Triggers na tabela service_orders
SELECT tgname AS trigger_name, tgtype, proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'public.service_orders'::regclass
  AND NOT tgisinternal;

-- 2. Constraints CHECK na tabela
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.service_orders'::regclass
  AND contype = 'c';

-- 3. Políticas RLS (UPDATE)
SELECT polname, polcmd, polroles::regrole[], pg_get_expr(polqual, polrelid) AS qual
FROM pg_policy
WHERE polrelid = 'public.service_orders'::regclass
  AND polcmd IN ('*', 'w');
