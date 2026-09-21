-- =============================================================================
-- Admin: CRUD บัญชีผู้ใช้ (รันหลัง wealth_admin.sql)
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- สร้างบัญชี
-- -----------------------------------------------------------------------------
create or replace function public.wealth_admin_create_user(
  p_actor text,
  p_username text,
  p_password text,
  p_display_name text default null,
  p_is_admin boolean default false,
  p_is_active boolean default true,
  p_family_name text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid;
  v_username text;
  v_family text;
  v_family_id text;
begin
  perform public.wealth_assert_admin(p_actor);

  v_username := trim(p_username);

  if v_username is null or v_username !~ '^[a-zA-Z0-9_]{3,32}$' then
    raise exception 'username ใช้ได้เฉพาะ a-z, 0-9, _ ความยาว 3–32 ตัว';
  end if;

  if p_password is null or length(p_password) < 4 then
    raise exception 'รหัสผ่านสั้นเกินไป';
  end if;

  if exists (
    select 1 from public.wealth_users
    where lower(username) = lower(v_username)
  ) then
    raise exception 'username นี้ถูกใช้แล้ว';
  end if;

  insert into public.wealth_users (
    username, password_hash, display_name, is_active, is_admin
  )
  values (
    v_username,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    nullif(trim(coalesce(p_display_name, '')), ''),
    coalesce(p_is_active, true),
    coalesce(p_is_admin, false)
  )
  returning id into v_user_id;

  v_family := nullif(trim(coalesce(p_family_name, '')), '');
  if v_family is null and not coalesce(p_is_admin, false) then
    v_family := 'ครอบครัว ' || v_username;
  end if;

  if v_family is not null then
    v_family_id := public.wealth_next_family_id(null);
    insert into public.wealth_families (id, name, owner_id)
    values (v_family_id, v_family, v_user_id);
  end if;
end;
$$;

revoke all on function public.wealth_admin_create_user(text, text, text, text, boolean, boolean, text) from public;
grant execute on function public.wealth_admin_create_user(text, text, text, text, boolean, boolean, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- แก้ไขบัญชี (username ไม่เปลี่ยน — เว้นรหัสผ่านว่าง = ไม่เปลี่ยน)
-- -----------------------------------------------------------------------------
create or replace function public.wealth_admin_update_user(
  p_actor text,
  p_username text,
  p_display_name text default null,
  p_is_admin boolean default false,
  p_is_active boolean default true,
  p_password text default null,
  p_family_name text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user public.wealth_users%rowtype;
  v_family text;
  v_family_id text;
begin
  perform public.wealth_assert_admin(p_actor);

  select *
  into v_user
  from public.wealth_users
  where lower(username) = lower(trim(p_username))
  limit 1;

  if not found then
    raise exception 'ไม่พบ username: %', p_username;
  end if;

  if lower(trim(p_actor)) = lower(v_user.username) then
    if coalesce(p_is_admin, false) is distinct from true then
      raise exception 'ห้ามถอนสิทธิ์ผู้ดูแลของตัวเอง';
    end if;
    if coalesce(p_is_active, true) is distinct from true then
      raise exception 'ห้ามปิดบัญชีของตัวเอง';
    end if;
  end if;

  if v_user.is_admin
     and coalesce(p_is_admin, false) is distinct from true
     and (
       select count(*) from public.wealth_users where is_admin = true
     ) <= 1 then
    raise exception 'ห้ามถอนสิทธิ์ผู้ดูแลคนสุดท้าย';
  end if;

  if p_password is not null and length(p_password) > 0 and length(p_password) < 4 then
    raise exception 'รหัสผ่านสั้นเกินไป';
  end if;

  update public.wealth_users
  set display_name = nullif(trim(coalesce(p_display_name, '')), ''),
      is_admin = coalesce(p_is_admin, false),
      is_active = coalesce(p_is_active, true),
      password_hash = case
        when p_password is not null and length(p_password) >= 4
          then extensions.crypt(p_password, extensions.gen_salt('bf'))
        else password_hash
      end,
      updated_at = now()
  where id = v_user.id;

  v_family := nullif(trim(coalesce(p_family_name, '')), '');
  if v_family is not null then
    select id
    into v_family_id
    from public.wealth_families
    where owner_id = v_user.id
      and deleted_at is null
    limit 1;

    if v_family_id is null then
      v_family_id := public.wealth_next_family_id(null);
      insert into public.wealth_families (id, name, owner_id)
      values (v_family_id, v_family, v_user.id);
    else
      update public.wealth_families
      set name = v_family,
          updated_at = now()
      where id = v_family_id;
    end if;
  end if;
end;
$$;

revoke all on function public.wealth_admin_update_user(text, text, text, boolean, boolean, text, text) from public;
grant execute on function public.wealth_admin_update_user(text, text, text, boolean, boolean, text, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- ลบบัญชี + ข้อมูลที่ผูก owner_id (ห้ามลบตัวเอง / ผู้ดูแลคนสุดท้าย)
-- -----------------------------------------------------------------------------
create or replace function public.wealth_admin_delete_user(
  p_actor text,
  p_username text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.wealth_users%rowtype;
  v_table text;
begin
  perform public.wealth_assert_admin(p_actor);

  if lower(trim(p_actor)) = lower(trim(p_username)) then
    raise exception 'ห้ามลบบัญชีของตัวเอง';
  end if;

  select *
  into v_user
  from public.wealth_users
  where lower(username) = lower(trim(p_username))
  limit 1;

  if not found then
    raise exception 'ไม่พบ username: %', p_username;
  end if;

  if v_user.is_admin
     and (
       select count(*) from public.wealth_users where is_admin = true
     ) <= 1 then
    raise exception 'ห้ามลบผู้ดูแลคนสุดท้าย';
  end if;

  if to_regclass('public.wealth_members') is not null then
    update public.wealth_members
    set partner_id = null
    where owner_id = v_user.id;
  end if;

  foreach v_table in array array[
    'wealth_calculation_results',
    'wealth_transaction_groups',
    'wealth_plan_items',
    'wealth_scenarios',
    'wealth_valuations',
    'wealth_asset_owners',
    'wealth_assets',
    'wealth_entities',
    'wealth_members',
    'wealth_tax_ledgers',
    'wealth_import_batches',
    'wealth_audit_logs',
    'wealth_tax_rule_versions',
    'wealth_families'
  ]
  loop
    if to_regclass('public.' || v_table) is not null then
      execute format(
        'delete from public.%I where owner_id = $1',
        v_table
      )
      using v_user.id;
    end if;
  end loop;

  delete from public.wealth_users where id = v_user.id;
end;
$$;

revoke all on function public.wealth_admin_delete_user(text, text) from public;
grant execute on function public.wealth_admin_delete_user(text, text) to anon, authenticated;
