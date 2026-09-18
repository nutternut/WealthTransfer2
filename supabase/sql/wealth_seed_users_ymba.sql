-- =============================================================================
-- Seed: YMBA01 – YMBA10 + ครอบครัวคนละ 1 (ข้อมูลเริ่มว่าง)
--
-- ลำดับรัน: หลัง wealth_users.sql + wealth_families.sql
--
-- | username | password | ชื่อที่แสดง | ครอบครัว          |
-- |----------|----------|-------------|--------------------|
-- | YMBA01   | YMBA01   | YMBA01      | ครอบครัว YMBA01    |
-- | YMBA02   | YMBA02   | YMBA02      | ครอบครัว YMBA02    |
-- | ...      | ...      | ...         | ...                |
-- | YMBA10   | YMBA10   | YMBA10      | ครอบครัว YMBA10    |
--
-- คนละบัญชี = คนละครอบครัว (owner_id UNIQUE)
-- รันซ้ำได้ (idempotent)
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  i           int;
  r           record;
  v_family_id text;
begin
  for i in 1..10 loop
    select
      (
        'aaaa' || lpad(i::text, 4, '0')
        || '-0001-4001-a001-'
        || lpad(i::text, 12, '0')
      )::uuid as user_id,
      'YMBA' || lpad(i::text, 2, '0') as username,
      'YMBA' || lpad(i::text, 2, '0') as password,
      'YMBA' || lpad(i::text, 2, '0') as display_name,
      'ครอบครัว YMBA' || lpad(i::text, 2, '0') as family_name
    into r;

    if exists (
      select 1
      from public.wealth_users
      where lower(username) = lower(r.username)
        and id <> r.user_id
    ) then
      raise exception 'username % ถูกใช้โดย user อื่นแล้ว', r.username;
    end if;

    insert into public.wealth_users (id, username, password_hash, display_name)
    values (
      r.user_id,
      r.username,
      extensions.crypt(r.password, extensions.gen_salt('bf')),
      r.display_name
    )
    on conflict (id) do update
      set username = excluded.username,
          password_hash = excluded.password_hash,
          display_name = excluded.display_name,
          is_active = true,
          updated_at = now();

    select f.id into v_family_id
    from public.wealth_families f
    where f.owner_id = r.user_id
      and f.deleted_at is null
    limit 1;

    if v_family_id is null then
      v_family_id := public.wealth_next_family_id(null);
      insert into public.wealth_families (id, name, owner_id)
      values (v_family_id, r.family_name, r.user_id);
    else
      update public.wealth_families
      set name = r.family_name,
          updated_at = now()
      where id = v_family_id;
    end if;

    raise notice 'พร้อม: % / % → % (%)',
      r.username, r.display_name, r.family_name, v_family_id;
  end loop;
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
where u.username ~ '^YMBA(0[1-9]|10)$'
order by u.username;

-- ทดสอบ login (ควรได้ 1 แถวต่อคน)
select * from public.wealth_login('YMBA01', 'YMBA01');
select * from public.wealth_login('YMBA10', 'YMBA10');
