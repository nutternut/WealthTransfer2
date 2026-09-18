-- =============================================================================
-- Wealth Transfer — Families (1 user = 1 ครอบครัว)
-- ลำดับรัน:
--   1) supabase/sql/wealth_users.sql
--   2) ไฟล์นี้
--   3) supabase/sql/wealth_seed_user_01.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) wealth_families
-- -----------------------------------------------------------------------------
create table if not exists public.wealth_families (
  id            text primary key,
  name          text not null,
  owner_id      uuid not null
                  references public.wealth_users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,

  constraint wealth_families_name_not_blank
    check (length(trim(name)) > 0)
);

-- บังคับ: user คนหนึ่งมีครอบครัวได้แค่หนึ่ง
create unique index if not exists wealth_families_owner_id_uidx
  on public.wealth_families (owner_id)
  where deleted_at is null;

create index if not exists wealth_families_name_idx
  on public.wealth_families (name)
  where deleted_at is null;

comment on table public.wealth_families is
  'ครอบครัว — owner_id UNIQUE (active) = 1 user มีได้ 1 ครอบครัว';

comment on column public.wealth_families.owner_id is
  'เจ้าของบัญชี (wealth_users); ข้อมูล members/assets/plans ใช้ owner_id เดียวกัน';

-- ถ้าตารางเคยสร้างด้วย FK → auth.users ให้ตัดออก
-- (ผูก → wealth_users ทำใน seed หลังมี user แล้ว)
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any (c.conkey)
    where c.conrelid = 'public.wealth_families'::regclass
      and c.contype = 'f'
      and a.attname = 'owner_id'
      and c.confrelid = 'auth.users'::regclass
  loop
    execute format(
      'alter table public.wealth_families drop constraint %I',
      r.conname
    );
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 2) Helper: next family id (F1, F2, …) ทั้งตาราง — id เป็น PK กลาง
-- -----------------------------------------------------------------------------
create or replace function public.wealth_next_family_id(p_owner_id uuid default null)
returns text
language sql
stable
as $$
  select 'F' || coalesce(
    (
      select max(substring(id from 2)::int) + 1
      from public.wealth_families
      where id ~ '^F[0-9]+$'
    ),
    1
  );
$$;

grant execute on function public.wealth_next_family_id(uuid) to authenticated, anon;

-- -----------------------------------------------------------------------------
-- 3) RLS (prototype — เปิดกว้าง; จำกัดทีหลังได้)
-- -----------------------------------------------------------------------------
alter table public.wealth_families enable row level security;

do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'wealth_families'
  loop
    execute format(
      'drop policy if exists %I on public.wealth_families',
      r.policyname
    );
  end loop;
end $$;

create policy wealth_families_select_anon
  on public.wealth_families for select
  to anon, authenticated
  using (true);

create policy wealth_families_insert_anon
  on public.wealth_families for insert
  to anon, authenticated
  with check (true);

create policy wealth_families_update_anon
  on public.wealth_families for update
  to anon, authenticated
  using (true)
  with check (true);

create policy wealth_families_delete_anon
  on public.wealth_families for delete
  to anon, authenticated
  using (true);

grant select, insert, update, delete on public.wealth_families to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4) View
-- -----------------------------------------------------------------------------
create or replace view public.wealth_families_active as
select
  id,
  name,
  owner_id,
  created_at,
  updated_at
from public.wealth_families
where deleted_at is null;

grant select on public.wealth_families_active to anon, authenticated;

-- อัปเดต wealth_login ให้ join families ได้หลังมีตาราง
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
