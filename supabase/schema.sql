create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_state enable row level security;
create policy "users_read_own_state" on public.user_state for select to authenticated using ((select auth.uid()) = user_id);
create policy "users_insert_own_state" on public.user_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users_update_own_state" on public.user_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create index if not exists user_state_user_id_idx on public.user_state(user_id);
create or replace function public.set_user_state_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists user_state_updated_at on public.user_state;
create trigger user_state_updated_at before update on public.user_state for each row execute function public.set_user_state_updated_at();
