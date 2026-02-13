-- Adiciona um usuário na tabela system_users para permitir login
-- O usuário precisa existir no Supabase Auth (Authentication > Users)
-- Execute no SQL Editor do Supabase
-- NOTA: O password aqui é apenas referência na tabela; o login real usa o Auth. Defina um valor placeholder.

insert into public.system_users (email, name, role, permissions, active, password)
values (
  'abral@gmail.com',
  'Abral',
  'master',
  '["dashboard","service_orders","sales","pos","customers","products","services","mechanics","stock","financial","appointments","reports","settings"]'::jsonb,
  true,
  'cadastrado-via-sql'  -- placeholder; a autenticação usa o Supabase Auth
);
