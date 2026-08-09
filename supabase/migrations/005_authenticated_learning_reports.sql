-- Permite al usuario autenticado conservar solo sus propios informes manuales.
grant insert, update on table public.learning_reports to authenticated;

drop policy if exists "users_insert_own_learning_reports" on public.learning_reports;
create policy "users_insert_own_learning_reports"
  on public.learning_reports for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "users_update_own_learning_reports" on public.learning_reports;
create policy "users_update_own_learning_reports"
  on public.learning_reports for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
