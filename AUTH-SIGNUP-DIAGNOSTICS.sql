-- SKYNETWORKS AUTH SIGNUP DIAGNOSTICS
-- Run in Supabase Dashboard -> SQL Editor.
-- Read-only: this script does not change or delete anything.

-- 1) List triggers attached to Supabase Auth users.
select
  t.trigger_name,
  t.event_manipulation,
  t.action_timing,
  t.action_statement
from information_schema.triggers t
where t.event_object_schema = 'auth'
  and t.event_object_table = 'users'
order by t.trigger_name;

-- 2) Show public profile table columns, if present.
select
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in ('profiles', 'users')
order by c.table_name, c.ordinal_position;

-- 3) Show trigger function definitions for public/auth triggers.
-- Review functions called by triggers listed in query 1.
select
  n.nspname as function_schema,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'auth')
  and (p.proname ilike '%user%' or p.proname ilike '%profile%')
order by n.nspname, p.proname;

-- Also check Supabase Dashboard -> Logs -> Postgres Logs around the failed
-- signup timestamp. The exact database error is recorded there.
