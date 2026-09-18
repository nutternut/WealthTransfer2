/**
 * ประมาณการค่าธรรมเนียม + ภาษี/อากร สำหรับวางแผนส่งต่อ
 * ตามคู่มือปรับปรุงระบบ Wealth Transfer ระยะที่ 1 (ณ 15 ก.ย. 2569)
 *
 * หน่วยเงิน: บาท — ไม่ใช่คำวินิจฉัยทางภาษี
 * ผลที่ยืนยันได้ต้องมีข้อมูลครบและสถานะไม่ใช่ Missing Data / Review Required
 */

import type { TransferMethod } from "@/lib/scenario-store";
import {
  classifyMovableSecurity,
  classifyReceiverRelation,
  toReceiverRelation,
  isAscendantOrDescendantOrSpouse,
  isDescendantOrAscendant,
  isHoldingCompany,
  isInheritanceTaxableAsset,
  isParentToLegitimateChild,
  isPersonalCollection,
  isRealEstate,
  maritalEstateFactor,
  resolveGiftBucket,
  worseStatus,
  type CalcStatus,
  type GiftBucket,
  type MovableSecurityKind,
  type OwnershipStatus,
  type ReceiverRelationOption,
  type ReceiverTaxClass,
} from "@/lib/tax-engine/classify";

export type {
  CalcStatus,
  GiftBucket,
  MovableSecurityKind,
  OwnershipStatus,
  ReceiverRelationOption,
  ReceiverTaxClass,
};
export {
  classifyMovableSecurity,
  classifyReceiverRelation,
  toReceiverRelation,
  isInheritanceTaxableAsset,
  isRealEstate,
};

export type CostLine = {
  label: string;
  amount: number;
  kind: "fee" | "tax" | "duty" | "credit";
  note?: string;
  code?: string;
  formula?: string;
  legalRef?: string;
  base?: number;
  rate?: number;
  payer?: string;
  isCredit?: boolean;
};

export type TransferCostInput = {
  method: TransferMethod;
  transferValue: number;
  assessedValue: number;
  costBasis: number;
  acquiredYear?: string;
  transactionYear?: string;
  acquisitionMethod?: string;
  assetCategory?: string;
  assetSubtype?: string;
  ownerIsJuristic?: boolean;
  receivers?: { name: string; share: number; taxClass?: ReceiverTaxClass; occasion?: GiftBucket }[];
  giftDurationYears?: number;
  omitInheritanceTax?: boolean;
  omitGiftTax?: boolean;
  /** ยอดสังหาริมทรัพย์ญาติของผู้รับในปีนี้ก่อนรายการนี้ */
  priorRelatedGiftTotal?: number;
  /** ยอดสังหาริมทรัพย์บุคคลอื่น (ธรรมจรรยา/ประเพณี) ก่อนรายการนี้ */
  priorCustomaryGiftTotal?: number;
  /** ยอดอสังหา ม.42(26) ของผู้รับคนนั้นในปีนี้ก่อนรายการนี้ (ใช้เมื่อมีผู้รับคนเดียว) */
  priorImmovableGiftTotal?: number;
  giftOccasion?: GiftBucket;
  transferorId?: string;
  decedentId?: string;
  ownershipStatus?: OwnershipStatus | string;
  houseRegistered?: boolean;
  saleChannel?: "exchange" | "otc";
  buyerIsJuristic?: boolean;
  paidUpValue?: number;
  entityOwned?: boolean;
};

export type TransferCostResult = {
  lines: CostLine[];
  fees: number;
  tax: number;
  credits: number;
  total: number;
  status: CalcStatus;
  warnings: string[];
};

const BAHT = (n: number) => Math.max(0, Math.round(n));

export const RELATED_GIFT_EXEMPT = 20_000_000;
export const CUSTOMARY_GIFT_EXEMPT = 10_000_000;
export const IMMOVABLE_GIFT_EXEMPT = 20_000_000;
export const INHERIT_EXEMPT = 100_000_000;
const CIT_RATE = 0.2;
const GIFT_RATE = 0.05;

export function parseGiftDurationYears(yearLabel?: string): number | null {
  if (!yearLabel) return null;
  const trimmed = yearLabel.trim();
  const durationMatch = trimmed.match(/\((\d+)\s*ปี\)/);
  if (durationMatch) {
    const n = Number(durationMatch[1]);
    if (n >= 1 && n <= 30) return n;
  }
  const rangeMatch = trimmed.match(/^(\d{4})\s*[-–—]\s*(\d{4})/);
  if (rangeMatch) {
    const n = Number(rangeMatch[2]) - Number(rangeMatch[1]) + 1;
    if (n >= 1 && n <= 30) return n;
  }
  return null;
}

export function resolveGiftDurationYears(input: {
  method?: TransferMethod;
  giftDurationYears?: number;
  transactionYear?: string;
}): number {
  if (
    input.giftDurationYears != null &&
    Number.isFinite(input.giftDurationYears) &&
    input.giftDurationYears >= 1
  ) {
    return Math.min(30, Math.floor(input.giftDurationYears));
  }
  const fromLabel = parseGiftDurationYears(input.transactionYear);
  if (fromLabel) return fromLabel;
  return 1;
}

const LUMP_SUM_EXPENSE_RATE: Record<number, number> = {
  1: 0.92,
  2: 0.84,
  3: 0.77,
  4: 0.71,
  5: 0.65,
  6: 0.6,
  7: 0.55,
  8: 0.5,
  9: 0.5,
  10: 0.5,
};

const PIT_BRACKETS: { upTo: number; rate: number }[] = [
  { upTo: 300_000, rate: 0.05 },
  { upTo: 500_000, rate: 0.1 },
  { upTo: 750_000, rate: 0.15 },
  { upTo: 1_000_000, rate: 0.2 },
  { upTo: 2_000_000, rate: 0.25 },
  { upTo: 5_000_000, rate: 0.3 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.35 },
];

