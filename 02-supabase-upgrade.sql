-- SKYNETWORKS DATABASE UPGRADE (run once in Supabase SQL Editor)
-- Adds in-app notifications and server-side protection for public contact sharing.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  related_task_id uuid references public.tasks(id) on delete cascade,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Reject public messages/tasks/offers containing common contact-sharing patterns.
create or replace function public.skynetworks_reject_public_contacts()
returns trigger language plpgsql as $$
declare content text;
begin
  if tg_table_name = 'messages' and new.visibility <> 'public' then return new; end if;
  if tg_table_name = 'messages' then content := coalesce(new.body,'');
  elsif tg_table_name = 'tasks' then content := coalesce(new.title,'') || ' ' || coalesce(new.description,'') || ' ' || coalesce(new.location,'');
  else content := coalesce(new.message,''); end if;
  if content ~* '[A-Z0-9._%+-]+[[:space:]]*@[[:space:]]*[A-Z0-9.-]+[[:space:]]*\.[A-Z]{2,}'
     or content ~* '(https?://|www\.)[^[:space:]]+'
     or content ~* '(\+?[0-9][0-9 ()().-]{7,}[0-9])'
     or content ~* '(whatsapp|telegram|t\.me|instagram|facebook|tiktok|snapchat|call me|text me|dm me|contact me|reach me|my number)'
     or content ~* '[[:alnum:]-]+\.(com|net|org|co\.ke|io)(/[^[:space:]]*)?' then
    raise exception 'Contact details and personal links are not allowed in public marketplace content.' using errcode = '23514';
  end if;
  return new;
end; $$;

drop trigger if exists block_public_contacts_messages on public.messages;
create trigger block_public_contacts_messages before insert or update on public.messages for each row execute function public.skynetworks_reject_public_contacts();
drop trigger if exists block_public_contacts_tasks on public.tasks;
create trigger block_public_contacts_tasks before insert or update on public.tasks for each row execute function public.skynetworks_reject_public_contacts();
drop trigger if exists block_public_contacts_offers on public.offers;
create trigger block_public_contacts_offers before insert or update on public.offers for each row execute function public.skynetworks_reject_public_contacts();

-- Tighten message access: public discussion is for signed-in members; private messages
-- require an accepted offer between the task owner and the selected provider.
drop policy if exists "Participants can read messages" on public.messages;
drop policy if exists "Participants can send messages" on public.messages;
create policy "Read public task messages" on public.messages for select to authenticated
using (visibility = 'public');
create policy "Send public task messages" on public.messages for insert to authenticated
with check (sender_id = auth.uid() and visibility = 'public' and recipient_id is null and exists (
  select 1 from public.tasks t where t.id = task_id and t.status = 'open'
));
create policy "Read accepted private conversation" on public.messages for select to authenticated
using (visibility = 'private' and exists (
  select 1 from public.offers o join public.tasks t on t.id=o.task_id
  where o.task_id=messages.task_id and o.status='accepted'
    and ((t.owner_id=auth.uid() and o.provider_id=messages.recipient_id)
      or (t.owner_id=messages.recipient_id and o.provider_id=auth.uid()))
));
create policy "Send accepted private conversation" on public.messages for insert to authenticated
with check (sender_id=auth.uid() and visibility='private' and recipient_id is not null and exists (
  select 1 from public.offers o join public.tasks t on t.id=o.task_id
  where o.task_id=messages.task_id and o.status='accepted'
    and ((t.owner_id=auth.uid() and o.provider_id=messages.recipient_id)
      or (t.owner_id=messages.recipient_id and o.provider_id=auth.uid()))
));

-- Let only the task owner accept/reject provider offers.
drop policy if exists "Task owner can update offers" on public.offers;
create policy "Task owner can update offers" on public.offers for update to authenticated
using (exists (select 1 from public.tasks t where t.id=task_id and t.owner_id=auth.uid()))
with check (exists (select 1 from public.tasks t where t.id=task_id and t.owner_id=auth.uid()));

-- In-app notifications for new offers and messages.
create or replace function public.skynetworks_notify_offer()
returns trigger language plpgsql security definer set search_path=public as $$
declare task_owner uuid;
begin
  select owner_id into task_owner from public.tasks where id=new.task_id;
  if task_owner is not null and task_owner <> new.provider_id then
    insert into public.notifications(user_id,title,body,related_task_id)
    values(task_owner,'New provider offer','A provider has submitted an offer on your task.',new.task_id);
  end if;
  return new;
end; $$;
drop trigger if exists notify_new_offer on public.offers;
create trigger notify_new_offer after insert on public.offers for each row execute function public.skynetworks_notify_offer();

create or replace function public.skynetworks_notify_message()
returns trigger language plpgsql security definer set search_path=public as $$
declare task_owner uuid;
begin
  if new.visibility='private' then
    insert into public.notifications(user_id,title,body,related_task_id)
    values(new.recipient_id,'New private message','You have a new private task message.',new.task_id);
  else
    select owner_id into task_owner from public.tasks where id=new.task_id;
    if task_owner is not null and task_owner <> new.sender_id then
      insert into public.notifications(user_id,title,body,related_task_id)
      values(task_owner,'New public task message','Someone has commented on your task.',new.task_id);
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists notify_new_message on public.messages;
create trigger notify_new_message after insert on public.messages for each row execute function public.skynetworks_notify_message();

-- Note: email/SMS notifications need a trusted server-side email/SMS provider and
-- Supabase Edge Function or another backend. Never put provider secrets in browser code.
