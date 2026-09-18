-- =============================================================================
-- Fix: ลบสมาชิกแล้วชน FK wealth_asset_owners_member_id_fkey
-- เปลี่ยนเป็น ON DELETE CASCADE (ลบผู้ถือกรรมสิทธิ์ตามสมาชิกอัตโนมัติ)
-- วางใน Supabase SQL Editor → Run
-- =============================================================================

alter table public.wealth_asset_owners
  drop constraint if exists wealth_asset_owners_member_id_fkey;

alter table public.wealth_asset_owners
  add constraint wealth_asset_owners_member_id_fkey
  foreign key (member_id)
  references public.wealth_members (id)
  on delete cascade;