export function flatEstimatePitRate(assessedBaht: number): number | null {
  const m = assessedBaht / 1_000_000;
  if (m <= 6) return 0.025;
  if (m >= 10 && m < 20) return 0.035;
  if (m >= 20 && m < 30) return 0.0625;
  if (m >= 30 && m < 40) return 0.0825;
  if (m >= 40 && m < 50) return 0.095;
  if (m >= 50 && m < 60) return 0.105;
  if (m >= 60 && m < 70) return 0.1125;
  if (m >= 70 && m < 80) return 0.12;
  if (m >= 80 && m < 90) return 0.125;
  if (m >= 90 && m <= 100) return 0.1275;
  if (m > 500) return 0.17;
  return null;
}

function parseYear(raw?: string): number | null {
  if (!raw) return null;
  const m = /(\d{4})/.exec(raw.trim());
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 2400 && y <= 2800 ? y : null;
}

/** ปีถือครอง PIT = ปีโอน − ปีได้มา + 1 · ไม่เกิน 10 · เศษปีนับเป็นหนึ่งปี */
export function pitHeldYears(acquired?: string, transaction?: string): number | null {
  const a = parseYear(acquired);
  const t = parseYear(transaction);
  if (a == null || t == null) return null;
  return Math.min(10, Math.max(1, t - a + 1));
}

/**
 * SBT นับวันถึงวัน เกณฑ์ห้าปี — ถ้ามีแค่ปีปฏิทิน:
 * ส่วนต่าง ≥ 6 ปี ถือว่าเกิน 5 ปี, ≤ 4 ปี ถือว่าไม่เกิน, = 5 ปี ต้องมีวันที่
 */
export function sbtLikelyOn(acquired?: string, transaction?: string): {
  sbtOn: boolean | null;
  status: CalcStatus;
  note: string;
} {
  const a = parseYear(acquired);
  const t = parseYear(transaction);
  if (a == null || t == null) {
    return {
      sbtOn: true,
      status: "Missing Data",
      note: "ไม่มีวันได้มา/วันโอน — ประมาณการว่าถือครองไม่เกิน 5 ปี",
    };
  }
  const diff = t - a;
  if (diff >= 6) {
    return { sbtOn: false, status: "Estimated", note: `ถือครองประมาณ ${diff} ปี (≥ 5 ปี)` };
  }
  if (diff <= 4) {
    return { sbtOn: true, status: "Estimated", note: `ถือครองประมาณ ${diff} ปี (< 5 ปี)` };
  }
  return {
    sbtOn: null,
    status: "Missing Data",
    note: "ส่วนต่าง 5 ปีปฏิทิน — ต้องนับวันถึงวันจึงจะตัดสิน SBT ได้",
  };
}

export function progressivePit(income: number): number {
  let rem = Math.max(0, income);
  let tax = 0;
  let prev = 0;
  for (const { upTo, rate } of PIT_BRACKETS) {
    const slice = Math.min(rem, upTo - prev);
    if (slice <= 0) break;
    tax += slice * rate;
    rem -= slice;
    prev = upTo;
    if (rem <= 0) break;
  }
  return tax;
}

function isGiftOrInheritanceAcquisition(method?: string): boolean {
  if (!method) return false;
  const m = method.trim();
  return /มรดก|ให้|เสน่หา/.test(m) && !/ซื้อ/.test(m);
}

export function incrementalTax(
  priorTotal: number,
  addition: number,
  exempt: number,
  rate: number,
): { taxBefore: number; taxAfter: number; incremental: number; newTotal: number } {
  const newTotal = priorTotal + addition;
  const taxBefore = Math.max(0, priorTotal - exempt) * rate;
  const taxAfter = Math.max(0, newTotal - exempt) * rate;
  return {
    taxBefore,
    taxAfter,
    incremental: Math.max(0, taxAfter - taxBefore),
    newTotal,
  };
}

function individualSaleWithholdingTax(
  assessed: number,
  years: number | null,
  acquisitionMethod?: string,
): { amount: number; note: string; status: CalcStatus } {
  const status: CalcStatus = years == null ? "Missing Data" : "Estimated";
  const y = years == null ? 8 : Math.min(10, Math.max(1, years));
  const giftOrInheritance = isGiftOrInheritanceAcquisition(acquisitionMethod);
  const expenseRate = giftOrInheritance ? 0.5 : (LUMP_SUM_EXPENSE_RATE[y] ?? 0.5);
  const afterExpense = assessed * (1 - expenseRate);
  const avg = afterExpense / y;
  const amount = BAHT(progressivePit(avg) * y);
  const note = giftOrInheritance
    ? `หักค่าใช้จ่าย 50% (มรดก/ให้) · ถือครอง ${y} ปี · ฐานราคาประเมิน · ไม่ยกเว้น 150,000`
    : `หักค่าใช้จ่ายเหมา ${(expenseRate * 100).toFixed(0)}% · ถือครอง ${y} ปี · ฐานราคาประเมิน`;
  return { amount, note, status };
}

function feeBase(input: TransferCostInput) {
  return input.assessedValue > 0 ? input.assessedValue : input.transferValue;
}

function valueBase(input: TransferCostInput) {
  return input.transferValue > 0 ? input.transferValue : feeBase(input);
}

function sbtStampBase(input: TransferCostInput) {
  return Math.max(input.transferValue, feeBase(input));
}

export function stampDutyBaht(base: number): number {
  if (base <= 0) return 0;
  return Math.ceil(base / 200) * 1;
}

export function shareStampBaht(base: number): number {
  if (base <= 0) return 0;
  return Math.ceil(base / 1000) * 1;
}

function isShareStampAsset(category?: string, subtype?: string): boolean {
  const kind = classifyMovableSecurity(category, subtype);
  return kind === "หุ้นนอกตลาด" || isHoldingCompany(category, subtype);
}

/** อากรแสตมป์โอนหุ้น บจก. / Holding — แยกจาก PIT/Gift Tax */
export function shareTransferStampLine(input: {
  assetCategory?: string;
  assetSubtype?: string;
  transferValue: number;
  assessedValue?: number;
  paidUpValue?: number;
}): CostLine | null {
  if (!isShareStampAsset(input.assetCategory, input.assetSubtype)) return null;
  const instrument = input.transferValue > 0 ? input.transferValue : (input.assessedValue ?? 0);
  const stampBase = Math.max(instrument, input.paidUpValue ?? 0);
  if (stampBase <= 0) return null;
  return {
    label: "อากรแสตมป์โอนหุ้น (0.1%)",
    amount: shareStampBaht(stampBase),
    kind: "duty",
    note: "ceil(max(ราคาตามตราสาร, มูลค่าหุ้นที่ชำระแล้ว) ÷ 1,000) × 1 บาท",
    formula: "CEIL(MAX(ราคาตามตราสาร, มูลค่าชำระแล้ว) / 1,000) × 1",
    legalRef: "บัญชีอัตราอากรแสตมป์",
  };
}

