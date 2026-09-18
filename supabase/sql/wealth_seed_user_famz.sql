-- =============================================================================
-- Seed: famz + ครอบครัว (ข้อมูลเริ่มว่าง)
--
-- ลำดับรัน: หลัง wealth_users.sql + wealth_families.sql
--
-- Login ในแอป:
--   username: famz
--   password: famz
--   ชื่อ: Famz
--
-- รันซ้ำได้ (idempotent)
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_user_id     uuid := '66666666-6666-4666-8666-666666666666';
  v_username    text := 'famz';
  v_password    text := 'famz';
  v_display     text := 'Famz';
  v_family_name text := 'ครอบครัว Famz';
  v_family_id   text;
begin
  if exists (
    select 1
    from public.wealth_users
    where lower(username) = lower(v_username)
      and id <> v_user_id
  ) then
    raise exception 'username % ถูกใช้โดย user อื่นแล้ว', v_username;
  end if;

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

  select f.id into v_family_id
  from public.wealth_families f
  where f.owner_id = v_user_id
    and f.deleted_at is null
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

  raise notice 'พร้อม: % / % → % (%)',
    v_username, v_display, v_family_name, v_family_id;
end $$;

-- ตรวจผล
select
  u.username,
  u.display_name,
  f.id as family_id,
  f.name as family_name
from public.wealth_users u
join public.wealth_families f
  on f.owner_id = u.id and f.deleted_at is null
where u.username = 'famz';

-- ทดสอบ login (ควรได้ 1 แถว)
select * from public.wealth_login('famz', 'famz');
