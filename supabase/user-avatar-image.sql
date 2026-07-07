-- Add uploaded profile icon support without resetting existing data.

alter table public.users
  add column if not exists avatar_image_url text;
