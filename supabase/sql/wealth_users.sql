-- =============================================================================
-- Wealth Transfer — Users (username/password ในตาราง ไม่ใช้ Supabase Auth)
-- Run ใน Supabase SQL Editor ก่อน seed / ก่อน wealth_families.sql เวอร์ชันใหม่
-- Table prefix: wealth_
--
-- รหัสผ่านเก็บแบบ bcrypt (extensions.crypt) — ไม่เก็บ plain text
-- Login ผ่าน RPC: public.wealth_login(username, password)
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- 1) wealth_users
-- -----------------------------------------------------------------------------
create table if not exists public.wealth_users (
  id              uuid primary key default gen_random_uuid(),
  username        text not null,
  password_hash   text not null,
  display_name    text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint wealth_users_username_format
    check (username ~ '^[a-zA-Z0-9_]{3,32}$')
);

create unique index if not exists wealth_users_username_lower_uidx
  on public.wealth_users (lower(username));

comment on table public.wealth_users is
  'บัญชีเข้าใช้แอป — username/password (hash) ไม่พึ่ง auth.users';

comment on column public.wealth_users.password_hash is
  'bcrypt hash จาก extensions.crypt — ห้าม select ออกไปที่ client';

-- -----------------------------------------------------------------------------
-- 2) สิทธิ์: ห้ามอ่าน password_hash ผ่าน PostgREST
-- -----------------------------------------------------------------------------
alter table public.wealth_users enable row level security;

do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'wealth_users'
  loop
    execute format(
      'drop policy if exists %I on public.wealth_users',
      r.policyname
    );
  end loop;
end $$;

-- ไม่มี policy select สำหรับ anon/authenticated → อ่านตรงไม่ได้
-- (login ใช้ SECURITY DEFINER RPC เท่านั้น)

revoke all on table public.wealth_users from anon, authenticated;
-- ไม่ grant select/insert/update/delete ให้ anon

-- -----------------------------------------------------------------------------
-- 3) RPC: login — คืน user_id ถ้า username/password ถูก
-- -----------------------------------------------------------------------------
create or replace function public.wealth_login(
  p_username text,
  p_password text
)
returns table (
  user_id uuid,
  username text,
  display_name text,
  family_id text,
  family_name text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user public.wealth_users%rowtype;
begin
  if p_username is null or length(trim(p_username)) = 0
     or p_password is null or length(p_password) = 0 then
    return;
  end if;

  select *
  into v_user
  from public.wealth_users u
  where lower(u.username) = lower(trim(p_username))
    and u.is_active = true
  limit 1;

  if not found then
    return;
  end if;

  if v_user.password_hash is distinct from
       extensions.crypt(p_password, v_user.password_hash) then
    return;
  end if;

  return query
  select
    v_user.id,
    v_user.username,
    v_user.display_name,
    f.id,
    f.name
  from (select 1) _
  left join public.wealth_families f
    on f.owner_id = v_user.id
   and f.deleted_at is null;
end;
$$;

revoke all on function public.wealth_login(text, text) from public;
grant execute on function public.wealth_login(text, text) to anon, authenticated;

comment on function public.wealth_login(text, text) is
  'ตรวจ username/password จาก wealth_users — คืนแถวว่างถ้าไม่ผ่าน';

-- -----------------------------------------------------------------------------
-- 4) Helper: แอดมินตั้งรหัสผ่าน (รันใน SQL Editor เท่านั้น)
-- -----------------------------------------------------------------------------
create or replace function public.wealth_set_user_password(
  p_username text,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_password is null or length(p_password) < 4 then
    raise exception 'รหัสผ่านสั้นเกินไป';
  end if;

  update public.wealth_users
  set password_hash = extensions.crypt(p_password, extensions.gen_salt('bf')),
      updated_at = now()
  where lower(username) = lower(trim(p_username));

  if not found then
    raise exception 'ไม่พบ username: %', p_username;
  end if;
end;
$$;

revoke all on function public.wealth_set_user_password(text, text) from public;
-- ไม่ grant ให้ anon — ใช้ใน SQL Editor ด้วย role postgres เท่านั้น

-- -----------------------------------------------------------------------------
-- 5) ตัด FK owner_id → auth.users (จะผูก → wealth_users หลัง seed user)
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select
      c.conname,
      c.conrelid::regclass as tbl
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any (c.conkey)
    where c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
      and a.attname = 'owner_id'
      and c.conrelid::regclass::text like '%wealth_%'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;

  if to_regclass('public.wealth_profiles') is not null then
    for r in
      select c.conname
      from pg_constraint c
      where c.conrelid = 'public.wealth_profiles'::regclass
        and c.contype = 'f'
        and c.confrelid = 'auth.users'::regclass
    loop
      execute format(
        'alter table public.wealth_profiles drop constraint %I',
        r.conname
      );
    end loop;
  end if;
end $$;
