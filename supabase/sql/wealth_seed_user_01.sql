-- =============================================================================
-- Seed: namchai (คุณนำชัย ชินูปการพงศ์) + ครอบครัว + ผูกข้อมูลที่มีอยู่
--
-- ลำดับรัน:
--   1) supabase/sql/wealth_users.sql
--   2) supabase/sql/wealth_families.sql
--   3) ไฟล์นี้
--
-- Login ในแอป:
--   username: namchai
--   password: namchai
--   ชื่อ: คุณนำชัย ชินูปการพงศ์
--
-- UUID คงที่ (เคยเป็น user_01) — ข้อมูลที่ผูก owner_id ไว้แล้วยังใช้ได้
-- ไม่ใช้ auth.users / Supabase Auth
-- รันซ้ำได้ (idempotent)
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_user_id     uuid := '11111111-1111-4111-8111-111111111111';
  v_username    text := 'namchai';
  v_password    text := 'namchai';
  v_display     text := 'คุณนำชัย ชินูปการพงศ์';
  v_family_name text := 'ตระกูลชินูปการพงศ์';
  v_family_id   text;
begin
  -- -------------------------------------------------------------------------
  -- 1) wealth_users
  -- -------------------------------------------------------------------------
  insert into public.wealth_users (id, username, password_hash, display_name)
  values (
    v_user_id,
    v_username,
    extensions.crypt(v_password, extensions.gen_salt('bf')),
    v_display
  )
  on conflict (id) do update
    set username = excluded.username,
        password_hash = excluded.password_hash,
        display_name = excluded.display_name,
        is_active = true,
        updated_at = now();

  -- กัน username ชนกับคนอื่น (คนละ id)
  if exists (
    select 1
    from public.wealth_users
    where lower(username) = lower(v_username)
      and id <> v_user_id
  ) then
    raise exception 'username % ถูกใช้โดย user อื่นแล้ว', v_username;
  end if;

  raise notice 'wealth_users พร้อม: % (%)', v_username, v_user_id;

  -- -------------------------------------------------------------------------
  -- 2) wealth_families (1:1)
  -- -------------------------------------------------------------------------
  select id into v_family_id
  from public.wealth_families
  where owner_id = v_user_id
    and deleted_at is null
  limit 1;

  if v_family_id is null then
    v_family_id := public.wealth_next_family_id(null);
    insert into public.wealth_families (id, name, owner_id)
    values (v_family_id, v_family_name, v_user_id);
    raise notice 'สร้าง wealth_families: % (%)', v_family_name, v_family_id;
  else
    update public.wealth_families
    set name = v_family_name,
        updated_at = now()
    where id = v_family_id;
    raise notice 'อัปเดต wealth_families: %', v_family_id;
  end if;

  -- -------------------------------------------------------------------------
  -- 3) ผูก orphan (owner_id is null) → namchai
  -- -------------------------------------------------------------------------
  update public.wealth_members
  set owner_id = v_user_id, updated_at = now()
  where owner_id is null;

  update public.wealth_entities
  set owner_id = v_user_id, updated_at = now()
  where owner_id is null;

  update public.wealth_assets
  set owner_id = v_user_id, updated_at = now()
  where owner_id is null;

  update public.wealth_asset_owners
  set owner_id = v_user_id, updated_at = now()
  where owner_id is null;

  update public.wealth_scenarios
  set owner_id = v_user_id, updated_at = now()
  where owner_id is null;

  update public.wealth_plan_items
  set owner_id = v_user_id, updated_at = now()
  where owner_id is null;

  raise notice 'ผูก orphan data → owner_id = % เสร็จแล้ว', v_user_id;
end $$;

do $$
declare
  t text;
  r record;
begin
  foreach t in array array[
    'wealth_members',
    'wealth_entities',
    'wealth_assets',
    'wealth_asset_owners',
    'wealth_scenarios',
    'wealth_plan_items',
    'wealth_families'
  ]
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    -- ลบ FK เก่าที่ยังชี้คนละตาราง (ถ้ามี)
    for r in
      select c.conname
      from pg_constraint c
      join pg_attribute a
        on a.attrelid = c.conrelid
       and a.attnum = any (c.conkey)
      where c.conrelid = ('public.' || t)::regclass
        and c.contype = 'f'
        and a.attname = 'owner_id'
        and c.confrelid is distinct from 'public.wealth_users'::regclass
    loop
      execute format('alter table public.%I drop constraint %I', t, r.conname);
    end loop;

    if not exists (
      select 1
      from pg_constraint c
      join pg_attribute a
        on a.attrelid = c.conrelid
       and a.attnum = any (c.conkey)
      where c.conrelid = ('public.' || t)::regclass
        and c.contype = 'f'
        and c.confrelid = 'public.wealth_users'::regclass
        and a.attname = 'owner_id'
    ) then
      begin
        execute format(
          'alter table public.%I
             add constraint %I
             foreign key (owner_id)
             references public.wealth_users (id)
             on delete cascade',
          t,
          t || '_owner_id_fkey'
        );
      exception
        when duplicate_object then
          null;
      end;
    end if;
  end loop;
end $$;

-- ตรวจผล
select
  u.id as user_id,
  u.username,
  u.display_name,
  f.id as family_id,
  f.name as family_name
from public.wealth_users u
join public.wealth_families f
  on f.owner_id = u.id and f.deleted_at is null
where u.id = '11111111-1111-4111-8111-111111111111';

-- ทดสอบ login RPC (ไม่คืน password)
select * from public.wealth_login('namchai', 'namchai');

select 'wealth_members' as table_name,
       count(*) filter (where owner_id = '11111111-1111-4111-8111-111111111111')::int as owned_by_namchai,
       count(*) filter (where owner_id is null)::int as still_null
from public.wealth_members
union all
select 'wealth_entities',
       count(*) filter (where owner_id = '11111111-1111-4111-8111-111111111111')::int,
       count(*) filter (where owner_id is null)::int
from public.wealth_entities
union all
select 'wealth_assets',
       count(*) filter (where owner_id = '11111111-1111-4111-8111-111111111111')::int,
       count(*) filter (where owner_id is null)::int
from public.wealth_assets
union all
select 'wealth_asset_owners',
       count(*) filter (where owner_id = '11111111-1111-4111-8111-111111111111')::int,
       count(*) filter (where owner_id is null)::int
from public.wealth_asset_owners
union all
select 'wealth_scenarios',
       count(*) filter (where owner_id = '11111111-1111-4111-8111-111111111111')::int,
       count(*) filter (where owner_id is null)::int
from public.wealth_scenarios
union all
select 'wealth_plan_items',
       count(*) filter (where owner_id = '11111111-1111-4111-8111-111111111111')::int,
       count(*) filter (where owner_id is null)::int
from public.wealth_plan_items;
