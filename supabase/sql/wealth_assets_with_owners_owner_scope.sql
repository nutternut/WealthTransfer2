-- =============================================================================
-- Fix: wealth_assets_with_owners — join สมาชิก/นิติบุคคล ต้องอยู่ owner เดียวกัน
--
-- สาเหตุ: join แค่ m.id = o.member_id ทำให้ถ้า member id ถูกบัญชีอื่น upsert ทับ
--   ชื่อผู้ถือกรรมสิทธิ์บน dashboard จะไปโชว์ของ owner อื่น
--
-- Run ใน Supabase SQL Editor (ครั้งเดียว)
-- =============================================================================

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
