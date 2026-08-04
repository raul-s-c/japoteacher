alter table public.user_state add column if not exists revision bigint not null default 0;
alter table public.user_state add column if not exists active_device_id text;
alter table public.user_state add column if not exists active_device_name text;
alter table public.user_state add column if not exists active_at timestamptz;

drop function if exists public.commit_user_state(bigint,jsonb);

create or replace function public.claim_user_session(p_device_id text,p_device_name text,p_force boolean default false)
returns table(claimed boolean,owner_name text,out_revision bigint)
language plpgsql security invoker set search_path='' as $$
declare row_state public.user_state%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  insert into public.user_state(user_id,payload,revision) values((select auth.uid()),'{}'::jsonb,0) on conflict(user_id) do nothing;
  select * into row_state from public.user_state where user_id=(select auth.uid()) for update;
  if p_force or row_state.active_device_id is null or row_state.active_device_id=p_device_id or row_state.active_at < now()-interval '2 minutes' then
    update public.user_state set active_device_id=p_device_id,active_device_name=left(p_device_name,100),active_at=now() where user_id=(select auth.uid()) returning * into row_state;
    return query select true,row_state.active_device_name,row_state.revision;
  else return query select false,row_state.active_device_name,row_state.revision;
  end if;
end; $$;

create or replace function public.heartbeat_user_session(p_device_id text)
returns boolean language sql security invoker set search_path='' as $$
  update public.user_state set active_at=now() where user_id=(select auth.uid()) and active_device_id=p_device_id returning true;
$$;

create or replace function public.release_user_session(p_device_id text)
returns boolean language sql security invoker set search_path='' as $$
  update public.user_state set active_device_id=null,active_device_name=null,active_at=null where user_id=(select auth.uid()) and active_device_id=p_device_id returning true;
$$;

create or replace function public.commit_user_state(p_expected_revision bigint,p_payload jsonb,p_device_id text)
returns table(out_revision bigint,out_payload jsonb,committed boolean,lease_granted boolean,owner_name text)
language plpgsql security invoker set search_path='' as $$
declare row_state public.user_state%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into row_state from public.user_state where user_id=(select auth.uid()) for update;
  if not found or row_state.active_device_id is distinct from p_device_id then
    return query select coalesce(row_state.revision,0),coalesce(row_state.payload,'{}'::jsonb),false,false,row_state.active_device_name; return;
  end if;
  if row_state.revision <> p_expected_revision then return query select row_state.revision,row_state.payload,false,true,row_state.active_device_name; return; end if;
  update public.user_state set payload=p_payload,revision=row_state.revision+1,active_at=now() where user_id=(select auth.uid()) returning * into row_state;
  return query select row_state.revision,row_state.payload,true,true,row_state.active_device_name;
end; $$;

revoke all on function public.claim_user_session(text,text,boolean) from public;
revoke all on function public.heartbeat_user_session(text) from public;
revoke all on function public.release_user_session(text) from public;
revoke all on function public.commit_user_state(bigint,jsonb,text) from public;
grant execute on function public.claim_user_session(text,text,boolean) to authenticated;
grant execute on function public.heartbeat_user_session(text) to authenticated;
grant execute on function public.release_user_session(text) to authenticated;
grant execute on function public.commit_user_state(bigint,jsonb,text) to authenticated;
