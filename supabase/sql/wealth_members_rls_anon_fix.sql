-- =============================================================================
-- Fix RLS: soft-delete ตั้ง deleted_at แล้วโดน with check ปฏิเสธ
-- วางใน Supabase SQL Editor → Run ทั้งไฟล์
-- =============================================================================

alter table public.wealth_members enable row level security;

-- ลบ policy เก่าทั้งหมดบนตารางนี้ (ไม่สนชื่อ)
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

-- ตรวจผล: UPDATE with check ต้องเป็น true / null ไม่ใช่ (deleted_at IS NULL)
select
  policyname,
  cmd,
  qual as using_expr,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'wealth_members'
order by policyname;