type ReceiverSlice = {
  name?: string;
  taxClass: ReceiverTaxClass;
  portion: number;
  occasion?: GiftBucket;
};

function receiverSlices(input: TransferCostInput, totalValue: number): ReceiverSlice[] {
  const list = input.receivers?.filter((r) => r.share > 0) ?? [];
  if (list.length === 0) {
    return [{ taxClass: "คนอื่น", portion: totalValue }];
  }
  const sumShare = list.reduce((s, r) => s + r.share, 0) || 1;
  return list.map((r) => ({
    name: r.name,
    taxClass: r.taxClass ?? "คนอื่น",
    portion: (totalValue * r.share) / sumShare,
    occasion: r.occasion ?? input.giftOccasion,
  }));
}

function receiverAccumKey(s: ReceiverSlice, index: number): string {
  const name = s.name?.trim();
  return name || `__slice_${index}`;
}

/** วงเงินยกเว้นภาษีการให้คิดต่อผู้รับต่อปีภาษี แล้วค่อยคูณ 5% ที่ส่วนเกิน */
function giftTaxPerReceiver(opts: {
  slices: ReceiverSlice[];
  years: number;
  perYear: number;
  exempt: number;
  include: (s: ReceiverSlice) => boolean;
  seedPrior?: number;
}): number {
  const matched = opts.slices
    .map((s, i) => (opts.include(s) ? i : -1))
    .filter((i) => i >= 0);

  let tax = 0;
  for (let y = 0; y < opts.years; y++) {
    const yearPriors = new Map<string, number>();
    if (y === 0 && matched.length === 1 && (opts.seedPrior ?? 0) > 0) {
      const i = matched[0]!;
      yearPriors.set(receiverAccumKey(opts.slices[i]!, i), opts.seedPrior ?? 0);
    }
    for (const i of matched) {
      const s = opts.slices[i]!;
      const key = receiverAccumKey(s, i);
      const prior = yearPriors.get(key) ?? 0;
      const yearly = s.portion * opts.perYear;
      const inc = incrementalTax(prior, yearly, opts.exempt, GIFT_RATE);
      tax += inc.incremental;
      yearPriors.set(key, inc.newTotal);
    }
  }
  return tax;
}

export function inheritanceTaxRate(taxClass: ReceiverTaxClass): number {
  if (taxClass === "คู่สมรส") return 0;
  if (isDescendantOrAscendant(taxClass)) return 0.05;
  return 0.1;
}

export function inheritanceTaxOnPortion(
  portion: number,
  taxClass: ReceiverTaxClass,
  exempt = INHERIT_EXEMPT,
): number {
  const rate = inheritanceTaxRate(taxClass);
  if (rate <= 0) return 0;
  return Math.max(0, portion - exempt) * rate;
}

function sbtAndStampLines(
  base: number,
  sbt: { sbtOn: boolean | null; status: CalcStatus; note: string },
  extras?: { forceExemptSbt?: boolean; forceExemptStamp?: boolean },
): { lines: CostLine[]; status: CalcStatus } {
  if (extras?.forceExemptSbt && extras?.forceExemptStamp) {
    return {
      lines: [
        {
          label: "ภาษีธุรกิจเฉพาะ (3.3%)",
          amount: 0,
          kind: "tax",
          note: "ยกเว้นตามเงื่อนไขที่ตรวจแล้ว",
          legalRef: "ภาษีธุรกิจเฉพาะจากการขายอสังหาริมทรัพย์",
        },
        {
          label: "อากรแสตมป์",
          amount: 0,
          kind: "duty",
          note: "ไม่เสียเมื่อยกเว้นทั้ง SBT และไม่มีค่าตอบแทน",
        },
      ],
      status: "Estimated",
    };
  }

  const sbtOn = extras?.forceExemptSbt ? false : sbt.sbtOn !== false && sbt.sbtOn !== null
    ? true
    : sbt.sbtOn === false
      ? false
      : true;
  const uncertain = sbt.sbtOn === null && !extras?.forceExemptSbt;
  const stampOn = !extras?.forceExemptStamp && !sbtOn;
  const sbtAmt = sbtOn || uncertain ? BAHT(base * 0.033) : 0;
  const stampAmt = stampOn ? stampDutyBaht(base) : 0;

  return {
    lines: [
      {
        label: "ภาษีธุรกิจเฉพาะ (3.3%)",
        amount: uncertain ? 0 : sbtAmt,
        kind: "tax",
        note: uncertain
          ? `${sbt.note} · ยังไม่ยืนยันตัวเลข`
          : sbtOn
            ? `${sbt.note} · max(ราคาขาย, ราคาประเมิน) × 3.3%`
            : extras?.forceExemptSbt
              ? "ยกเว้น"
              : `ยกเว้น · ${sbt.note}`,
        formula: "max(ราคาขาย, ราคาประเมิน) × 3.3%",
        legalRef: "ภาษีธุรกิจเฉพาะจากการขายอสังหาริมทรัพย์",
        base,
        rate: 0.033,
      },
      {
        label: "อากรแสตมป์",
        amount: stampAmt,
        kind: "duty",
        note: stampOn
          ? "ceil(ฐาน ÷ 200) × 1 บาท · ไม่เสียเมื่อเสีย SBT"
          : sbtOn || uncertain
            ? "ไม่เสียเมื่อเสียภาษีธุรกิจเฉพาะ"
            : "ยกเว้น",
        formula: "ceil(max(ขาย, ประเมิน) / 200) × 1",
        legalRef: "อากรแสตมป์จากการโอนอสังหาริมทรัพย์",
        base,
      },
    ],
    status: extras?.forceExemptSbt ? "Estimated" : sbt.status,
  };
}

