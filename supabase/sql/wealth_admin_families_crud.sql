-- =============================================================================
-- Admin: CRUD ครอบครัว (รันหลัง wealth_admin.sql)
-- 1 user = 1 ครอบครัวที่ยังไม่ถูกลบ
-- ลบเป็นการปิด (deleted_at) ไม่ลบบัญชีเจ้าของ
-- =============================================================================

-- -----------------------------------------------------------------------------
-- สร้าง / กู้ครอบครัวของบัญชีที่ยังไม่มีครอบครัวใช้งาน
-- -----------------------------------------------------------------------------
create or replace function public.wealth_admin_create_family(
  p_actor text,
  p_name text,
  p_owner_username text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner public.wealth_users%rowtype;
  v_name text;
  v_family public.wealth_families%rowtype;
  v_family_id text;
begin
  perform public.wealth_assert_admin(p_actor);

  v_name := trim(coalesce(p_name, ''));
  if v_name is null or length(v_name) = 0 then
    raise exception 'ชื่อครอบครัวว่าง';
  end if;

  select *
  into v_owner
  from public.wealth_users
  where lower(username) = lower(trim(p_owner_username))
  limit 1;

  if not found then
    raise exception 'ไม่พบบัญชีเจ้าของ: %', p_owner_username;
  end if;

  if exists (
    select 1
    from public.wealth_families
    where owner_id = v_owner.id
      and deleted_at is null
  ) then
    raise exception 'บัญชีนี้มีครอบครัวอยู่แล้ว';
  end if;

  select *
  into v_family
  from public.wealth_families
  where owner_id = v_owner.id
  order by created_at desc
  limit 1;

  if found then
    update public.wealth_families
    set name = v_name,
        deleted_at = null,
        updated_at = now()
    where id = v_family.id;
  else
    v_family_id := public.wealth_next_family_id(null);
    insert into public.wealth_families (id, name, owner_id)
    values (v_family_id, v_name, v_owner.id);
  end if;
end;
$$;

revoke all on function public.wealth_admin_create_family(text, text, text) from public;
grant execute on function public.wealth_admin_create_family(text, text, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- แก้ชื่อครอบครัว
-- -----------------------------------------------------------------------------
create or replace function public.wealth_admin_update_family(
  p_actor text,
  p_family_id text,
  p_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  perform public.wealth_assert_admin(p_actor);

  v_name := trim(coalesce(p_name, ''));
  if v_name is null or length(v_name) = 0 then
    raise exception 'ชื่อครอบครัวว่าง';
  end if;

  update public.wealth_families
  set name = v_name,
      updated_at = now()
  where id = trim(p_family_id)
    and deleted_at is null;

  if not found then
    raise exception 'ไม่พบครอบครัว: %', p_family_id;
  end if;
end;
$$;

revoke all on function public.wealth_admin_update_family(text, text, text) from public;
grant execute on function public.wealth_admin_update_family(text, text, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- ลบแบบปิดใช้งาน (คงบัญชีเจ้าของและข้อมูลครอบครัว)
-- -----------------------------------------------------------------------------
create or replace function public.wealth_admin_delete_family(
  p_actor text,
  p_family_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.wealth_assert_admin(p_actor);

  update public.wealth_families
  set deleted_at = now(),
      updated_at = now()
  where id = trim(p_family_id)
    and deleted_at is null;

  if not found then
    raise exception 'ไม่พบครอบครัว: %', p_family_id;
  end if;
end;
$$;

revoke all on function public.wealth_admin_delete_family(text, text) from public;
grant execute on function public.wealth_admin_delete_family(text, text) to anon, authenticated;
