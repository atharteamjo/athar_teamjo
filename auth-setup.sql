-- Athar role-based authorization baseline for Supabase.
-- Run in Supabase SQL Editor AFTER creating the first admin Auth user.
-- Never expose SUPABASE_SERVICE_ROLE_KEY in browser code.

create table if not exists public.athar_private_settings (
  singleton boolean primary key default true check (singleton = true),
  super_admin_user_id uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);
alter table public.athar_private_settings enable row level security;
revoke all on public.athar_private_settings from anon, authenticated;

create table if not exists public.athar_audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (length(action) <= 100),
  target_user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.athar_audit_logs enable row level security;
revoke all on public.athar_audit_logs from anon, authenticated;

create or replace function public.athar_role()
returns text language sql stable security invoker
set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'member');
$$;

create or replace function public.is_athar_super_admin()
returns boolean language sql stable security definer
set search_path = '' as $$
  select exists (
    select 1 from public.athar_private_settings s
    where s.singleton = true
      and s.super_admin_user_id = auth.uid()
      and (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );
$$;

create or replace function public.is_athar_staff()
returns boolean language sql stable security definer
set search_path = '' as $$
  select public.is_athar_super_admin()
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'moderator';
$$;

revoke all on function public.athar_role() from public;
revoke all on function public.is_athar_super_admin() from public;
revoke all on function public.is_athar_staff() from public;
grant execute on function public.athar_role() to authenticated;
grant execute on function public.is_athar_super_admin() to authenticated;
grant execute on function public.is_athar_staff() to authenticated;

create policy "super admins read audit log" on public.athar_audit_logs
  for select to authenticated using (public.is_athar_super_admin());

-- Example policies for every private application table:
-- alter table public.some_table enable row level security;
-- create policy "staff read" on public.some_table for select to authenticated
--   using (public.is_athar_staff());
-- create policy "super admin writes" on public.some_table for all to authenticated
--   using (public.is_athar_super_admin()) with check (public.is_athar_super_admin());
-- Members should receive narrowly-scoped own-row policies, never broad table access.

-- BOOTSTRAP EXACTLY ONE SUPER ADMIN:
-- 1) Create the first Auth user in Supabase Dashboard.
-- 2) In a trusted server-side Admin API operation set app_metadata.role='super_admin'.
-- 3) Replace UUID below with that Auth user's UUID and run this INSERT once.
-- Do not let browser clients call this table or update role metadata.
-- insert into public.athar_private_settings(singleton, super_admin_user_id)
-- values (true, 'YOUR_AUTH_USER_UUID');
