-- =============================================================================
-- Fix: wealth_next_*_id — ไม่ชน primary key
--
-- สาเหตุเดิม:
--   1) กรองตาม owner_id แต่ PK เป็น id ทั้งตาราง → user ต่างกันได้ id เดียวกัน
--   2) ข้ามแถว soft-deleted → ได้ id ที่ยังอยู่ในตาราง
--
-- วิธีแก้: นับ max จากทุกแถวที่ match รูปแบบ id (ไม่สน owner / deleted_at)
-- p_owner_id ยังรับได้ (backward-compat) แต่ไม่ใช้กรอง
--
-- Run ใน Supabase SQL Editor (ครั้งเดียวพอ)
-- =============================================================================

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

create or replace function public.wealth_next_scenario_id(p_owner_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  max_n integer;
begin
  select coalesce(max((regexp_match(id, '^S-(\d+)$'))[1]::integer), 0)
    into max_n
  from public.wealth_scenarios
  where id ~ '^S-[0-9]+$';

  return 'S-' || lpad((max_n + 1)::text, 3, '0');
end;
$$;

create or replace function public.wealth_next_plan_item_id(p_owner_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  max_n integer;
begin
  select coalesce(max((regexp_match(id, '^P-(\d+)$'))[1]::integer), 0)
    into max_n
  from public.wealth_plan_items
  where id ~ '^P-[0-9]+$';

  return 'P-' || lpad((max_n + 1)::text, 3, '0');
end;
$$;

grant execute on function public.wealth_next_entity_id(uuid) to authenticated, anon;
grant execute on function public.wealth_next_asset_id(uuid) to authenticated, anon;
grant execute on function public.wealth_next_asset_owner_id(uuid) to authenticated, anon;
grant execute on function public.wealth_next_member_id(uuid) to authenticated, anon;
grant execute on function public.wealth_next_scenario_id(uuid) to authenticated, anon;
grant execute on function public.wealth_next_plan_item_id(uuid) to authenticated, anon;

-- ตรวจเร็ว: id ถัดไปต้องมากกว่า max ที่มีอยู่
select public.wealth_next_asset_id(null) as next_asset_id;