function realEstateGiftCosts(
  input: TransferCostInput,
  ctx: { status: CalcStatus; warnings: string[] },
): CostLine[] {
  const assessed = feeBase(input);
  const slices = receiverSlices(input, assessed);
  const years = resolveGiftDurationYears(input);
  const perYear = years > 1 ? 1 / years : 1;

  let gift42Tax = 0;
  let generalReTax = 0;
  let familyFee = 0;
  let otherFee = 0;
  let parentToChild = 0;
  let otherFamily = 0;
  let otherPeople = 0;

  if (!input.omitGiftTax) {
    gift42Tax = giftTaxPerReceiver({
      slices,
      years,
      perYear,
      exempt: IMMOVABLE_GIFT_EXEMPT,
      include: (s) => isParentToLegitimateChild(s.taxClass),
      seedPrior: input.priorImmovableGiftTotal,
    });
  }

  for (const s of slices) {
    if (isAscendantOrDescendantOrSpouse(s.taxClass)) {
      familyFee += s.portion * 0.005;
    } else {
      otherFee += s.portion * 0.02;
    }

    if (isParentToLegitimateChild(s.taxClass)) {
      parentToChild += 1;
    } else {
      if (isAscendantOrDescendantOrSpouse(s.taxClass)) otherFamily += 1;
      else otherPeople += 1;
      const pitYears = pitHeldYears(input.acquiredYear, input.transactionYear);
      const wht = individualSaleWithholdingTax(
        s.portion * perYear,
        pitYears,
        input.acquisitionMethod ?? "ได้รับให้โดยเสน่หา",
      );
      generalReTax += wht.amount * years;
      ctx.status = worseStatus(ctx.status, "Review Required");
      ctx.warnings.push(
        `อสังหาให้ ${s.taxClass} ไม่ใช้สิทธิ 20 ล้านบาท — ส่งเข้าสูตรโอนอสังหาทั่วไป ไม่ใช่ Gift Tax 5%`,
      );
    }
  }

  const sbtExempt = parentToChild > 0 && otherFamily === 0 && otherPeople === 0;
  if (!sbtExempt) {
    ctx.status = worseStatus(ctx.status, "Review Required");
    ctx.warnings.push(
      "SBT ของการให้อสังหาไม่ยกเว้นอัตโนมัติ ต้องตรวจความสัมพันธ์และเงื่อนไขของทรัพย์ก่อน",
    );
  }

  const sbt = sbtAndStampLines(assessed, sbtLikelyOn(input.acquiredYear, input.transactionYear), {
    forceExemptSbt: sbtExempt,
  });
  ctx.status = worseStatus(ctx.status, sbt.status);

  const lines: CostLine[] = [
    {
      label: familyFee && !otherFee ? "ค่าธรรมเนียมการโอน (0.5%)" : otherFee && !familyFee ? "ค่าธรรมเนียมการโอน (2%)" : "ค่าธรรมเนียมการโอน",
      amount: BAHT(familyFee + otherFee),
      kind: "fee",
      note: familyFee && !otherFee
        ? "บุพการี/ผู้สืบสันดาน/คู่สมรส · ราคาประเมิน × 0.5%"
        : otherFee && !familyFee
          ? "บุคคลอื่น · ราคาประเมิน × 2%"
          : "ผสมผู้รับ · ญาติ 0.5% / คนอื่น 2%",
      payer: "ผู้โอน",
      legalRef: "ค่าธรรมเนียม ภาษี และอากรเกี่ยวกับอสังหาริมทรัพย์ของกรมที่ดิน",
    },
    {
      label: "ภาษีเงินได้จากการให้",
      amount: BAHT(input.omitGiftTax ? 0 : gift42Tax),
      kind: "tax",
      note: input.omitGiftTax
        ? "คำนวณรวมระดับแผน · ผู้โอน+ผู้รับ+ปีภาษี · ม.42(26)"
        : `บิดามารดาให้บุตรชอบด้วยกฎหมาย · ฐานหารตามจำนวนผู้รับและจำนวนปี (${years} ปี) · ยกเว้น ${IMMOVABLE_GIFT_EXEMPT / 1e6} ลบ./คน/ปี แล้วคูณส่วนเกิน 5%`,
      payer: "ผู้โอน",
      legalRef: "พ.ร.บ.แก้ไขเพิ่มเติมประมวลรัษฎากร ฉบับที่ 40 พ.ศ. 2558 ม.42(26)",
    },
  ];
  if (generalReTax > 0 || otherFamily > 0 || otherPeople > 0) {
    lines.push({
      label: "ภาษีเงินได้จากการโอนอสังหาริมทรัพย์",
      amount: BAHT(generalReTax),
      kind: "tax",
      note: "ไม่ใช้วงเงิน 20 ล้านบาท · ใช้สูตรโอนอสังหาทั่วไป (ราคาประเมิน วิธีได้มา ปีถือครอง ค่าใช้จ่ายเหมา)",
      payer: "ผู้โอน",
      code: "GENERAL_REAL_ESTATE_TRANSFER",
      legalRef: "ภาษีที่เกี่ยวข้องกับการโอนอสังหาริมทรัพย์ของกรมสรรพากร",
    });
  }
  lines.push(...sbt.lines);
  return lines;
}

