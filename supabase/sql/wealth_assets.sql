-- =============================================================================
-- Wealth Transfer — Assets (บันทึกทรัพย์สินตอนเพิ่ม)
-- Run ใน Supabase SQL Editor (หรือ psql)
-- Table prefix: wealth_
--
-- Dependencies: รัน wealth_members.sql ก่อน (FK → wealth_members)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) updated_at trigger helper (idempotent — ใช้ร่วมกับ members)
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

-- =============================================================================
-- 1) wealth_entities — นิติบุคคล (ผู้ถือกรรมสิทธิ์แบบนิติบุคคล)
-- =============================================================================
create table if not exists public.wealth_entities (
  id            text primary key,
  owner_id      uuid references auth.users (id) on delete cascade,

  name          text not null,
  -- ยืดหยุ่น: บริษัทจำกัด / บมจ. / ห้างหุ้นส่วน ฯลฯ
  kind          text not null default 'บริษัทจำกัด',

  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

comment on table public.wealth_entities is
  'นิติบุคคล — ใช้เป็นผู้ถือกรรมสิทธิ์ทรัพย์สิน';

create index if not exists wealth_entities_owner_id_idx
  on public.wealth_entities (owner_id)
  where deleted_at is null;

create index if not exists wealth_entities_owner_sort_idx
  on public.wealth_entities (owner_id, sort_order)
  where deleted_at is null;

drop trigger if exists wealth_entities_set_updated_at on public.wealth_entities;
create trigger wealth_entities_set_updated_at
  before update on public.wealth_entities
  for each row
  execute function public.wealth_set_updated_at();

-- p_owner_id เก็บไว้เพื่อ backward-compat กับ RPC เดิม — ไม่ใช้กรอง
-- เพราะ id เป็น PK ทั้งตาราง (ห้ามซ้ำข้าม user / soft-deleted)
create or replace function public.wealth_next_entity_id(p_owner_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  max_n integer;
begin
  select coalesce(max((regexp_match(id, '^E(\d+)$'))[1]::integer), 0)
    into max_n
  from public.wealth_entities
  where id ~ '^E[0-9]+$';

  return 'E' || (max_n + 1)::text;
end;
$$;

grant execute on function public.wealth_next_entity_id(uuid) to authenticated, anon;

-- =============================================================================
-- 2) wealth_assets — ทรัพย์สินหลัก
-- =============================================================================
create table if not exists public.wealth_assets (
  id            text primary key,
  owner_id      uuid references auth.users (id) on delete cascade,

  name          text not null,

  -- ประเภทหลัก / ย่อย (ตรง taxonomy ในแอป)
  category      text not null
                  check (category in (
                    'อสังหาริมทรัพย์',
                    'หุ้นส่วนบริษัท',
                    'ทรัพย์สินทางการเงิน',
                    'ทรัพย์สินอื่น'
                  )),
  subtype       text,
  detail        text,

  role          text,
  method        text,

  -- ปี พ.ศ. (nullable)
  acquired_year integer
                  check (acquired_year is null or (acquired_year >= 2400 and acquired_year <= 2800)),
  transfer_year integer
                  check (transfer_year is null or (transfer_year >= 2400 and transfer_year <= 2800)),

  -- มูลค่า + หน่วย (แยกคอลัมน์) — หน่วยหลักเป็นบาท, จำนวนว่างได้
  value_amount    numeric(18, 4),
  value_unit      text not null default 'บาท',
  assessed_amount numeric(18, 4),
  assessed_unit   text not null default 'บาท',
  cost_amount     numeric(18, 4),
  cost_unit       text not null default 'บาท',

  -- เนื้อที่อสังหา (แยกคอลัมน์)
  area_rai    numeric(12, 4),
  area_ngan   numeric(12, 4),
  area_sq_wa  numeric(12, 4),

  -- ฟิลด์ยืดหยุ่นเฉพาะประเภท / อนาคต
  -- ตัวอย่าง:
  --   อสังหา: { "assessed_per_sq_wa": 0.35, "note": "..." }
  --   หุ้น:   { "registered_capital": 10, "par_value": 100, "book_value": 150 }
  attrs       jsonb not null default '{}'::jsonb,

  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  constraint wealth_assets_value_nonneg
    check (value_amount is null or value_amount >= 0),
  constraint wealth_assets_assessed_nonneg
    check (assessed_amount is null or assessed_amount >= 0),
  constraint wealth_assets_cost_nonneg
    check (cost_amount is null or cost_amount >= 0),
  constraint wealth_assets_area_nonneg
    check (
      (area_rai is null or area_rai >= 0)
      and (area_ngan is null or area_ngan >= 0)
      and (area_sq_wa is null or area_sq_wa >= 0)
    )
);

comment on table public.wealth_assets is
  'ทรัพย์สิน — บันทึกตอนเพิ่ม (หน้า /assets)';

comment on column public.wealth_assets.attrs is
  'JSONB ฟิลด์เฉพาะประเภท / ขยายได้โดยไม่ต้อง migrate';

comment on column public.wealth_assets.value_amount is
  'มูลค่าตลาด (บาท) — คู่กับ value_unit, ว่างได้';

comment on column public.wealth_assets.assessed_amount is
  'ราคาประเมิน (บาท) — ว่างได้';

comment on column public.wealth_assets.cost_amount is
  'ต้นทุน (บาท) — ว่างได้';

comment on column public.wealth_assets.area_rai is
  'เนื้อที่ (ไร่) — อสังหาริมทรัพย์';

create index if not exists wealth_assets_owner_id_idx
  on public.wealth_assets (owner_id)
  where deleted_at is null;

create index if not exists wealth_assets_owner_sort_idx
  on public.wealth_assets (owner_id, sort_order)
  where deleted_at is null;

create index if not exists wealth_assets_category_idx
  on public.wealth_assets (category)
  where deleted_at is null;

create index if not exists wealth_assets_attrs_gin
  on public.wealth_assets using gin (attrs);

drop trigger if exists wealth_assets_set_updated_at on public.wealth_assets;
create trigger wealth_assets_set_updated_at
  before update on public.wealth_assets
  for each row
  execute function public.wealth_set_updated_at();

-- p_owner_id เก็บไว้เพื่อ backward-compat กับ RPC เดิม — ไม่ใช้กรอง
-- เพราะ id เป็น PK ทั้งตาราง (ห้ามซ้ำข้าม user / soft-deleted)
create or replace function public.wealth_next_asset_id(p_owner_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  max_n integer;
begin
  select coalesce(max((regexp_match(id, '^A(\d+)$'))[1]::integer), 0)
    into max_n
  from public.wealth_assets
  where id ~ '^A[0-9]+$';

  return 'A' || (max_n + 1)::text;
end;
$$;

grant execute on function public.wealth_next_asset_id(uuid) to authenticated, anon;

-- =============================================================================
-- 3) wealth_asset_owners — ผู้ถือกรรมสิทธิ์ (หลายคน / คนนอก / นิติบุคคล)
-- =============================================================================
create table if not exists public.wealth_asset_owners (
  id            text primary key,
  owner_id      uuid references auth.users (id) on delete cascade,

  asset_id      text not null
                  references public.wealth_assets (id) on delete cascade,

  holder_kind   text not null
                  check (holder_kind in ('บุคคลธรรมดา', 'คนนอก', 'นิติบุคคล')),

  -- บุคคล → wealth_members / นิติบุคคล → wealth_entities / คนนอก → external_name
  member_id     text references public.wealth_members (id) on delete cascade,
  entity_id     text references public.wealth_entities (id) on delete restrict,
  external_name text,

  share_pct     numeric(7, 4) not null default 100
                  check (share_pct > 0 and share_pct <= 100),

  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,

  constraint wealth_asset_owners_holder_person
    check (
      holder_kind <> 'บุคคลธรรมดา'
      or (
        member_id is not null
        and entity_id is null
        and external_name is null
      )
    ),

  constraint wealth_asset_owners_holder_entity
    check (
      holder_kind <> 'นิติบุคคล'
      or (
        entity_id is not null
        and member_id is null
        and external_name is null
      )
    ),

  constraint wealth_asset_owners_holder_external
    check (
      holder_kind <> 'คนนอก'
      or (
        external_name is not null
        and length(trim(external_name)) > 0
        and member_id is null
        and entity_id is null
      )
    )
);

comment on table public.wealth_asset_owners is
  'ผู้ถือกรรมสิทธิ์ของทรัพย์สิน — รองรับหลายคน คนนอก และนิติบุคคล';

comment on column public.wealth_asset_owners.external_name is
  'ชื่อผู้ถือประเภทคนนอก (พิมพ์เอง) — ใช้เมื่อ holder_kind = คนนอก';

comment on column public.wealth_asset_owners.share_pct is
  'สัดส่วนถือครอง (%) — ไม่บังคับรวม = 100 ใน DB (ตรวจที่ UI ได้)';

create index if not exists wealth_asset_owners_owner_id_idx
  on public.wealth_asset_owners (owner_id)
  where deleted_at is null;

create index if not exists wealth_asset_owners_asset_id_idx
  on public.wealth_asset_owners (asset_id)
  where deleted_at is null;

create index if not exists wealth_asset_owners_member_id_idx
  on public.wealth_asset_owners (member_id)
  where member_id is not null and deleted_at is null;

create index if not exists wealth_asset_owners_entity_id_idx
  on public.wealth_asset_owners (entity_id)
  where entity_id is not null and deleted_at is null;

-- คน/นิติบุคคลเดิมไม่ซ้ำใน asset เดียวกัน (เฉพาะแถวที่ยังไม่ soft-delete)
create unique index if not exists wealth_asset_owners_asset_member_uq
  on public.wealth_asset_owners (asset_id, member_id)
  where member_id is not null and deleted_at is null;

create unique index if not exists wealth_asset_owners_asset_entity_uq
  on public.wealth_asset_owners (asset_id, entity_id)
  where entity_id is not null and deleted_at is null;

create unique index if not exists wealth_asset_owners_asset_external_uq
  on public.wealth_asset_owners (asset_id, lower(trim(external_name)))
  where external_name is not null and deleted_at is null;

drop trigger if exists wealth_asset_owners_set_updated_at on public.wealth_asset_owners;
create trigger wealth_asset_owners_set_updated_at
  before update on public.wealth_asset_owners
  for each row
  execute function public.wealth_set_updated_at();

-- p_owner_id เก็บไว้เพื่อ backward-compat กับ RPC เดิม — ไม่ใช้กรอง
-- เพราะ id เป็น PK ทั้งตาราง (ห้ามซ้ำข้าม user / soft-deleted)
create or replace function public.wealth_next_asset_owner_id(p_owner_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  max_n integer;
begin
  select coalesce(max((regexp_match(id, '^AO(\d+)$'))[1]::integer), 0)
    into max_n
  from public.wealth_asset_owners
  where id ~ '^AO[0-9]+$';

  return 'AO' || (max_n + 1)::text;
end;
$$;

grant execute on function public.wealth_next_asset_owner_id(uuid) to authenticated, anon;

-- =============================================================================
-- 4) RLS (prototype: anon + soft-delete ผ่าน with check true)
-- =============================================================================

-- ---- entities ----
alter table public.wealth_entities enable row level security;

drop policy if exists wealth_entities_select_anon on public.wealth_entities;
drop policy if exists wealth_entities_insert_anon on public.wealth_entities;
drop policy if exists wealth_entities_update_anon on public.wealth_entities;
drop policy if exists wealth_entities_delete_anon on public.wealth_entities;

create policy wealth_entities_select_anon
  on public.wealth_entities
  for select
  to anon, authenticated
  using (deleted_at is null);

create policy wealth_entities_insert_anon
  on public.wealth_entities
  for insert
  to anon, authenticated
  with check (true);

create policy wealth_entities_update_anon
  on public.wealth_entities
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy wealth_entities_delete_anon
  on public.wealth_entities
  for delete
  to anon, authenticated
  using (true);

grant select, insert, update, delete on public.wealth_entities to anon, authenticated;

-- ---- assets ----
alter table public.wealth_assets enable row level security;

drop policy if exists wealth_assets_select_anon on public.wealth_assets;
drop policy if exists wealth_assets_insert_anon on public.wealth_assets;
drop policy if exists wealth_assets_update_anon on public.wealth_assets;
drop policy if exists wealth_assets_delete_anon on public.wealth_assets;

create policy wealth_assets_select_anon
  on public.wealth_assets
  for select
  to anon, authenticated
  using (deleted_at is null);

create policy wealth_assets_insert_anon
  on public.wealth_assets
  for insert
  to anon, authenticated
  with check (true);

create policy wealth_assets_update_anon
  on public.wealth_assets
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy wealth_assets_delete_anon
  on public.wealth_assets
  for delete
  to anon, authenticated
  using (true);

grant select, insert, update, delete on public.wealth_assets to anon, authenticated;

-- ---- asset owners ----
alter table public.wealth_asset_owners enable row level security;

drop policy if exists wealth_asset_owners_select_anon on public.wealth_asset_owners;
drop policy if exists wealth_asset_owners_insert_anon on public.wealth_asset_owners;
drop policy if exists wealth_asset_owners_update_anon on public.wealth_asset_owners;
drop policy if exists wealth_asset_owners_delete_anon on public.wealth_asset_owners;

create policy wealth_asset_owners_select_anon
  on public.wealth_asset_owners
  for select
  to anon, authenticated
  using (deleted_at is null);

create policy wealth_asset_owners_insert_anon
  on public.wealth_asset_owners
  for insert
  to anon, authenticated
  with check (true);

create policy wealth_asset_owners_update_anon
  on public.wealth_asset_owners
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy wealth_asset_owners_delete_anon
  on public.wealth_asset_owners
  for delete
  to anon, authenticated
  using (true);

grant select, insert, update, delete on public.wealth_asset_owners to anon, authenticated;

-- =============================================================================
-- 5) Views (ไม่รวม soft-deleted)
-- =============================================================================
create or replace view public.wealth_entities_active as
select
  id,
  owner_id,
  name,
  kind,
  sort_order,
  created_at,
  updated_at
