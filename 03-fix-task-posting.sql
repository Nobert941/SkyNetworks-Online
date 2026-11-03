-- SKYNETWORKS FIX + UPGRADE (run once in Supabase Dashboard -> SQL Editor)
-- Safe to run more than once.

-- 1) FIX: 'record "new" has no field "visibility"' when posting a task.
-- The shared contact-filter trigger read new.visibility even for tasks/offers.
-- This version reads fields through JSON, so it works for every table.
create or replace function public.skynetworks_reject_public_contacts()
returns trigger language plpgsql as $$
declare
  j jsonb := to_jsonb(new);
  content text;
begin
  if tg_table_name = 'messages' then
    if coalesce(j->>'visibility','public') <> 'public' then
      return new;
    end if;
    content := coalesce(j->>'body','');
  elsif tg_table_name = 'tasks' then
    content := coalesce(j->>'title','') || ' ' || coalesce(j->>'description','') || ' ' || coalesce(j->>'location','');
  else
    content := coalesce(j->>'message','');
  end if;

  if content ~* '[A-Z0-9._%+-]+[[:space:]]*@[[:space:]]*[A-Z0-9.-]+[[:space:]]*\.[A-Z]{2,}'
     or content ~* '(https?://|www\.)[^[:space:]]+'
     or content ~* '(\+?[0-9][0-9 ()().-]{7,}[0-9])'
     or content ~* '(whatsapp|telegram|t\.me|instagram|facebook|tiktok|snapchat|call me|text me|dm me|contact me|reach me|my number)'
     or content ~* '[[:alnum:]-]+\.(com|net|org|co\.ke|io)(/[^[:space:]]*)?' then
    raise exception 'Contact details and personal links are not allowed in public marketplace content.' using errcode = '23514';
  end if;
  return new;
end; $$;

-- 2) NEW task fields used by the Airtasker-style cards and filters.
alter table public.tasks add column if not exists latitude  double precision;
alter table public.tasks add column if not exists longitude double precision;
alter table public.tasks add column if not exists is_remote boolean not null default false;
alter table public.tasks add column if not exists due_date date;
alter table public.tasks add column if not exists time_of_day text not null default 'Anytime';

create index if not exists tasks_status_created_idx on public.tasks(status, created_at desc);

-- 3) Make sure the website can refresh its schema cache.
notify pgrst, 'reload schema';
