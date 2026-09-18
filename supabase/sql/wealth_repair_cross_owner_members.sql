-- =============================================================================
-- Repair: ผู้ถือกรรมสิทธิ์ที่ชี้ member ของ owner อื่น
--
-- เกิดจากบั๊กเดิม: สร้าง member id แบบ M1/M2 จากรายการในบัญชีตัวเอง แล้ว upsert
-- ทับแถว PK ของบัญชีอื่น → ทรัพย์ของ A ไปโชว์ชื่อสมาชิกของ B
--
-- วิธีแก้: โคลนสมาชิกให้ owner ของ asset_owners เอง แล้วชี้ member_id ใหม่
-- ชื่อที่โชว์อาจยังเป็นชื่อที่ถูกทับไว้ — ตรวจ/แก้ชื่อในหน้าสมาชิกหลังรัน
--
-- ลำดับแนะนำ:
--   1) รัน wealth_fix_next_ids.sql (ถ้ายัง)
--   2) รันไฟล์นี้
--   3) รัน wealth_assets_with_owners_owner_scope.sql
-- =============================================================================

-- ตรวจก่อนแก้
select
  ao.owner_id as asset_owner_id,
  m.owner_id as member_owner_id,
  ao.member_id,
  m.name,
  count(*)::int as asset_owner_rows
from public.wealth_asset_owners ao
join public.wealth_members m
  on m.id = ao.member_id
where ao.deleted_at is null
  and m.owner_id is distinct from ao.owner_id
group by ao.owner_id, m.owner_id, ao.member_id, m.name
order by ao.owner_id, ao.member_id;

do $$
declare
  r record;
  v_new_id text;
begin
  for r in
    select distinct
      ao.owner_id as target_owner_id,
      ao.member_id as old_member_id,
      m.name,
      m.gen,
      m.age,
      m.relation,
      m.status
    from public.wealth_asset_owners ao
    join public.wealth_members m
      on m.id = ao.member_id
    where ao.deleted_at is null
      and ao.member_id is not null
      and m.owner_id is distinct from ao.owner_id
  loop
    v_new_id := public.wealth_next_member_id(r.target_owner_id);

    insert into public.wealth_members (
      id,
      owner_id,
      name,
      gen,
      age,
      relation,
      status,
      parent_ids,
      sort_order
    )
    values (
      v_new_id,
      r.target_owner_id,
      r.name,
      r.gen,
      r.age,
      r.relation,
      r.status,
      '{}'::text[],
      0
    );

    update public.wealth_asset_owners
    set member_id = v_new_id,
        updated_at = now()
    where owner_id = r.target_owner_id
      and member_id = r.old_member_id
      and deleted_at is null;

    raise notice 'cloned % → % for owner % (% )',
      r.old_member_id, v_new_id, r.target_owner_id, r.name;
  end loop;
end $$;

-- ตรวจหลังแก้ — ควรได้ 0 แถว
select
  ao.owner_id as asset_owner_id,
  m.owner_id as member_owner_id,
  ao.member_id,
  m.name
from public.wealth_asset_owners ao
join public.wealth_members m
  on m.id = ao.member_id
where ao.deleted_at is null
  and m.owner_id is distinct from ao.owner_id;
