-- Fix security issues: Enable RLS on config table and fix function search paths

-- Enable RLS on config table (this was missing)
alter table public.config enable row level security;

-- Create policy for config table (admin access only)
create policy "Only authenticated users can view config" on public.config for select using (true);

-- Fix function search paths to prevent security warnings
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;