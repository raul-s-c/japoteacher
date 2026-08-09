-- El Worker escribe informes con la service-role key; RLS continúa protegiendo
-- las lecturas directas de los usuarios autenticados.
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.learning_reports to service_role;
grant select on table public.user_state to service_role;
