-- =============================================================================
-- ล้างข้อมูล demo/seed — ให้เริ่มจากฐานว่าง ใช้ข้อมูลจริง
-- Run ใน Supabase SQL Editor
--
-- ลำดับสำคัญ: ลบ plan/scenarios ก่อน (FK) แล้ว owners → assets / entities / members
-- =============================================================================

-- แผน + สถานการณ์
delete from public.wealth_plan_items;
delete from public.wealth_scenarios;

-- ทรัพย์สิน + ผู้ถือ + นิติบุคคล
delete from public.wealth_asset_owners;
delete from public.wealth_assets;
delete from public.wealth_entities;

-- สมาชิกครอบครัว (demo M1–M5)
-- ถ้าต้องการเก็บสมาชิกที่มีอยู่แล้ว ให้ comment บรรทัดด้านล่างนี้
delete from public.wealth_members;

-- ตรวจผล
select 'wealth_plan_items' as table_name, count(*)::int as rows from public.wealth_plan_items
union all
select 'wealth_scenarios', count(*)::int from public.wealth_scenarios
union all
select 'wealth_asset_owners', count(*)::int from public.wealth_asset_owners
union all
select 'wealth_assets', count(*)::int from public.wealth_assets
union all
select 'wealth_entities', count(*)::int from public.wealth_entities
union all
select 'wealth_members', count(*)::int from public.wealth_members;