function realEstateSaleIndividualCosts(
  input: TransferCostInput,
  ctx: { status: CalcStatus; warnings: string[] },
): CostLine[] {
  const assessed = feeBase(input);
  const years = pitHeldYears(input.acquiredYear, input.transactionYear);
  if (years == null) {
    ctx.status = worseStatus(ctx.status, "Missing Data");
    ctx.warnings.push("ขาดปีได้มาหรือปีโอน — ปีถือครอง PIT ยังไม่ยืนยัน");
  }
  const wht = individualSaleWithholdingTax(assessed, years, input.acquisitionMethod);
  ctx.status = worseStatus(ctx.status, wht.status);

  const acquiredByInherit = isGiftOrInheritanceAcquisition(input.acquisitionMethod);
  const sbtInfo = sbtLikelyOn(input.acquiredYear, input.transactionYear);
  const forceExemptSbt = acquiredByInherit || Boolean(input.houseRegistered);
  if (input.houseRegistered) {
    ctx.warnings.push("ใช้ข้อยกเว้นที่อยู่อาศัยหลัก — ตรวจชื่อในทะเบียนบ้านอย่างน้อย 1 ปี");
  }
  const sbt = sbtAndStampLines(sbtStampBase(input), sbtInfo, {
    forceExemptSbt,
  });
  ctx.status = worseStatus(ctx.status, sbt.status);
  if (input.transferValue > 0 && input.assessedValue > 0 && input.transferValue < input.assessedValue) {
    ctx.warnings.push("ราคาขายต่ำกว่าราคาประเมิน — ตรวจราคาตลาดและเหตุผลทางธุรกิจ");
    ctx.status = worseStatus(ctx.status, "Review Required");
  }

  return [
    {
      label: "ค่าธรรมเนียมการโอน (2%)",
      amount: BAHT(assessed * 0.02),
      kind: "fee",
      note: "ราคาประเมิน × 2%",
      legalRef: "กรมที่ดิน",
    },
    {
      label: "ภาษีเงินได้หัก ณ ที่จ่าย",
      amount: wht.amount,
      kind: "tax",
      note: `${wht.note} · นับปีปฏิทินแยกจาก SBT`,
      legalRef: "ภาษีที่เกี่ยวข้องกับการขายอสังหาริมทรัพย์ของกรมสรรพากร",
    },
    ...sbt.lines,
  ];
}

function realEstateSaleJuristicCosts(
  input: TransferCostInput,
  ctx: { status: CalcStatus; warnings: string[] },
): CostLine[] {
  const assessed = feeBase(input);
  const sale = input.transferValue;
  const dutyBase = Math.max(sale, assessed);
  const profit = Math.max(0, dutyBase - input.costBasis);
  const wht = BAHT(dutyBase * 0.01);
  const cit = BAHT(profit * CIT_RATE);
  const citPayable = Math.max(0, cit - wht);
  if (sale > 0 && assessed > 0 && sale < assessed) {
    ctx.warnings.push("ราคาขายต่ำกว่าราคาประเมินระหว่างบุคคลเกี่ยวข้อง — ต้องมีเหตุผลทางธุรกิจ");
    ctx.status = worseStatus(ctx.status, "Review Required");
  }

  return [
    {
      label: "ค่าธรรมเนียมการโอน (2%)",
      amount: BAHT(assessed * 0.02),
      kind: "fee",
      note: "ราคาประเมิน × 2%",
    },
    {
      label: "ภาษีเงินได้หัก ณ ที่จ่าย (1%)",
      amount: wht,
      kind: "credit",
      isCredit: true,
      note: "max(ราคาขาย, ราคาประเมิน) × 1% · เป็นเครดิตของ CIT ไม่ใช่ภาษีสุดท้าย",
      payer: "ผู้ซื้อหักนำส่ง",
      legalRef: "ภาษีหัก ณ ที่จ่ายเมื่อบริษัทขายอสังหาริมทรัพย์",
    },
    {
      label: "ภาษีธุรกิจเฉพาะ (3.3%)",
      amount: BAHT(dutyBase * 0.033),
      kind: "tax",
      note: "max(ราคาขาย, ราคาประเมิน) × 3.3%",
    },
    {
      label: "อากรแสตมป์",
      amount: 0,
      kind: "duty",
      note: "ไม่เสียเมื่อเสียภาษีธุรกิจเฉพาะ",
    },
    {
      label: "ภาษีเงินได้นิติบุคคล (หลังเครดิต WHT)",
      amount: citPayable,
      kind: "tax",
      note: `กำไรสุทธิประมาณ × 20% = ${cit.toLocaleString("th-TH")} − เครดิต WHT ${wht.toLocaleString("th-TH")}`,
      legalRef: "WHT เป็นเครดิตของ CIT",
    },
  ];
}

function realEstateInheritanceCosts(
  input: TransferCostInput,
  ctx: { status: CalcStatus; warnings: string[] },
): CostLine[] {
  const assessed = feeBase(input) * maritalEstateFactor(input.ownershipStatus);
  const slices = receiverSlices(input, assessed);
  const omitTax = Boolean(input.omitInheritanceTax);
  const taxable = isInheritanceTaxableAsset(input.assetCategory, input.assetSubtype);

  let fee = 0;
  let inheritTax = 0;

  if (input.entityOwned) {
    ctx.warnings.push("ทรัพย์ที่บริษัทถือไม่ใช่มรดกของบุคคล — มรดกคือหุ้นของบริษัท");
    ctx.status = worseStatus(ctx.status, "Review Required");
  }
  if (input.ownershipStatus === "สินสมรส") {
    ctx.warnings.push("แยกส่วนคู่สมรสออกจากกองมรดกแล้ว (ประมาณ 50%)");
  }

  for (const s of slices) {
    fee += s.portion * 0.005;
    if (!omitTax && taxable && !input.entityOwned) {
      inheritTax += inheritanceTaxOnPortion(s.portion, s.taxClass);
    }
  }

  if (!taxable) {
    ctx.warnings.push("รายการนี้อยู่ในบัญชีกองมรดก แต่ไม่เข้าฐานภาษีมรดกอัตโนมัติ");
  }

  return [
    {
      label: "ค่าธรรมเนียมการโอน (0.5%)",
      amount: BAHT(input.entityOwned ? 0 : fee),
      kind: "fee",
      note: "ราคาประเมิน × 0.5% — คู่สมรสยกเว้นภาษีมรดกแต่ค่าจดทะเบียนยังคิด",
      legalRef: "กรมที่ดิน",
    },
    {
      label: "ภาษีการรับมรดก",
      amount: BAHT(omitTax || !taxable || input.entityOwned ? 0 : inheritTax),
      kind: "tax",
      note: omitTax
        ? `คำนวณรวมระดับแผน · ผู้รับ+เจ้ามรดก · ยกเว้น ${INHERIT_EXEMPT / 1e6} ลบ.`
        : !taxable
          ? "ไม่เข้าฐานภาษีมรดกตามทรัพย์ห้ากลุ่ม"
          : `ยกเว้น ${INHERIT_EXEMPT / 1e6} ลบ./ผู้รับ/เจ้ามรดก · ทายาท 5% / คนอื่น 10% · คู่สมรส 0`,
      legalRef: "พ.ร.บ.ภาษีการรับมรดก พ.ศ. 2558",
    },
    {
      label: "ภาษีธุรกิจเฉพาะ (3.3%)",
      amount: 0,
      kind: "tax",
      note: "ยกเว้น (โอนมรดก)",
    },
    {
      label: "อากรแสตมป์",
      amount: 0,
      kind: "duty",
      note: "ยกเว้น (โอนมรดก)",
    },
  ];
}

