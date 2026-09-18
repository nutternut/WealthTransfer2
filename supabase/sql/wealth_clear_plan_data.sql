-- =============================================================================
-- ล้างเฉพาะแผน + สถานการณ์ (hard delete)
-- ไม่ลบทรัพย์ / สมาชิก / นิติ
-- soft-delete (deleted_at) ถูก RLS บล็อกบน remote — ใช้ DELETE
-- Run ใน Supabase SQL Editor
-- =============================================================================

delete from public.wealth_plan_items;
delete from public.wealth_scenarios;

-- ตรวจผล (ควรเป็น 0 ทั้งคู่)
select 'wealth_plan_items' as table_name, count(*)::int as rows
from public.wealth_plan_items
union all
select 'wealth_scenarios', count(*)::int
from public.wealth_scenarios;
