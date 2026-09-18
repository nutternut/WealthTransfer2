-- =============================================================================
-- Wealth Transfer — Members (หน้าสมาชิกครอบครัว)
-- Run ใน Supabase SQL Editor (หรือ psql)
-- Table prefix: wealth_
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Table: wealth_members
-- ตรงกับ type Member ใน src/data/wealth-transfer.ts
-- -----------------------------------------------------------------------------
create table if not exists public.wealth_members (
  id            text primary key,
  -- เจ้าของข้อมูล (ผูกกับ auth.users หลัง signup/login ผ่าน RPC)
  owner_id      uuid references auth.users (id) on delete cascade,

  name          text not null,
  gen           text not null
                  check (gen in ('รุ่นที่ 1', 'รุ่นที่ 2', 'รุ่นที่ 3', 'รุ่นที่ 4')),
  age           integer not null
                  check (age >= 0 and age <= 120),
  relation      text not null
                  check (relation in (
                    'เจ้าของหลัก',
                    'คู่สมรส',
                    'บุตร',
                    'หลาน',
                    'พี่น้อง',
                    'อื่น ๆ'
                  )),
  status        text not null
                  check (status in ('มีชีวิต', 'ถึงแก่กรรม')),

  -- คู่สมรส (รุ่นเดียวกัน) — self FK
  partner_id    text references public.wealth_members (id) on delete set null,

  -- พ่อ/แม่ (รุ่นก่อนหน้า) สูงสุด 2 คน
  parent_ids    text[] not null default '{}'::text[],

  -- ลำดับแสดงผล (drag / custom order ใน UI)
  sort_order    integer not null default 0,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,

  constraint wealth_members_partner_not_self
    check (partner_id is null or partner_id <> id),

  constraint wealth_members_parent_ids_max_2
    check (
      parent_ids is null
      or cardinality(parent_ids) <= 2
    ),

  constraint wealth_members_id_not_in_parents
    check (not (id = any (parent_ids)))
);

comment on table public.wealth_members is
  'สมาชิกครอบครัวและความสัมพันธ์ — ใช้ในหน้า /members';

comment on column public.wealth_members.parent_ids is
  'รหัสพ่อ/แม่ (รุ่นก่อนหน้า) สูงสุด 2 คน';

comment on column public.wealth_members.partner_id is
  'รหัสคู่สมรส (รุ่นเดียวกัน)';

-- -----------------------------------------------------------------------------
-- 2) Indexes
-- -----------------------------------------------------------------------------
create index if not exists wealth_members_owner_id_idx
  on public.wealth_members (owner_id)
  where deleted_at is null;

create index if not exists wealth_members_owner_sort_idx
  on public.wealth_members (owner_id, sort_order)
  where deleted_at is null;

create index if not exists wealth_members_gen_idx
  on public.wealth_members (gen)
  where deleted_at is null;

create index if not exists wealth_members_partner_id_idx
  on public.wealth_members (partner_id)
  where partner_id is not null;

create index if not exists wealth_members_parent_ids_gin
  on public.wealth_members using gin (parent_ids);

-- -----------------------------------------------------------------------------
-- 3) updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function public.wealth_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists wealth_members_set_updated_at on public.wealth_members;
create trigger wealth_members_set_updated_at
  before update on public.wealth_members
  for each row
  execute function public.wealth_set_updated_at();

-- -----------------------------------------------------------------------------
-- 4) Helper: สร้าง id รูปแบบ M1, M2, ...
-- -----------------------------------------------------------------------------
-- p_owner_id เก็บไว้เพื่อ backward-compat กับ RPC เดิม — ไม่ใช้กรอง
-- เพราะ id เป็น PK ทั้งตาราง (ห้ามซ้ำข้าม user / soft-deleted)
create or replace function public.wealth_next_member_id(p_owner_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  max_n integer;
begin
  select coalesce(max((regexp_match(id, '^M(\d+)$'))[1]::integer), 0)
    into max_n
  from public.wealth_members
  where id ~ '^M[0-9]+$';

  return 'M' || (max_n + 1)::text;
end;
$$;

grant execute on function public.wealth_next_member_id(uuid) to authenticated, anon;

-- -----------------------------------------------------------------------------
-- 5) RLS
--    ตอนนี้แอปใช้ anon key (ยังไม่มี Supabase Auth session)
--    → เปิดสิทธิ์ anon สำหรับ prototype
--    เมื่อมี auth จริง ค่อยจำกัดด้วย owner_id = auth.uid()
--
--    สำคัญ: UPDATE ต้อง with check (true) ไม่ใช่ deleted_at is null
--    ไม่งั้น soft-delete (ตั้ง deleted_at) จะโดน
--    "new row violates row-level security policy"
-- -----------------------------------------------------------------------------
alter table public.wealth_members enable row level security;

-- ลบ policy เก่าทั้งหมดบนตารางนี้
do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'wealth_members'
  loop
    execute format(
      'drop policy if exists %I on public.wealth_members',
      r.policyname
    );
  end loop;
end $$;

create policy wealth_members_select_anon
  on public.wealth_members
  for select
  to anon, authenticated
  using (true);

create policy wealth_members_insert_anon
  on public.wealth_members
  for insert
  to anon, authenticated
  with check (true);

-- soft-delete ต้องผ่าน with check แม้ deleted_at จะไม่เป็น null
create policy wealth_members_update_anon
  on public.wealth_members
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy wealth_members_delete_anon
  on public.wealth_members
  for delete
  to anon, authenticated
  using (true);

grant select, insert, update, delete on public.wealth_members to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6) ไม่มี seed — ใช้ข้อมูลจริงจากแอป
--    ล้างข้อมูลเก่า: supabase/sql/wealth_clear_demo_data.sql
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 7) View อ่านง่ายสำหรับ UI (ไม่รวม soft-deleted)
-- -----------------------------------------------------------------------------
create or replace view public.wealth_members_active as
select
  id,
  owner_id,
  name,
  gen,
  age,
  relation,
  status,
  partner_id,
  parent_ids,
  sort_order,
  created_at,
  updated_at
from public.wealth_members
where deleted_at is null;

grant select on public.wealth_members_active to anon, authenticated;