function movableGiftCosts(
  input: TransferCostInput,
  ctx: { status: CalcStatus; warnings: string[] },
): CostLine[] {
  const value = valueBase(input);
  const slices = receiverSlices(input, value);
  const years = resolveGiftDurationYears(input);
  const perYear = years > 1 ? 1 / years : 1;

  const stamp = shareTransferStampLine(input);

  if (input.omitGiftTax) {
    return [
      {
        label: "ภาษีเงินได้จากการให้",
        amount: 0,
        kind: "tax",
        note: "คำนวณรวมระดับแผน · สะสมผู้รับ+ปีภาษี · วงเงิน 20/10 ลบ. ไม่ใช่รายทรัพย์",
        payer: "ผู้รับ",
        legalRef: "ม.42(27) (28)",
      },
      ...(stamp ? [stamp] : []),
    ];
  }

  const tax =
    giftTaxPerReceiver({
      slices,
      years,
      perYear,
      exempt: RELATED_GIFT_EXEMPT,
      include: (s) =>
        resolveGiftBucket({ taxClass: s.taxClass, occasion: s.occasion }) ===
        "related",
      seedPrior: input.priorRelatedGiftTotal,
    }) +
    giftTaxPerReceiver({
      slices,
      years,
      perYear,
      exempt: CUSTOMARY_GIFT_EXEMPT,
      include: (s) =>
        resolveGiftBucket({ taxClass: s.taxClass, occasion: s.occasion }) ===
        "customary",
      seedPrior: input.priorCustomaryGiftTotal,
    });

  for (const s of slices) {
    const bucket = resolveGiftBucket({ taxClass: s.taxClass, occasion: s.occasion });
    if (bucket === "none") {
      ctx.status = worseStatus(ctx.status, "Review Required");
      ctx.warnings.push(
        `การให้แก่ ${s.name || "บุคคลอื่น"} ไม่มีหลักฐานธรรมจรรยา/พิธี/ประเพณี — ห้ามใช้วงเงิน 10 ลบ. อัตโนมัติ`,
      );
    }
  }

  return [
    {
      label: "ภาษีเงินได้จากการให้",
      amount: BAHT(tax),
      kind: "tax",
      note: "ผู้รับเป็นผู้เสียภาษี · ยกเว้น 20 ลบ./คน/ปี (ญาติ) หรือ 10 ลบ./คน/ปี (บุคคลอื่นตามเงื่อนไข) แล้วคูณส่วนเกิน 5%",
      payer: "ผู้รับ",
      legalRef: "พ.ร.บ.แก้ไขเพิ่มเติมประมวลรัษฎากร ฉบับที่ 40 พ.ศ. 2558 ม.42(27)(28)",
    },
    ...(stamp ? [stamp] : []),
  ];
}

function movableInheritanceCosts(
  input: TransferCostInput,
  ctx: { status: CalcStatus; warnings: string[] },
): CostLine[] {
  const factor = maritalEstateFactor(input.ownershipStatus);
  const value = valueBase(input) * factor;
  const slices = receiverSlices(input, value);
  const omitTax = Boolean(input.omitInheritanceTax);
  const taxable = isInheritanceTaxableAsset(input.assetCategory, input.assetSubtype);
  const holding = isHoldingCompany(input.assetCategory, input.assetSubtype);

  if (input.entityOwned) {
    ctx.warnings.push("ห้ามนับทรัพย์ที่บริษัทถือซ้ำกับหุ้นบริษัท");
    ctx.status = worseStatus(ctx.status, "Review Required");
  }
  if (holding) {
    ctx.warnings.push("หุ้น Holding ต้องใช้กฎประเมิน look-through — ให้ผู้เชี่ยวชาญตรวจ");
    ctx.status = worseStatus(ctx.status, "Review Required");
  }
  if (!taxable) {
    ctx.warnings.push("อยู่ในบัญชีแบ่งทรัพย์ แต่ไม่นำเข้าฐานภาษีมรดกอัตโนมัติ");
  }

  let tax = 0;
  if (!omitTax && taxable && !input.entityOwned) {
    for (const s of slices) {
      if (s.taxClass === "คู่สมรส") continue;
      tax += inheritanceTaxOnPortion(s.portion, s.taxClass);
    }
  }

  return [
    {
      label: "ภาษีการรับมรดก",
      amount: BAHT(tax),
      kind: "tax",
      note: omitTax
        ? `คำนวณรวมระดับแผน · ผู้รับ+เจ้ามรดก · ยกเว้น ${INHERIT_EXEMPT / 1e6} ลบ.`
        : !taxable
          ? "ไม่เข้าฐานภาษีมรดกตามทรัพย์ห้ากลุ่ม"
          : `คู่สมรสยกเว้นภาษี · ทายาท 5% / คนอื่น 10% หลัง ${INHERIT_EXEMPT / 1e6} ลบ./เจ้ามรดก`,
      legalRef: "พ.ร.บ.ภาษีการรับมรดก พ.ศ. 2558",
    },
  ];
}