from public.wealth_entities
where deleted_at is null;

grant select on public.wealth_entities_active to anon, authenticated;

create or replace view public.wealth_assets_active as
select
  id,
  owner_id,
  name,
  category,
  subtype,
  detail,
  role,
  method,
  acquired_year,
  transfer_year,
  value_amount,
  value_unit,
  assessed_amount,
  assessed_unit,
  cost_amount,
  cost_unit,
  area_rai,
  area_ngan,
  area_sq_wa,
  attrs,
  sort_order,
  created_at,
  updated_at
from public.wealth_assets
where deleted_at is null;

grant select on public.wealth_assets_active to anon, authenticated;

create or replace view public.wealth_asset_owners_active as
select
  id,
  owner_id,
  asset_id,
  holder_kind,
  member_id,
  entity_id,
  share_pct,
  sort_order,
  created_at,
  updated_at
from public.wealth_asset_owners
where deleted_at is null;

grant select on public.wealth_asset_owners_active to anon, authenticated;

-- รวมทรัพย์สิน + ผู้ถือ (สำหรับ UI รายการ)
create or replace view public.wealth_assets_with_owners as
select
  a.id,
  a.owner_id,
  a.name,
  a.category,
  a.subtype,
  a.detail,
  a.role,
  a.method,
  a.acquired_year,
  a.transfer_year,
  a.value_amount,
  a.value_unit,
  a.assessed_amount,
  a.assessed_unit,
  a.cost_amount,
  a.cost_unit,
  a.area_rai,
  a.area_ngan,
  a.area_sq_wa,
  a.attrs,
  a.sort_order,
  a.created_at,
  a.updated_at,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'holder_kind', o.holder_kind,
          'member_id', o.member_id,
          'entity_id', o.entity_id,
          'share_pct', o.share_pct,
          'holder_name', coalesce(m.name, e.name, o.external_name),
          'sort_order', o.sort_order
        )
        order by o.sort_order, o.id
      )
      from public.wealth_asset_owners o
      left join public.wealth_members m
        on m.id = o.member_id
       and m.deleted_at is null
       and m.owner_id is not distinct from a.owner_id
      left join public.wealth_entities e
        on e.id = o.entity_id
       and e.deleted_at is null
       and e.owner_id is not distinct from a.owner_id
      where o.asset_id = a.id
        and o.deleted_at is null
        and o.owner_id is not distinct from a.owner_id
    ),
    '[]'::jsonb
  ) as owners
from public.wealth_assets a
where a.deleted_at is null;

grant select on public.wealth_assets_with_owners to anon, authenticated;

-- ไม่มี seed — ใช้ข้อมูลจริงจากแอป / SQL Editor
-- ถ้าต้องการล้างข้อมูลเก่า: รัน supabase/sql/wealth_clear_demo_data.sql