-- =============================================================================
-- Wealth Transfer Phase 1 — Tax ledger, valuation, import, audit, rule versions
-- Table prefix: wealth_
-- Run after wealth_assets.sql / wealth_plans.sql
-- =============================================================================

create table if not exists public.wealth_tax_ledgers (
  id              text primary key,
  owner_id        uuid references auth.users (id) on delete cascade,
  accumulator_key text not null,
  ledger_kind     text not null
                    check (ledger_kind in (
                      'gift_related',
                      'gift_customary',
                      'gift_immovable_42_26',
                      'inheritance'
                    )),
  party_id        text not null,
  counterparty_id text,
  tax_year        text,
  prior_total     numeric(18, 4) not null default 0,
  current_total   numeric(18, 4) not null default 0,
  taxable_excess  numeric(18, 4) not null default 0,
  tax_amount      numeric(18, 4) not null default 0,
  source          text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists wealth_tax_ledgers_key_idx
  on public.wealth_tax_ledgers (owner_id, accumulator_key);

create table if not exists public.wealth_valuations (
  id                text primary key,
  owner_id          uuid references auth.users (id) on delete cascade,
  asset_id          text not null references public.wealth_assets (id) on delete cascade,
  valuation_method  text not null,
  value_amount      numeric(18, 4) not null,
  valuation_date    date,
  source            text,
  override_reason   text,
  created_at        timestamptz not null default now()
);

create table if not exists public.wealth_import_batches (
  id                text primary key,
  owner_id          uuid references auth.users (id) on delete cascade,
  filename          text not null,
  file_hash         text,
  template_version  text,
  row_count         integer not null default 0,
  imported_count    integer not null default 0,
  created_at        timestamptz not null default now()
);

create table if not exists public.wealth_audit_logs (
  id          bigserial primary key,
  owner_id    uuid references auth.users (id) on delete cascade,
  at          timestamptz not null default now(),
  user_label  text,
  item        text,
  change      text,
  category    text
);

create table if not exists public.wealth_tax_rule_versions (
  id              text primary key,
  owner_id        uuid references auth.users (id) on delete cascade,
  rule_id         text not null,
  legal_reference text,
  formula_notes   text,
  effective_from  date not null,
  effective_to    date,
  version         text not null,
  created_at      timestamptz not null default now()
);

create table if not exists public.wealth_transaction_groups (
  id                  text primary key,
  owner_id            uuid references auth.users (id) on delete cascade,
  method              text not null,
  planned_date        text,
  contract_price      numeric(18, 4),
  allocation_method   text,
  created_at          timestamptz not null default now()
);

create table if not exists public.wealth_calculation_results (
  id              text primary key,
  owner_id        uuid references auth.users (id) on delete cascade,
  asset_id        text references public.wealth_assets (id) on delete cascade,
  group_id        text references public.wealth_transaction_groups (id) on delete set null,
  rule_id         text,
  line_code       text,
  base_amount     numeric(18, 4),
  rate            numeric(12, 6),
  amount          numeric(18, 4) not null default 0,
  legal_reference text,
  created_at      timestamptz not null default now()
);

alter table public.wealth_tax_ledgers enable row level security;
alter table public.wealth_valuations enable row level security;
alter table public.wealth_import_batches enable row level security;
alter table public.wealth_audit_logs enable row level security;
alter table public.wealth_tax_rule_versions enable row level security;
alter table public.wealth_transaction_groups enable row level security;
alter table public.wealth_calculation_results enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'wealth_tax_ledgers',
    'wealth_valuations',
    'wealth_import_batches',
    'wealth_audit_logs',
    'wealth_tax_rule_versions',
    'wealth_transaction_groups',
    'wealth_calculation_results'
  ]
  loop
    if not exists (
      select 1 from pg_policies where policyname = t || '_all'
    ) then
      execute format(
        'create policy %I on public.%I for all to anon, authenticated using (true) with check (true)',
        t || '_all',
        t
      );
    end if;
  end loop;
end$$;

insert into public.wealth_tax_rule_versions (
  id, rule_id, legal_reference, formula_notes, effective_from, version
) values (
  'WT-P1-2569.09',
  'phase1-bundle',
  'กฎหมายไทย ณ 15 ก.ย. 2569',
  'Gift ม.42(26)(27)(28) · มรดก พ.ร.บ. 2558 · SBT/PIT/WHT ตามกรมที่ดินและสรรพากร',
  '2015-08-05',
  'WT-P1-2569.09'
) on conflict (id) do nothing;

grant select, insert, update, delete on public.wealth_tax_ledgers to anon, authenticated;
grant select, insert, update, delete on public.wealth_valuations to anon, authenticated;
grant select, insert, update, delete on public.wealth_import_batches to anon, authenticated;
grant select, insert, update, delete on public.wealth_audit_logs to anon, authenticated;
grant usage, select on sequence public.wealth_audit_logs_id_seq to anon, authenticated;
grant select, insert, update, delete on public.wealth_tax_rule_versions to anon, authenticated;
grant select, insert, update, delete on public.wealth_transaction_groups to anon, authenticated;
grant select, insert, update, delete on public.wealth_calculation_results to anon, authenticated;