function movableSaleCosts(
  input: TransferCostInput,
  ctx: { status: CalcStatus; warnings: string[] },
): CostLine[] {
  const kind = classifyMovableSecurity(input.assetCategory, input.assetSubtype);
  const sale = valueBase(input);
  const gain = Math.max(0, sale - input.costBasis);

  if (kind === "เงินฝาก") {
    ctx.warnings.push("การถอนหรือโอนเงินฝากของตนไม่ใช่การขาย — ดอกเบี้ยเป็นฐานภาษีอีกประเภท");
    return [
      {
        label: "ภาษีเงินได้จากการขาย",
        amount: 0,
        kind: "tax",
        note: "เงินฝากไม่ใช่การขายทรัพย์",
      },
    ];
  }

  if (kind === "หุ้นในตลาด") {
    if (input.saleChannel === "otc") {
      ctx.status = worseStatus(ctx.status, "Review Required");
      ctx.warnings.push("หุ้น SET โอนนอกตลาด — ห้ามยกเว้น PIT อัตโนมัติ");
      return [
        {
          label: "ภาษีเงินได้บุคคล (กำไรจากการขาย)",
          amount: BAHT(progressivePit(gain)),
          kind: "tax",
          note: "โอนนอกตลาด · ประมาณการจากกำไร (ต้องตรวจช่องทาง)",
        },
      ];
    }
    return [
      {
        label: "ภาษีเงินได้บุคคล",
        amount: 0,
        kind: "tax",
        note: "ขายใน SET · โดยหลักยกเว้น PIT (ไม่รวมหุ้นกู้/พันธบัตร)",
        legalRef: "กฎกระทรวง ฉบับที่ 126",
      },
    ];
  }

  if (kind === "กองทุน") {
    ctx.status = worseStatus(ctx.status, "Estimated");
    return [
      {
        label: "ภาษีเงินได้บุคคล",
        amount: 0,
        kind: "tax",
        note: "กองทุนรวมทั่วไปโดยหลักยกเว้น — กองทุนลดหย่อนต้องตรวจระยะถือครอง",
      },
    ];
  }

  if (kind === "ตราสารหนี้") {
    const wht = BAHT(gain * 0.15);
    return [
      {
        label: "ภาษีหัก ณ ที่จ่าย (15%)",
        amount: wht,
        kind: "tax",
        note: "กำไรจากการโอนพันธบัตร/หุ้นกู้โดยทั่วไปถูกหัก 15% — แยกดอกเบี้ยและส่วนลด",
      },
    ];
  }

  if (kind === "ทรัพย์สะสม") {
    ctx.status = worseStatus(ctx.status, "Review Required");
    ctx.warnings.push(
      "ทอง/พระ/งานศิลปะอาจยกเว้น ม.42(9) ถ้าเป็นของสะสมส่วนตัว — ห้ามใช้ชื่อทรัพย์จำแนกอย่างเดียว",
    );
    return [
      {
        label: "ภาษีเงินได้บุคคล",
        amount: 0,
        kind: "tax",
        note: "สมมติเป็นทรัพย์สะสมส่วนตัวที่ไม่ได้มุ่งค้า — หากซื้อขายเป็นปกติให้คิดเป็นเงินได้ธุรกิจ",
        legalRef: "ม.42(9) / ข้อหารือกรณีขายทรัพย์สะสม",
      },
    ];
  }

  if (kind === "สินทรัพย์ดิจิทัล") {
    ctx.status = worseStatus(ctx.status, "Missing Data");
    ctx.warnings.push("ต้องเก็บ platform license และวันโอนก่อนเลือกกฎ (ยกเว้น 2568–2572 ผ่านผู้ประกอบการที่ได้รับอนุญาต)");
    return [
      {
        label: "ภาษีเงินได้บุคคล (กำไรจากการขาย)",
        amount: BAHT(progressivePit(gain)),
        kind: "tax",
        note: "ราคาขาย − ต้นทุน · ยังไม่ยืนยันช่องทางที่ได้รับอนุญาต",
      },
    ];
  }

  const lines: CostLine[] = [
    {
      label: "ภาษีเงินได้บุคคล (กำไรจากการขาย)",
      amount: BAHT(progressivePit(gain)),
      kind: "tax",
      note:
        kind === "หุ้นนอกตลาด"
          ? "ม.40(4)(ช) กำไร = ราคาขาย − ต้นทุน · ประมาณ PIT จากกำไรนี้เดี่ยว (ยังไม่รวมเงินได้อื่น)"
          : "ประมาณการจากกำไร × อัตราก้าวหน้า",
    },
  ];

  if (kind === "หุ้นนอกตลาด") {
    if (input.costBasis <= 0) {
      ctx.status = worseStatus(ctx.status, "Missing Data");
      ctx.warnings.push("ขาดต้นทุนหุ้น — ยังคำนวณกำไรไม่ยืนยัน");
    }
    ctx.status = worseStatus(ctx.status, "Review Required");
    const stamp = shareTransferStampLine(input);
    if (stamp) lines.push(stamp);
    if (input.buyerIsJuristic) {
      ctx.warnings.push("ผู้ซื้อเป็นนิติบุคคล — ตรวจหน้าที่หักภาษี ณ ที่จ่าย");
    }
  }

  return lines;
}

function costsForMethod(
  input: TransferCostInput,
  ctx: { status: CalcStatus; warnings: string[] },
): CostLine[] {
  const re = isRealEstate(input.assetCategory, input.assetSubtype);
  const juristic = Boolean(input.ownerIsJuristic);

  switch (input.method) {
    case "ให้":
    case "ทยอยให้":
      return re ? realEstateGiftCosts(input, ctx) : movableGiftCosts(input, ctx);

    case "ซื้อขาย":
      if (!re) return movableSaleCosts(input, ctx);
      return juristic
        ? realEstateSaleJuristicCosts(input, ctx)
        : realEstateSaleIndividualCosts(input, ctx);

    case "มรดก":
      return re
        ? realEstateInheritanceCosts(input, ctx)
        : movableInheritanceCosts(input, ctx);

    case "โอนเข้าบริษัท":
      ctx.status = worseStatus(ctx.status, "Review Required");
      ctx.warnings.push(
        "โอนเข้าบริษัทต้องแยก ขาย / ให้ / ลงทุนเป็นทุน / แลกหุ้น / ชำระค่าหุ้น — ไม่ใช้สูตรให้บุคคลอัตโนมัติ",
      );
      if (!re) return movableSaleCosts({ ...input, method: "ซื้อขาย" }, ctx);
      return juristic
        ? realEstateSaleJuristicCosts(input, ctx)
        : realEstateSaleIndividualCosts(input, ctx);

    case "วิธีผสม":
    default: {
      const gift = re ? realEstateGiftCosts(input, ctx) : movableGiftCosts(input, ctx);
      ctx.status = worseStatus(ctx.status, "Rule Conflict");
      return gift.map((line) => ({
        ...line,
        note: line.note ? `${line.note} · วิธีผสมต้องแยกคำสั่ง` : "วิธีผสม",
      }));
    }
  }
}

