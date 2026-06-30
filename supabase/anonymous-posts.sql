-- Add anonymous-post display support without resetting existing data.
alter table public.kotozute
add column if not exists is_anonymous boolean not null default false;
