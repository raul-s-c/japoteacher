alter table public.learning_reports
  add column if not exists experience_metrics jsonb not null default '{}'::jsonb;