export function calculateTransferCosts(input: TransferCostInput): TransferCostResult {
  const normalized: TransferCostInput = {
    ...input,
    transferValue: Math.max(0, input.transferValue),
    assessedValue: Math.max(0, input.assessedValue),
    costBasis: Math.max(0, input.costBasis),
  };

  const ctx: { status: CalcStatus; warnings: string[] } = {
    status: "Estimated",
    warnings: [],
  };

  if (!normalized.receivers?.length && normalized.method !== "ซื้อขาย") {
    ctx.status = worseStatus(ctx.status, "Missing Data");
    ctx.warnings.push("ไม่ได้ระบุผู้รับ — ยังยืนยันชั้นภาษีไม่ได้");
  }

  const lines = costsForMethod(normalized, ctx);
  const visible = lines.filter(
    (l) =>
      l.amount > 0 ||
      l.kind === "credit" ||
      isRealEstate(normalized.assetCategory, normalized.assetSubtype),
  );

  const fees = BAHT(
    visible.filter((l) => l.kind === "fee").reduce((s, l) => s + l.amount, 0),
  );
  const tax = BAHT(
    visible
      .filter((l) => l.kind === "tax" || l.kind === "duty")
      .reduce((s, l) => s + l.amount, 0),
  );
  const credits = BAHT(
    visible.filter((l) => l.kind === "credit" || l.isCredit).reduce((s, l) => s + l.amount, 0),
  );

  if (ctx.status === "Missing Data" || ctx.status === "Review Required") {
    // ตัวเลขใช้ได้เป็นประมาณการเท่านั้น
  }

  return {
    lines: visible,
    fees,
    tax,
    credits,
    total: BAHT(fees + tax),
    status: ctx.status,
    warnings: [...new Set(ctx.warnings)],
  };
}

export type InheritanceReceiptSlice = {
  itemKey: string;
  name: string;
  taxClass: ReceiverTaxClass;
  portion: number;
  decedentId?: string;
  inTaxBase?: boolean;
};

export type ReceiverInheritanceTaxSummary = {
  name: string;
  taxClass: ReceiverTaxClass;
  totalReceived: number;
  exempt: number;
  taxable: number;
  rate: number;
  tax: number;
  decedentId?: string;
};

export function summarizeInheritanceTaxByReceiver(
  receipts: InheritanceReceiptSlice[],
): ReceiverInheritanceTaxSummary[] {
  type Acc = {
    name: string;
    taxClass: ReceiverTaxClass;
    totalReceived: number;
    decedentId: string;
  };
  const byKey = new Map<string, Acc>();

  for (const r of receipts) {
    const name = r.name.trim();
    if (!name || r.portion <= 0) continue;
    if (r.inTaxBase === false) continue;
    const decedentId = r.decedentId?.trim() || "__unknown__";
    const key = `${name}::${decedentId}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, {
        name,
        taxClass: r.taxClass,
        totalReceived: r.portion,
        decedentId,
      });
    } else {
      prev.totalReceived += r.portion;
      if (inheritanceTaxRate(r.taxClass) > inheritanceTaxRate(prev.taxClass)) {
        prev.taxClass = r.taxClass;
      }
    }
  }

  return [...byKey.values()]
    .map((acc) => {
      const rate = inheritanceTaxRate(acc.taxClass);
      const exempt = rate <= 0 ? acc.totalReceived : INHERIT_EXEMPT;
      const taxable = rate <= 0 ? 0 : Math.max(0, acc.totalReceived - INHERIT_EXEMPT);
      const tax = BAHT(taxable * rate);
      return {
        name: acc.name,
        taxClass: acc.taxClass,
        totalReceived: BAHT(acc.totalReceived),
        exempt: BAHT(Math.min(exempt, acc.totalReceived)),
        taxable: BAHT(taxable),
        rate,
        tax,
        decedentId: acc.decedentId === "__unknown__" ? undefined : acc.decedentId,
      };
    })
    .sort((a, b) => b.totalReceived - a.totalReceived);
}

export function allocateInheritanceTaxToItems(
  receipts: InheritanceReceiptSlice[],
  summaries: ReceiverInheritanceTaxSummary[],
): Map<string, number> {
  const taxByKey = new Map(
    summaries.map((s) => [`${s.name}::${s.decedentId ?? "__unknown__"}`, s.tax]),
  );
  const totalByKey = new Map(
    summaries.map((s) => [`${s.name}::${s.decedentId ?? "__unknown__"}`, s.totalReceived]),
  );
  const allocated = new Map<string, number>();

  for (const r of receipts) {
    const name = r.name.trim();
    const decedentId = r.decedentId?.trim() || "__unknown__";
    const key = `${name}::${decedentId}`;
    const personTax = taxByKey.get(key) ?? 0;
    const personTotal = totalByKey.get(key) ?? 0;
    if (personTax <= 0 || personTotal <= 0 || r.portion <= 0) continue;
    if (r.inTaxBase === false) continue;
    const share = (personTax * r.portion) / personTotal;
    allocated.set(r.itemKey, (allocated.get(r.itemKey) ?? 0) + share);
  }

  for (const [key, amount] of allocated) {
    allocated.set(key, BAHT(amount));
  }
  return allocated;
}

export function inheritanceTaxBaseValue(input: {
  transferValue: number;
  assessedValue: number;
  assetCategory?: string;
  assetSubtype?: string;
  ownershipStatus?: OwnershipStatus | string;
  entityOwned?: boolean;
}): number {
  if (input.entityOwned) return 0;
  if (!isInheritanceTaxableAsset(input.assetCategory, input.assetSubtype)) return 0;
  const factor = maritalEstateFactor(input.ownershipStatus);
  if (isRealEstate(input.assetCategory, input.assetSubtype)) {
    const base = input.assessedValue > 0 ? input.assessedValue : input.transferValue;
    return base * factor;
  }
  const base = input.transferValue > 0 ? input.transferValue : input.assessedValue;
  return base * factor;
}
