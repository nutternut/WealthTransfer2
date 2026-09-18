-- =============================================================================
-- Wealth Transfer — Scenarios + Plan items (วางแผนส่งต่อ)
-- Run ใน Supabase SQL Editor หลัง wealth_assets.sql
-- Table prefix: wealth_
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) updated_at helper (idempotent)
-- -----------------------------------------------------------------------------
create or replace function public.wealth_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =============================================================================
-- 1) wealth_scenarios — ผลคำนวณจาก wizard
-- =============================================================================
create table if not exists public.wealth_scenarios (
  id                  text primary key,
  owner_id            uuid references auth.users (id) on delete cascade,

  asset_id            text not null
                        references public.wealth_assets (id) on delete cascade,

  method              text not null,
  year_label          text not null,
  transfer_share_pct  numeric(7, 4) not null
                        check (transfer_share_pct > 0 and transfer_share_pct <= 100),

  market_value        numeric(18, 4) not null default 0,
  tax_amount          numeric(18, 4) not null default 0,
  fees_amount         numeric(18, 4) not null default 0,
  total_amount        numeric(18, 4) not null default 0,
  score               numeric(4, 2) not null default 0,

  status              text not null default 'คำนวณแล้ว',
  criteria            jsonb not null default '{}'::jsonb,
  -- [{ "name": "...", "share": 50, "member_id": "M1" }]
  receivers           jsonb not null default '[]'::jsonb,

  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

comment on table public.wealth_scenarios is
  'สถานการณ์วางแผนส่งต่อ — ผลคำนวณจาก wizard';

create index if not exists wealth_scenarios_owner_id_idx
  on public.wealth_scenarios (owner_id)
  where deleted_at is null;

create index if not exists wealth_scenarios_asset_id_idx
  on public.wealth_scenarios (asset_id)
  where deleted_at is null;

drop trigger if exists wealth_scenarios_set_updated_at on public.wealth_scenarios;
create trigger wealth_scenarios_set_updated_at
  before update on public.wealth_scenarios
  for each row
  execute function public.wealth_set_updated_at();

-- p_owner_id เก็บไว้เพื่อ backward-compat กับ RPC เดิม — ไม่ใช้กรอง
-- เพราะ id เป็น PK ทั้งตาราง (ห้ามซ้ำข้าม user / soft-deleted)
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

grant execute on function public.wealth_next_scenario_id(uuid) to authenticated, anon;

-- =============================================================================
-- 2) wealth_plan_items — รายการที่เลือกเข้าแผน
-- =============================================================================
create table if not exists public.wealth_plan_items (
  id              text primary key,
  owner_id        uuid references auth.users (id) on delete cascade,

  asset_id        text not null
                    references public.wealth_assets (id) on delete cascade,
  scenario_id     text
                    references public.wealth_scenarios (id) on delete set null,

  owner_name      text not null default '',
  receiver_label  text not null default '',
  method          text not null,
  share_label     text not null default '',
  year_label      text not null default '',
  cost_amount     numeric(18, 4) not null default 0,
  status          text not null default 'เลือกเข้าสู่แผนแล้ว',

  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

comment on table public.wealth_plan_items is
  'รายการแผนส่งต่อที่เลือกจากสถานการณ์';

create index if not exists wealth_plan_items_owner_id_idx
  on public.wealth_plan_items (owner_id)
  where deleted_at is null;

create index if not exists wealth_plan_items_asset_id_idx
  on public.wealth_plan_items (asset_id)
  where deleted_at is null;

create index if not exists wealth_plan_items_scenario_id_idx
  on public.wealth_plan_items (scenario_id)
  where scenario_id is not null and deleted_at is null;

drop trigger if exists wealth_plan_items_set_updated_at on public.wealth_plan_items;
create trigger wealth_plan_items_set_updated_at
  before update on public.wealth_plan_items
  for each row
  execute function public.wealth_set_updated_at();

-- p_owner_id เก็บไว้เพื่อ backward-compat กับ RPC เดิม — ไม่ใช้กรอง
-- เพราะ id เป็น PK ทั้งตาราง (ห้ามซ้ำข้าม user / soft-deleted)
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

grant execute on function public.wealth_next_plan_item_id(uuid) to authenticated, anon;

-- =============================================================================
-- 3) RLS (prototype: anon + soft-delete)
-- =============================================================================
alter table public.wealth_scenarios enable row level security;

drop policy if exists wealth_scenarios_select_anon on public.wealth_scenarios;
drop policy if exists wealth_scenarios_insert_anon on public.wealth_scenarios;
drop policy if exists wealth_scenarios_update_anon on public.wealth_scenarios;
drop policy if exists wealth_scenarios_delete_anon on public.wealth_scenarios;

create policy wealth_scenarios_select_anon
  on public.wealth_scenarios
  for select
  to anon, authenticated
  using (deleted_at is null);

create policy wealth_scenarios_insert_anon
  on public.wealth_scenarios
  for insert
  to anon, authenticated
  with check (true);

create policy wealth_scenarios_update_anon
  on public.wealth_scenarios
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy wealth_scenarios_delete_anon
  on public.wealth_scenarios
  for delete
  to anon, authenticated
  using (true);

grant select, insert, update, delete on public.wealth_scenarios to anon, authenticated;

alter table public.wealth_plan_items enable row level security;

drop policy if exists wealth_plan_items_select_anon on public.wealth_plan_items;
drop policy if exists wealth_plan_items_insert_anon on public.wealth_plan_items;
drop policy if exists wealth_plan_items_update_anon on public.wealth_plan_items;
drop policy if exists wealth_plan_items_delete_anon on public.wealth_plan_items;

create policy wealth_plan_items_select_anon
  on public.wealth_plan_items
  for select
  to anon, authenticated
  using (deleted_at is null);

create policy wealth_plan_items_insert_anon
  on public.wealth_plan_items
  for insert
  to anon, authenticated
  with check (true);

create policy wealth_plan_items_update_anon
  on public.wealth_plan_items
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy wealth_plan_items_delete_anon
  on public.wealth_plan_items
  for delete
  to anon, authenticated
  using (true);

grant select, insert, update, delete on public.wealth_plan_items to anon, authenticated;

-- =============================================================================
-- 4) Views — สถานะแผนต่อทรัพย์สิน
-- =============================================================================
create or replace view public.wealth_asset_plan_status as
select
  a.id as asset_id,
  exists (
    select 1
    from public.wealth_plan_items p
    where p.asset_id = a.id
      and p.deleted_at is null
  ) as has_plan,
  exists (
    select 1
    from public.wealth_scenarios s
    where s.asset_id = a.id
      and s.deleted_at is null
  ) as has_scenario
from public.wealth_assets a
where a.deleted_at is null;

grant select on public.wealth_asset_plan_status to anon, authenticated;
