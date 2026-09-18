-- =============================================================================
-- รองรับผู้ถือกรรมสิทธิ์ประเภท "คนนอก" — พิมพ์ชื่อเอง (ไม่ผูกสมาชิก/นิติบุคคล)
-- รันใน Supabase SQL Editor หลัง wealth_assets.sql
-- =============================================================================

-- 1) คอลัมน์ชื่อคนนอก
alter table public.wealth_asset_owners
  add column if not exists external_name text;

comment on column public.wealth_asset_owners.external_name is
  'ชื่อผู้ถือประเภทคนนอก (พิมพ์เอง) — ใช้เมื่อ holder_kind = คนนอก';

-- 2) ขยายค่า holder_kind
alter table public.wealth_asset_owners
  drop constraint if exists wealth_asset_owners_holder_kind_check;

alter table public.wealth_asset_owners
  add constraint wealth_asset_owners_holder_kind_check
  check (holder_kind in ('บุคคลธรรมดา', 'คนนอก', 'นิติบุคคล'));

-- 3) ข้อบังคับตามประเภทผู้ถือ
alter table public.wealth_asset_owners
  drop constraint if exists wealth_asset_owners_holder_person;

alter table public.wealth_asset_owners
  drop constraint if exists wealth_asset_owners_holder_entity;

alter table public.wealth_asset_owners
  drop constraint if exists wealth_asset_owners_holder_external;

alter table public.wealth_asset_owners
  add constraint wealth_asset_owners_holder_person
  check (
    holder_kind <> 'บุคคลธรรมดา'
    or (
      member_id is not null
      and entity_id is null
      and external_name is null
    )
  );

alter table public.wealth_asset_owners
  add constraint wealth_asset_owners_holder_entity
  check (
    holder_kind <> 'นิติบุคคล'
    or (
      entity_id is not null
      and member_id is null
      and external_name is null
    )
  );

alter table public.wealth_asset_owners
  add constraint wealth_asset_owners_holder_external
  check (
    holder_kind <> 'คนนอก'
    or (
      external_name is not null
      and length(trim(external_name)) > 0
      and member_id is null
      and entity_id is null
    )
  );

-- 4) ไม่ให้ชื่อคนนอกซ้ำในทรัพย์สินเดียวกัน
create unique index if not exists wealth_asset_owners_asset_external_uq
  on public.wealth_asset_owners (asset_id, lower(trim(external_name)))
  where external_name is not null and deleted_at is null;

-- 5) อัปเดต view ให้แสดงชื่อคนนอก
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
