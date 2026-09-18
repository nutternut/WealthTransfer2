-- =============================================================================
-- Seed: เพิ่ม 4 user + ครอบครัวคนละ 1 (ข้อมูลเริ่มว่าง)
--
-- ลำดับรัน: หลัง wealth_users.sql + wealth_families.sql (+ namchai ถ้ามี)
-- namchai แยกไฟล์: wealth_seed_user_01.sql
--
-- | username | password | ชื่อที่แสดง                         | ครอบครัว              |
-- |----------|----------|-------------------------------------|------------------------|
-- | yingsak  | yingsak  | คุณยิ่งศักดิ์ ชินูปการพงศ์         | ตระกูลชินูปการพงศ์     |
-- | somwang  | somwang  | คุณสมหวัง ชินูปการพงศ์             | ตระกูลชินูปการพงศ์     |
-- | sanga    | sanga    | คุณสง่า ชินูปการพงศ์               | ตระกูลชินูปการพงศ์     |
-- | apiwan   | apiwan   | คุณอภิวันทน์ โอวจริยาพิทักษ์       | ตระกูลโอวจริยาพิทักษ์   |
-- | famz     | famz     | คุณเอกชัย อภิศักดิ์กุล             | ตระกูลอภิศักดิ์กุล     |
--
-- หมายเหตุ: คนละบัญชี = คนละครอบครัว (owner_id UNIQUE) แม้ชื่อตระกูลซ้ำได้
-- รันซ้ำได้ (idempotent)
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- แก้ next id ให้รันเลขกลางทั้งตาราง (กัน F1 ชนข้าม user)
create or replace function public.wealth_next_family_id(p_owner_id uuid default null)
returns text
language sql
stable
as $$
  select 'F' || coalesce(
    (
      select max(substring(id from 2)::int) + 1
      from public.wealth_families
      where id ~ '^F[0-9]+$'
    ),
    1
  );
$$;

do $$
declare
  r record;
  v_family_id text;
begin
  for r in
    select *
    from (
      values
        (
          '22222222-2222-4222-8222-222222222222'::uuid,
          'yingsak',
          'yingsak',
          'คุณยิ่งศักดิ์ ชินูปการพงศ์',
          'ตระกูลชินูปการพงศ์'
        ),
        (
          '33333333-3333-4333-8333-333333333333'::uuid,
          'somwang',
          'somwang',
          'คุณสมหวัง ชินูปการพงศ์',
          'ตระกูลชินูปการพงศ์'
        ),
        (
          '44444444-4444-4444-8444-444444444444'::uuid,
          'sanga',
          'sanga',
          'คุณสง่า ชินูปการพงศ์',
          'ตระกูลชินูปการพงศ์'
        ),
        (
          '55555555-5555-4555-8555-555555555555'::uuid,
          'apiwan',
          'apiwan',
          'คุณอภิวันทน์ โอวจริยาพิทักษ์',
          'ตระกูลโอวจริยาพิทักษ์'
        ),
        (
          '66666666-6666-4666-8666-666666666666'::uuid,
          'famz',
          'famz',
          'คุณเอกชัย อภิศักดิ์กุล',
          'ตระกูลอภิศักดิ์กุล'
        )
    ) as t(user_id, username, password, display_name, family_name)
  loop
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
      -- id ครอบครัวเป็น PK ทั้งตาราง — ใช้เลขรันกลาง (อย่าใช้ F1 ซ้ำข้าม user)
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
where u.username in ('yingsak', 'somwang', 'sanga', 'apiwan', 'famz')
order by u.username;

-- ทดสอบ login (ควรได้ 1 แถวต่อคน)
select * from public.wealth_login('yingsak', 'yingsak');
select * from public.wealth_login('somwang', 'somwang');
select * from public.wealth_login('sanga', 'sanga');
select * from public.wealth_login('apiwan', 'apiwan');
select * from public.wealth_login('famz', 'famz');
