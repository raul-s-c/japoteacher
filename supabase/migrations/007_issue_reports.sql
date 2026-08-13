-- Private support inbox. Image objects live in the private issue-reports bucket.
create table if not exists public.user_issue_reports (
  report_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  comment text not null check (char_length(comment) between 1 and 2000),
  page text not null default 'hoy' check (char_length(page) <= 40),
  app_version text,
  attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 5),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_issue_reports_user_created_idx on public.user_issue_reports (user_id, created_at desc);
alter table public.user_issue_reports enable row level security;
grant select, insert, update, delete on public.user_issue_reports to authenticated;
drop policy if exists "users_manage_own_issue_reports" on public.user_issue_reports;
create policy "users_manage_own_issue_reports" on public.user_issue_reports for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('issue-reports', 'issue-reports', false, 3145728, array['image/jpeg', 'image/png', 'image/webp']) on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "users_manage_own_issue_report_files" on storage.objects;
create policy "users_manage_own_issue_report_files" on storage.objects for all to authenticated using (bucket_id = 'issue-reports' and (storage.foldername(name))[1] = (select auth.uid()::text)) with check (bucket_id = 'issue-reports' and (storage.foldername(name))[1] = (select auth.uid()::text));
