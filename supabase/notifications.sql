-- Notifications table for the notification feature.
-- This is additive: it does not drop or rewrite existing kotozute data.

create table if not exists public.notifications (
  id text primary key,
  recipient_id text not null references public.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null check (type in ('near', 'unlockable', 'system', 'received')),
  related_id uuid references public.kotozute(id) on delete set null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select" on public.notifications;
drop policy if exists "notifications_insert" on public.notifications;
drop policy if exists "notifications_update" on public.notifications;
drop policy if exists "notifications_delete" on public.notifications;
create policy "notifications_select" on public.notifications for select using (true);
create policy "notifications_insert" on public.notifications for insert with check (true);
create policy "notifications_update" on public.notifications for update using (true) with check (true);
create policy "notifications_delete" on public.notifications for delete using (true);
