-- =============================================================================
-- Wealth Transfer — Admin back office
-- รันบนฐานที่มี wealth_users / wealth_families แล้ว
--
-- Login หลังบ้าน:
--   username: admin
--   password: admi1234
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

alter table public.wealth_users
  add column if not exists is_admin boolean not null default false;

comment on column public.wealth_users.is_admin is
  'บัญชีหลังบ้าน — เข้า /admin ได้';

-- -----------------------------------------------------------------------------
-- Login คืน is_admin (ต้อง DROP เพราะเปลี่ยน RETURNS TABLE)
-- -----------------------------------------------------------------------------
drop function if exists public.wealth_login(text, text);

create function public.wealth_login(
  p_username text,
  p_password text
)
returns table (
  user_id uuid,
  username text,
  display_name text,
  family_id text,
  family_name text,
  is_admin boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user public.wealth_users%rowtype;
begin
  if p_username is null or length(trim(p_username)) = 0
     or p_password is null or length(p_password) = 0 then
    return;
  end if;

  select *
  into v_user
  from public.wealth_users u
  where lower(u.username) = lower(trim(p_username))
    and u.is_active = true
  limit 1;

  if not found then
    return;
  end if;

  if v_user.password_hash is distinct from
       extensions.crypt(p_password, v_user.password_hash) then
    return;
  end if;

  return query
  select
    v_user.id,
    v_user.username,
    v_user.display_name,
    f.id,
    f.name,
    v_user.is_admin
  from (select 1) _
  left join public.wealth_families f
    on f.owner_id = v_user.id
   and f.deleted_at is null;
end;
$$;

revoke all on function public.wealth_login(text, text) from public;
grant execute on function public.wealth_login(text, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Helper: ยืนยันว่า actor เป็นแอดมินที่ยังใช้งาน
-- -----------------------------------------------------------------------------
create or replace function public.wealth_assert_admin(p_actor text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select u.id
  into v_id
  from public.wealth_users u
  where lower(u.username) = lower(trim(p_actor))
    and u.is_active = true
    and u.is_admin = true
  limit 1;

  if v_id is null then
    raise exception 'ไม่มีสิทธิ์ผู้ดูแลระบบ';
  end if;

  return v_id;
end;
$$;

revoke all on function public.wealth_assert_admin(text) from public;
grant execute on function public.wealth_assert_admin(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- สถิติหลังบ้าน
-- -----------------------------------------------------------------------------
create or replace function public.wealth_admin_stats(p_actor text)
returns table (
  user_count bigint,
  family_count bigint,
  admin_count bigint,
  active_user_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.wealth_assert_admin(p_actor);

  return query
  select
    (select count(*) from public.wealth_users)::bigint,
    (select count(*) from public.wealth_families where deleted_at is null)::bigint,
    (select count(*) from public.wealth_users where is_admin = true)::bigint,
    (select count(*) from public.wealth_users where is_active = true)::bigint;
end;
$$;

revoke all on function public.wealth_admin_stats(text) from public;
grant execute on function public.wealth_admin_stats(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- รายชื่อบัญชี
-- -----------------------------------------------------------------------------
create or replace function public.wealth_admin_list_users(p_actor text)
returns table (
  user_id uuid,
  username text,
  display_name text,
  is_active boolean,
  is_admin boolean,
  family_id text,
  family_name text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.wealth_assert_admin(p_actor);

  return query
  select
    u.id,
    u.username,
    u.display_name,
    u.is_active,
    u.is_admin,
    f.id,
    f.name,
    u.created_at
  from public.wealth_users u
  left join public.wealth_families f
    on f.owner_id = u.id
   and f.deleted_at is null
  order by u.created_at desc;
end;
$$;

revoke all on function public.wealth_admin_list_users(text) from public;
grant execute on function public.wealth_admin_list_users(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- รายชื่อครอบครัว
-- -----------------------------------------------------------------------------
create or replace function public.wealth_admin_list_families(p_actor text)
returns table (
  family_id text,
  name text,
  owner_username text,
  owner_display_name text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.wealth_assert_admin(p_actor);

  return query
  select
    f.id,
    f.name,
    u.username,
    u.display_name,
    f.created_at
  from public.wealth_families f
  join public.wealth_users u on u.id = f.owner_id
  where f.deleted_at is null
  order by f.created_at desc;
end;
$$;

revoke all on function public.wealth_admin_list_families(text) from public;
grant execute on function public.wealth_admin_list_families(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- เปิด/ปิดบัญชี (ห้ามปิดตัวเอง)
-- -----------------------------------------------------------------------------
create or replace function public.wealth_admin_set_user_active(
  p_actor text,
  p_username text,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.wealth_assert_admin(p_actor);

  if lower(trim(p_actor)) = lower(trim(p_username)) then
    raise exception 'ห้ามปิดหรือเปิดบัญชีของตัวเอง';
  end if;

  update public.wealth_users
  set is_active = p_active,
      updated_at = now()
  where lower(username) = lower(trim(p_username));

  if not found then
    raise exception 'ไม่พบ username: %', p_username;
  end if;
end;
$$;

revoke all on function public.wealth_admin_set_user_active(text, text, boolean) from public;
grant execute on function public.wealth_admin_set_user_active(text, text, boolean) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Seed บัญชี admin
-- -----------------------------------------------------------------------------
do $$
declare
  v_user_id  uuid;
  v_username text := 'admin';
  v_password text := 'admi1234';
begin
  select id
  into v_user_id
  from public.wealth_users
  where lower(username) = lower(v_username)
  limit 1;

  if v_user_id is null then
    v_user_id := 'a0000000-0000-4000-8000-000000000001';
    insert into public.wealth_users (
      id, username, password_hash, display_name, is_active, is_admin
    )
    values (
      v_user_id,
      v_username,
      extensions.crypt(v_password, extensions.gen_salt('bf')),
      'ผู้ดูแลระบบ',
      true,
      true
    );
  else
    update public.wealth_users
    set password_hash = extensions.crypt(v_password, extensions.gen_salt('bf')),
        display_name = coalesce(nullif(display_name, ''), 'ผู้ดูแลระบบ'),
        is_active = true,
        is_admin = true,
        updated_at = now()
    where id = v_user_id;
  end if;

  raise notice 'wealth_users admin พร้อม: %', v_user_id;
end $$;

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
