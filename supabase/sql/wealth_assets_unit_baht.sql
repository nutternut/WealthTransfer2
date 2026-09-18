-- =============================================================================
-- หน่วยเงิน = บาท (ไม่ใช้ล้านบาท) + ย้ำว่า amount ว่างได้
-- Run ใน Supabase SQL Editor ถ้าเคยสร้าง wealth_assets แล้ว
-- =============================================================================

alter table public.wealth_assets
  alter column value_unit set default 'บาท',
  alter column assessed_unit set default 'บาท',
  alter column cost_unit set default 'บาท';

update public.wealth_assets
set
  value_unit = 'บาท',
  assessed_unit = 'บาท',
  cost_unit = 'บาท'
where value_unit = 'ล้านบาท'
   or assessed_unit = 'ล้านบาท'
   or cost_unit = 'ล้านบาท';

comment on column public.wealth_assets.value_amount is
  'มูลค่าตลาด (บาท) — คู่กับ value_unit, ว่างได้';
comment on column public.wealth_assets.assessed_amount is
  'ราคาประเมิน (บาท) — ว่างได้';
comment on column public.wealth_assets.cost_amount is
  'ต้นทุน (บาท) — ว่างได้';
