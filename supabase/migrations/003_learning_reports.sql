create table if not exists public.learning_reports (
  report_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_type text not null check (report_type in ('weekly', 'monthly')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  direction_metrics jsonb not null default '{}'::jsonb,
  summary text,
  strengths jsonb not null default '[]'::jsonb,
  priority_structures jsonb not null default '[]'::jsonb,
  priority_vocabulary jsonb not null default '[]'::jsonb,
  action_plan jsonb not null default '[]'::jsonb,
  cumulative_progress jsonb not null default '{}'::jsonb,
  evidence_attempt_ids jsonb not null default '[]'::jsonb,
  previous_report_ids jsonb not null default '[]'::jsonb,
  error_message text,
  token_usage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  generated_at timestamptz,
  constraint learning_reports_period_valid check (period_end >= period_start),
  constraint learning_reports_user_period_unique unique (user_id, report_type, period_start, period_end)
);

alter table public.learning_reports enable row level security;
grant select on table public.learning_reports to authenticated;

create policy "users_read_own_learning_reports"
  on public.learning_reports for select to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists learning_reports_user_period_end_idx
  on public.learning_reports (user_id, period_end desc);

create or replace function public.set_learning_reports_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists learning_reports_updated_at on public.learning_reports;
create trigger learning_reports_updated_at
  before update on public.learning_reports
  for each row execute function public.set_learning_reports_updated_at();
