create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_state add column if not exists revision bigint not null default 0;
alter table public.user_state enable row level security;
grant select, insert, update, delete on table public.user_state to authenticated;
drop policy if exists "users_read_own_state" on public.user_state;
drop policy if exists "users_insert_own_state" on public.user_state;
drop policy if exists "users_update_own_state" on public.user_state;
create policy "users_read_own_state" on public.user_state for select to authenticated using ((select auth.uid()) = user_id);
create policy "users_insert_own_state" on public.user_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users_update_own_state" on public.user_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create index if not exists user_state_user_id_idx on public.user_state(user_id);
create or replace function public.set_user_state_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists user_state_updated_at on public.user_state;
create trigger user_state_updated_at before update on public.user_state for each row execute function public.set_user_state_updated_at();

create or replace function public.commit_user_state(p_expected_revision bigint, p_payload jsonb)
returns table(out_revision bigint, out_payload jsonb, committed boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_revision bigint;
  current_payload jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select revision, payload into current_revision, current_payload from public.user_state where user_id = (select auth.uid()) for update;
  if not found then
    insert into public.user_state(user_id,payload,revision) values ((select auth.uid()),p_payload,1);
    return query select 1::bigint,p_payload,true;
  end if;
  if current_revision <> p_expected_revision then return query select current_revision,current_payload,false; return; end if;
  update public.user_state set payload=p_payload,revision=current_revision+1 where user_id=(select auth.uid()) returning revision,payload into current_revision,current_payload;
  return query select current_revision,current_payload,true;
end;
$$;
revoke all on function public.commit_user_state(bigint,jsonb) from public;
grant execute on function public.commit_user_state(bigint,jsonb) to authenticated;
