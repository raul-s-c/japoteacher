-- Conserva cada generacion manual de un mismo periodo como una revision independiente.
alter table public.learning_reports
  add column if not exists revision integer not null default 1 check (revision >= 1);

alter table public.learning_reports
  drop constraint if exists learning_reports_user_period_unique;

alter table public.learning_reports
  add constraint learning_reports_user_period_revision_unique
  unique (user_id, report_type, period_start, period_end, revision);

create index if not exists learning_reports_user_period_revision_idx
  on public.learning_reports (user_id, period_end desc, revision desc);

grant delete on table public.learning_reports to authenticated;

drop policy if exists "users_delete_own_learning_reports" on public.learning_reports;
create policy "users_delete_own_learning_reports"
  on public.learning_reports for delete to authenticated
  using ((select auth.uid()) = user_id);
