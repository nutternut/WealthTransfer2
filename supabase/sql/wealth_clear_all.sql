-- =============================================================================
-- ล้างข้อมูล wealth_* ทั้งหมด (รวม users / families)
-- Run ใน Supabase SQL Editor
--
-- หลังรัน: ต้อง seed users ใหม่ (เช่น wealth_seed_users_4.sql / wealth_seed_user_01.sql)
-- แล้วล็อกอินใหม่
-- =============================================================================

-- ตัด self-FK ก่อนลบ members (partner_id)
update public.wealth_members set partner_id = null;

-- แผน / สถานการณ์
delete from public.wealth_plan_items;
delete from public.wealth_scenarios;

-- ทรัพย์ / ผู้ถือ / นิติ
delete from public.wealth_asset_owners;
delete from public.wealth_assets;
delete from public.wealth_entities;

-- สมาชิก
delete from public.wealth_members;

-- ครอบครัว → ผู้ใช้ (ลำดับ FK)
delete from public.wealth_families;
delete from public.wealth_users;

-- ตรวจผล (ควรเป็น 0 ทุกแถว)
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
select 'wealth_members', count(*)::int from public.wealth_members
union all
select 'wealth_families', count(*)::int from public.wealth_families
union all
select 'wealth_users', count(*)::int from public.wealth_users;
