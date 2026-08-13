-- The editorial inbox reads issue metadata server-side only. It never grants access to anon.
grant select on table public.user_issue_reports to service_role;
