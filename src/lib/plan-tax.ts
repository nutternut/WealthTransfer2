/**
 * รวมภาษีการให้และมรดกระดับแผนตามคีย์กฎหมาย
 * - สังหาริมทรัพย์: ผู้รับ + ปีภาษี + ถัง 20/10 ลบ.
 * - อสังหา ม.42(26): ผู้โอน + ผู้รับ + ปีภาษี · ยกเว้น 20 ลบ./บุตร/ปี
 * - มรดก: ผู้รับ + เจ้ามรดก · เฉพาะทรัพย์ห้ากลุ่ม
 */

import type { Asset, Member, PlanItem, Scenario } from "@/data/wealth-transfer";
import { assetEffectiveValue } from "@/lib/format";
import {
  calculateTransferCosts,
  classifyReceiverRelation,
  incrementalTax,
  inheritanceTaxBaseValue,
  inheritanceTaxRate,
  parseGiftDurationYears,
  summarizeInheritanceTaxByReceiver,
  CUSTOMARY_GIFT_EXEMPT,
  IMMOVABLE_GIFT_EXEMPT,
  INHERIT_EXEMPT,
  RELATED_GIFT_EXEMPT,
  type CostLine,
  type InheritanceReceiptSlice,
  type ReceiverInheritanceTaxSummary,
  type ReceiverTaxClass,
} from "@/lib/transfer-cost";
import {
  isParentToLegitimateChild,
  isRealEstate,
  resolveGiftBucket,
  type CalcStatus,
  type GiftBucket,
  worseStatus,
} from "@/lib/tax-engine/classify";

function parseSharePercent(share: string) {
  const value = Number.parseFloat(share.replace("%", ""));
  return Number.isNaN(value) ? 0 : value;
}

function splitReceiverNames(label: string): string[] {
  return label
    .split("+")
    .map((n) => n.trim())
    .filter(Boolean);
}

function immovableGiftKey(
  owner: string,
  receiver: string | undefined,
  taxYear: string,
): string {
  return `${owner}::${receiver?.trim() || ""}::${taxYear}`;
}

function parseImmovableGiftKey(key: string): { party: string; taxYear: string } {
  const parts = key.split("::");
  const taxYear = parts.at(-1) ?? "";
  const owner = parts[0] ?? "";
  const receiver = parts.length > 2 ? parts.slice(1, -1).join("::") : "";
  return {
    party: receiver ? `${owner} → ${receiver}` : owner,
    taxYear,
  };
}

function findAsset(item: PlanItem, assets: Asset[]): Asset | undefined {
  if (item.assetId) {
    const byId = assets.find((a) => a.id === item.assetId);
    if (byId) return byId;
  }
  return assets.find((a) => a.name === item.asset);
}

function findScenario(
  item: PlanItem,
  scenarios: Scenario[],
): Scenario | undefined {
  if (item.scenarioId) {
    const byId = scenarios.find((s) => s.id === item.scenarioId);
    if (byId) return byId;
  }
  return scenarios.find(
    (s) => s.assetId === item.assetId || s.asset === item.asset,
  );
}

function resolveReceivers(
  item: PlanItem,
  members: Member[],
  scenarios: Scenario[],
): { name: string; share: number; taxClass: ReceiverTaxClass; occasion?: GiftBucket }[] {
  const scenario = findScenario(item, scenarios);
  if (scenario?.receivers && scenario.receivers.length > 0) {
    return scenario.receivers
      .filter((r) => r.name.trim() && r.share > 0)
      .map((r) => {
        const member = members.find((m) => m.name === r.name);
        const relation =
          (r as { relation?: string }).relation ?? member?.relation;
        const taxClass =
          (r as { taxClass?: ReceiverTaxClass }).taxClass ??
          classifyReceiverRelation(relation);
        const occasion = (r as { occasion?: GiftBucket }).occasion;
        return { name: r.name.trim(), share: r.share, taxClass, occasion };
      });
  }

  const names = splitReceiverNames(item.receiver);
  if (names.length === 0) {
    return [{ name: "ผู้รับ", share: 100, taxClass: "คนอื่น" }];
  }
  const share = 100 / names.length;
  return names.map((name) => {
    const member = members.find((m) => m.name === name);
    return {
      name,
      share,
      taxClass: classifyReceiverRelation(member?.relation),
    };
  });
}

export type GiftLedgerSummary = {
  key: string;
  kind: "related" | "customary" | "immovable";
  party: string;
  taxYear: string;
  total: number;
  exempt: number;
  excess: number;
  tax: number;
};

export type PlanCostBreakdown = {
  giftTax: number;
  inheritanceTax: number;
  pit: number;
  cit: number;
  sbt: number;
  transferFees: number;
  stampDuty: number;
  taxCredits: number;
  other: number;
  cashNeeded: number;
  netToRecipients: number;
};

/** ยอดประมาณการภาษีและค่าใช้จ่ายรายปี จาก Tax Ledger ไม่ใช่ SUM รายทรัพย์ */
export type YearCostBreakdown = {
  year: string;
  salePitWht: number;
  saleSbt: number;
  saleTransferFees: number;
  saleStampDuty: number;
  movableGiftTax: number;
  immovableGiftTax: number;
  giftFeesAndDuty: number;
  inheritanceTax: number;
  inheritanceTransferFees: number;
  other: number;
  total: number;
};

type YearCostParts = Omit<YearCostBreakdown, "year" | "total">;

function emptyYearParts(): YearCostParts {
  return {
    salePitWht: 0,
    saleSbt: 0,
    saleTransferFees: 0,
    saleStampDuty: 0,
    movableGiftTax: 0,
    immovableGiftTax: 0,
    giftFeesAndDuty: 0,
    inheritanceTax: 0,
    inheritanceTransferFees: 0,
    other: 0,
  };
}

function yearBucket(
  map: Map<string, YearCostParts>,
  year: string,
): YearCostParts {
  const existing = map.get(year);
  if (existing) return existing;
  const created = emptyYearParts();
  map.set(year, created);
  return created;
}

function finalizeYearEstimates(
  map: Map<string, YearCostParts>,
): YearCostBreakdown[] {
  return [...map.entries()]
    .map(([year, parts]) => {
      const total =
        parts.salePitWht +
        parts.saleSbt +
        parts.saleTransferFees +
        parts.saleStampDuty +
        parts.movableGiftTax +
        parts.immovableGiftTax +
        parts.giftFeesAndDuty +
        parts.inheritanceTax +
        parts.inheritanceTransferFees +
        parts.other;
      return {
        year,
        salePitWht: Math.round(parts.salePitWht),
        saleSbt: Math.round(parts.saleSbt),
        saleTransferFees: Math.round(parts.saleTransferFees),
        saleStampDuty: Math.round(parts.saleStampDuty),
        movableGiftTax: Math.round(parts.movableGiftTax),
        immovableGiftTax: Math.round(parts.immovableGiftTax),
        giftFeesAndDuty: Math.round(parts.giftFeesAndDuty),
        inheritanceTax: Math.round(parts.inheritanceTax),
        inheritanceTransferFees: Math.round(parts.inheritanceTransferFees),
        other: Math.round(parts.other),
        total: Math.round(total),
      };
    })
    .sort((a, b) => a.year.localeCompare(b.year));
}

function isAggregatedGiftTaxLine(line: CostLine): boolean {
  return (
    /ภาษีเงินได้จากการให้/.test(line.label) &&
    !/โอนอสังหาริมทรัพย์/.test(line.label)
  );
}

function isAggregatedInheritTaxLine(line: CostLine): boolean {
  return line.kind === "tax" && /มรดก/.test(line.label);
}

function addSaleLine(parts: YearCostParts, line: CostLine, amount: number) {
  if (line.kind === "credit" || line.isCredit) return;
  if (line.kind === "fee") {
    parts.saleTransferFees += amount;
    return;
  }
  if (line.kind === "duty" || /อากร/.test(line.label)) {
    parts.saleStampDuty += amount;
    return;
  }
  if (/ธุรกิจเฉพาะ/.test(line.label)) {
    parts.saleSbt += amount;
    return;
  }
  if (/เงินได้|CIT|นิติบุคคล|หัก ณ ที่จ่าย/.test(line.label)) {
    parts.salePitWht += amount;
    return;
  }
  parts.other += amount;
}

function addGiftFeeLine(parts: YearCostParts, line: CostLine, amount: number) {
  if (line.kind === "credit" || line.isCredit) return;
  if (isAggregatedGiftTaxLine(line)) return;
  if (/โอนอสังหาริมทรัพย์/.test(line.label)) {
    parts.immovableGiftTax += amount;
    return;
  }
  parts.giftFeesAndDuty += amount;
}

function addInheritFeeLine(parts: YearCostParts, line: CostLine, amount: number) {
  if (line.kind === "credit" || line.isCredit) return;
  if (isAggregatedInheritTaxLine(line)) return;
  if (line.kind === "fee") {
    parts.inheritanceTransferFees += amount;
    return;
  }
  parts.other += amount;
}

function splitAcrossYears(amount: number, years: string[]): number[] {
  const n = Math.max(years.length, 1);
  const base = Math.floor(amount / n);
  const remainder = amount - base * n;
  return years.map((_, i) => (i === n - 1 ? base + remainder : base));
}

function giftYearLabels(item: PlanItem, years: number): string[] {
  const startYear = Number.parseInt(taxYearOf(item), 10);
  return Array.from({ length: Math.max(years, 1) }, (_, y) =>
    Number.isFinite(startYear) && years > 1
      ? String(startYear + y)
      : taxYearOf(item),
  );
}

export type PriorLedgerSeed = {
  kind: GiftLedgerSummary["kind"] | "inheritance";
  party: string;
  counterparty?: string;
  taxYear: string;
  currentTotal: number;
  taxClass?: ReceiverTaxClass;
};

export const ACTIVE_TAX_RULE = {
  id: "WT-P1-2569.09",
  asOf: "15 ก.ย. 2569",
  fromYear: 2558,
  toYear: 2569,
};

export type PlanTaxResult = {
  plan: PlanItem[];
  inheritanceByReceiver: ReceiverInheritanceTaxSummary[];
  totalInheritanceTax: number;
  giftLedgers: GiftLedgerSummary[];
  totalGiftTax: number;
  breakdown: PlanCostBreakdown;
  yearEstimates: YearCostBreakdown[];
  itemLines: Map<string, CostLine[]>;
  warnings: string[];
  status: CalcStatus;
  missingDataCount: number;
  reviewRequiredCount: number;
};

function emptyBreakdown(): PlanCostBreakdown {
  return {
    giftTax: 0,
    inheritanceTax: 0,
    pit: 0,
    cit: 0,
    sbt: 0,
    transferFees: 0,
    stampDuty: 0,
    taxCredits: 0,
    other: 0,
    cashNeeded: 0,
    netToRecipients: 0,
  };
}

function addLineToBreakdown(b: PlanCostBreakdown, line: CostLine) {
  const amt = line.amount;
  if (line.kind === "credit" || line.isCredit) {
    b.taxCredits += amt;
    return;
  }
  if (line.kind === "fee") {
    b.transferFees += amt;
    return;
  }
  if (line.kind === "duty") {
    b.stampDuty += amt;
    return;
  }
  if (/มรดก/.test(line.label)) {
    b.inheritanceTax += amt;
    return;
  }
  if (/จากการให้|ให้สังหาริม|ให้อสังหา|จากการโอนอสังหา/.test(line.label)) {
    b.giftTax += amt;
    return;
  }
  if (/นิติบุคคล|CIT/.test(line.label)) {
    b.cit += amt;
    return;
  }
  if (/ธุรกิจเฉพาะ/.test(line.label)) {
    b.sbt += amt;
    return;
  }
  if (/เงินได้/.test(line.label)) {
    b.pit += amt;
    return;
  }
  b.other += amt;
}

export function taxYearOf(item: { year: string }): string {
  const y = item.year.trim() || "-";
  const match = /(\d{4})/.exec(y);
  return match?.[1] ?? (y.split(/[-–—]/)[0]?.trim() || y);
}

function warnRuleVersion(yearLabel: string, warnings: string[]) {
  const y = Number.parseInt(taxYearOf({ year: yearLabel }), 10);
  if (!Number.isFinite(y)) return;
  if (y < ACTIVE_TAX_RULE.fromYear || y > ACTIVE_TAX_RULE.toYear) {
    warnings.push(
      `ปี ${y} อยู่นอกช่วง Rule Version ${ACTIVE_TAX_RULE.id} (ณ ${ACTIVE_TAX_RULE.asOf}) — ระบบคำนวณใหม่ตามกฎชุดนี้ ต้องให้ฝ่ายภาษีตรวจก่อนใช้ตัวเลข`,
    );
  }
}

function durationOf(item: PlanItem): number {
  if (item.method === "ทยอยให้") {
    return Math.max(parseGiftDurationYears(item.year) ?? 1, 2);
  }
  return parseGiftDurationYears(item.year) ?? 1;
}

/**
 * คำนวณค่าใช้จ่ายแผนใหม่: รวมฐานการให้และมรดกตามคีย์กฎหมาย
 */
export function applyAggregatedPlanTaxes(params: {
  plan: PlanItem[];
  assets: Asset[];
  members: Member[];
  scenarios?: Scenario[];
  priorLedgers?: PriorLedgerSeed[];
}): PlanTaxResult {
  const { plan, assets, members, scenarios = [], priorLedgers = [] } = params;
  const warnings: string[] = [];
  let status: CalcStatus = "Estimated";
  let missingDataCount = 0;
  let reviewRequiredCount = 0;
  const itemLines = new Map<string, CostLine[]>();
  const breakdown = emptyBreakdown();
  const yearParts = new Map<string, YearCostParts>();

  const inheritIndices = plan
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.method === "มรดก")
    .sort((a, b) => taxYearOf(a.item).localeCompare(taxYearOf(b.item)));

  const receipts: InheritanceReceiptSlice[] = [];
  const feesByKey = new Map<string, number>();
  const giftTaxByKey = new Map<string, number>();

  const relatedTotals = new Map<string, number>();
  const customaryTotals = new Map<string, number>();
  const immovableTotals = new Map<string, number>();
  const priorInheritReceipts: InheritanceReceiptSlice[] = [];

  for (const seed of priorLedgers) {
    if (seed.kind === "related") {
      relatedTotals.set(`${seed.party}::${seed.taxYear}`, seed.currentTotal);
    } else if (seed.kind === "customary") {
      customaryTotals.set(`${seed.party}::${seed.taxYear}`, seed.currentTotal);
    } else if (seed.kind === "immovable") {
      immovableTotals.set(
        immovableGiftKey(seed.party, seed.counterparty, seed.taxYear),
        seed.currentTotal,
      );
    } else if (seed.kind === "inheritance" && seed.currentTotal > 0) {
      priorInheritReceipts.push({
        itemKey: `prior:${seed.party}:${seed.counterparty ?? ""}`,
        name: seed.party,
        taxClass: seed.taxClass ?? "คนอื่น",
        portion: seed.currentTotal,
        decedentId: seed.counterparty,
        inTaxBase: true,
      });
    }
  }

  const giftItems = plan
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.method === "ให้" || item.method === "ทยอยให้")
    .sort((a, b) => taxYearOf(a.item).localeCompare(taxYearOf(b.item)));

  function costInputFor(item: PlanItem, extra?: Record<string, unknown>) {
    const asset = findAsset(item, assets);
    const sharePercent = parseSharePercent(item.share);
    const ratio = sharePercent / 100;
    const assetValue = asset
      ? (assetEffectiveValue(asset.value, asset.share) ?? 0)
      : 0;
    const assessedFull = asset
      ? (assetEffectiveValue(asset.assessed ?? asset.value, asset.share) ?? 0)
      : 0;
    const costFull = asset
      ? (assetEffectiveValue(asset.cost ?? 0, asset.share) ?? 0)
      : 0;
    const receivers = resolveReceivers(item, members, scenarios);
    const entityOwned = asset?.ownerKind === "นิติบุคคล";
    return {
      transferValue: assetValue * ratio,
      assessedValue: assessedFull * ratio,
      costBasis: costFull * ratio,
      acquiredYear: asset?.acquired,
      acquisitionMethod: asset?.method,
      assetCategory: asset?.type,
      assetSubtype: asset?.subtype,
      ownerIsJuristic: entityOwned,
      entityOwned,
      ownershipStatus: (asset as { ownershipStatus?: string })?.ownershipStatus,
      receivers,
      transactionYear: item.year,
      transferorId: item.owner,
      decedentId: item.owner,
      paidUpValue: asset?.registeredCapital,
      ...extra,
    };
  }

  for (const { item, index } of giftItems) {
    warnRuleVersion(item.year, warnings);
    const itemKey = item.id ?? `plan-${index}`;
    const years = durationOf(item);
    const baseInput = costInputFor(item, {
      method: item.method as "ให้" | "ทยอยให้",
      omitGiftTax: true,
      giftDurationYears: years,
    });
    const costs = calculateTransferCosts({
      method: item.method as "ให้" | "ทยอยให้",
      ...baseInput,
    });
    status = worseStatus(status, costs.status);
    if (costs.status === "Missing Data") missingDataCount += 1;
    if (costs.status === "Review Required") reviewRequiredCount += 1;
    warnings.push(...costs.warnings.map((w) => `${item.asset}: ${w}`));

    let giftTax = 0;
    const asset = findAsset(item, assets);
    const re = isRealEstate(asset?.type, asset?.subtype);
    const receivers = baseInput.receivers as {
      name: string;
      share: number;
      taxClass: ReceiverTaxClass;
      occasion?: GiftBucket;
    }[];
    const sumShare = receivers.reduce((s, r) => s + r.share, 0) || 1;
    const yearLabels = giftYearLabels(item, years);
    const valueForGift = re ? baseInput.assessedValue : baseInput.transferValue;
    const yearlyValue = years > 1 ? valueForGift / years : valueForGift;

    for (let y = 0; y < years; y++) {
      const yearLabel = yearLabels[y] ?? taxYearOf(item);
      for (const r of receivers) {
        const portion = (yearlyValue * r.share) / sumShare;
        if (re) {
          if (!isParentToLegitimateChild(r.taxClass)) continue;
          const key = immovableGiftKey(item.owner, r.name, yearLabel);
          const prior = immovableTotals.get(key) ?? 0;
          const inc = incrementalTax(prior, portion, IMMOVABLE_GIFT_EXEMPT, 0.05);
          giftTax += inc.incremental;
          immovableTotals.set(key, inc.newTotal);
          yearBucket(yearParts, yearLabel).immovableGiftTax += inc.incremental;
        } else {
          const bucket = resolveGiftBucket({
            taxClass: r.taxClass,
            occasion: r.occasion,
          });
          if (bucket === "none") continue;
          const map = bucket === "related" ? relatedTotals : customaryTotals;
          const exempt =
            bucket === "related" ? RELATED_GIFT_EXEMPT : CUSTOMARY_GIFT_EXEMPT;
          const key = `${r.name}::${yearLabel}`;
          const prior = map.get(key) ?? 0;
          const inc = incrementalTax(prior, portion, exempt, 0.05);
          giftTax += inc.incremental;
          map.set(key, inc.newTotal);
          yearBucket(yearParts, yearLabel).movableGiftTax += inc.incremental;
        }
      }
    }

    giftTax = Math.round(giftTax);
    giftTaxByKey.set(itemKey, giftTax);
    feesByKey.set(itemKey, costs.total);
    const giftLine: CostLine = {
      label: "ภาษีเงินได้จากการให้ (รวมฐานทั้งปี)",
      amount: giftTax,
      kind: "tax",
      note: re
        ? "สะสมผู้โอน+ผู้รับ+ปี · ม.42(26) · ยกเว้น 20 ลบ./คน"
        : "สะสมผู้รับ+ปี · ม.42(27)/(28)",
    };
    itemLines.set(itemKey, [...costs.lines, giftLine]);
    for (const line of costs.lines) addLineToBreakdown(breakdown, line);
    addLineToBreakdown(breakdown, giftLine);

    for (const line of costs.lines) {
      const slices = splitAcrossYears(line.amount, yearLabels);
      yearLabels.forEach((yearLabel, i) => {
        addGiftFeeLine(yearBucket(yearParts, yearLabel), line, slices[i] ?? 0);
      });
    }
  }

  for (const { item, index } of inheritIndices) {
    warnRuleVersion(item.year, warnings);
    const itemKey = item.id ?? `plan-${index}`;
    const input = costInputFor(item, { method: "มรดก", omitInheritanceTax: true });
    const taxBase = inheritanceTaxBaseValue({
      transferValue: input.transferValue,
      assessedValue: input.assessedValue,
      assetCategory: input.assetCategory,
      assetSubtype: input.assetSubtype,
      ownershipStatus: input.ownershipStatus,
      entityOwned: input.entityOwned,
    });
    const receivers = input.receivers as {
      name: string;
      share: number;
      taxClass: ReceiverTaxClass;
    }[];
    const sumShare = receivers.reduce((s, r) => s + r.share, 0) || 1;
    const inTaxBase = taxBase > 0;
    for (const r of receivers) {
      receipts.push({
        itemKey,
        name: r.name,
        taxClass: r.taxClass,
        portion: inTaxBase
          ? (taxBase * r.share) / sumShare
          : (input.transferValue * r.share) / sumShare,
        decedentId: item.owner,
        inTaxBase,
      });
    }
    const inheritYear = taxYearOf(item);
    const costs = calculateTransferCosts({
      method: "มรดก",
      ...input,
    });
    status = worseStatus(status, costs.status);
    if (costs.status === "Missing Data") missingDataCount += 1;
    if (costs.status === "Review Required") reviewRequiredCount += 1;
    warnings.push(...costs.warnings.map((w) => `${item.asset}: ${w}`));
    feesByKey.set(itemKey, costs.total);
    itemLines.set(itemKey, costs.lines);
    for (const line of costs.lines) addLineToBreakdown(breakdown, line);
    for (const line of costs.lines) {
      addInheritFeeLine(yearBucket(yearParts, inheritYear), line, line.amount);
    }
  }

  const otherItems = plan
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) =>
        item.method !== "มรดก" &&
        item.method !== "ให้" &&
        item.method !== "ทยอยให้",
    );

  for (const { item, index } of otherItems) {
    warnRuleVersion(item.year, warnings);
    const itemKey = item.id ?? `plan-${index}`;
    const costs = calculateTransferCosts({
      method: (item.method as "ซื้อขาย") || "ซื้อขาย",
      ...costInputFor(item),
    });
    status = worseStatus(status, costs.status);
    if (costs.status === "Missing Data") missingDataCount += 1;
    if (costs.status === "Review Required") reviewRequiredCount += 1;
    warnings.push(...costs.warnings.map((w) => `${item.asset}: ${w}`));
    feesByKey.set(itemKey, costs.total);
    itemLines.set(itemKey, costs.lines);
    for (const line of costs.lines) addLineToBreakdown(breakdown, line);
    const saleYears = giftYearLabels(item, durationOf(item));
    for (const line of costs.lines) {
      const slices = splitAcrossYears(line.amount, saleYears);
      saleYears.forEach((yearLabel, i) => {
        addSaleLine(yearBucket(yearParts, yearLabel), line, slices[i] ?? 0);
      });
    }
  }

  const combinedInheritance = summarizeInheritanceTaxByReceiver([
    ...priorInheritReceipts,
    ...receipts,
  ]);
  const priorInheritance = summarizeInheritanceTaxByReceiver(priorInheritReceipts);
  const inheritanceByReceiver = combinedInheritance.map((row) => {
    const prior = priorInheritance.find(
      (p) => p.name === row.name && (p.decedentId ?? "") === (row.decedentId ?? ""),
    );
    return {
      ...row,
      tax: Math.max(0, row.tax - (prior?.tax ?? 0)),
    };
  });

  const inheritRunning = new Map<string, number>();
  for (const seed of priorLedgers) {
    if (seed.kind === "inheritance" && seed.currentTotal > 0) {
      inheritRunning.set(
        `${seed.party}::${seed.counterparty ?? ""}`,
        seed.currentTotal,
      );
    }
  }
  const itemYear = new Map(
    inheritIndices.map(({ item, index }) => [
      item.id ?? `plan-${index}`,
      taxYearOf(item),
    ]),
  );
  const allocatedTax = new Map<string, number>();
  for (const r of receipts) {
    if (!r.inTaxBase || r.portion <= 0) continue;
    const key = `${r.name}::${r.decedentId ?? ""}`;
    const prior = inheritRunning.get(key) ?? 0;
    const rate = inheritanceTaxRate(r.taxClass);
    const inc =
      rate <= 0
        ? { incremental: 0, newTotal: prior + r.portion }
        : incrementalTax(prior, r.portion, INHERIT_EXEMPT, rate);
    inheritRunning.set(key, inc.newTotal);
    allocatedTax.set(
      r.itemKey,
      (allocatedTax.get(r.itemKey) ?? 0) + inc.incremental,
    );
    const year = itemYear.get(r.itemKey) ?? "-";
    yearBucket(yearParts, year).inheritanceTax += inc.incremental;
  }
  for (const [key, amount] of allocatedTax) {
    allocatedTax.set(key, Math.round(amount));
  }

  const totalInheritanceTax = inheritanceByReceiver.reduce(
    (s, r) => s + r.tax,
    0,
  );
  breakdown.inheritanceTax = totalInheritanceTax;

  const giftLedgers: GiftLedgerSummary[] = [];
  for (const [key, total] of relatedTotals) {
    const [party, taxYear] = key.split("::");
    const excess = Math.max(0, total - RELATED_GIFT_EXEMPT);
    giftLedgers.push({
      key,
      kind: "related",
      party: party ?? "",
      taxYear: taxYear ?? "",
      total,
      exempt: Math.min(RELATED_GIFT_EXEMPT, total),
      excess,
      tax: Math.round(excess * 0.05),
    });
  }
  for (const [key, total] of customaryTotals) {
    const [party, taxYear] = key.split("::");
    const excess = Math.max(0, total - CUSTOMARY_GIFT_EXEMPT);
    giftLedgers.push({
      key,
      kind: "customary",
      party: party ?? "",
      taxYear: taxYear ?? "",
      total,
      exempt: Math.min(CUSTOMARY_GIFT_EXEMPT, total),
      excess,
      tax: Math.round(excess * 0.05),
    });
  }
  for (const [key, total] of immovableTotals) {
    const parsed = parseImmovableGiftKey(key);
    const excess = Math.max(0, total - IMMOVABLE_GIFT_EXEMPT);
    giftLedgers.push({
      key,
      kind: "immovable",
      party: parsed.party,
      taxYear: parsed.taxYear,
      total,
      exempt: Math.min(IMMOVABLE_GIFT_EXEMPT, total),
      excess,
      tax: Math.round(excess * 0.05),
    });
  }

  const totalGiftTax = [...giftTaxByKey.values()].reduce((s, n) => s + n, 0);
  const yearEstimates = finalizeYearEstimates(yearParts);
  breakdown.giftTax = Math.round(
    yearEstimates.reduce(
      (s, y) => s + y.movableGiftTax + y.immovableGiftTax,
      0,
    ),
  );
  breakdown.cashNeeded =
    breakdown.giftTax +
    breakdown.inheritanceTax +
    breakdown.pit +
    breakdown.cit +
    breakdown.sbt +
    breakdown.transferFees +
    breakdown.stampDuty +
    breakdown.other;
  breakdown.netToRecipients = plan.reduce((s, item) => {
    const asset = findAsset(item, assets);
    const ratio = parseSharePercent(item.share) / 100;
    const value = asset
      ? (assetEffectiveValue(asset.value, asset.share) ?? 0) * ratio
      : 0;
    return s + value;
  }, 0);

  const adjusted = plan.map((item, index) => {
    const itemKey = item.id ?? `plan-${index}`;
    const base = feesByKey.get(itemKey);
    if (base == null) return item;
    const extra =
      (item.method === "มรดก" ? (allocatedTax.get(itemKey) ?? 0) : 0) +
      (giftTaxByKey.get(itemKey) ?? 0);
    const inheritLine = itemLines.get(itemKey);
    if (item.method === "มรดก" && inheritLine) {
      const taxAmt = allocatedTax.get(itemKey) ?? 0;
      itemLines.set(itemKey, [
        ...inheritLine,
        {
          label: "ภาษีการรับมรดก (รวมฐานผู้รับ+เจ้ามรดก)",
          amount: taxAmt,
          kind: "tax",
        },
      ]);
    }
    return {
      ...item,
      cost: Math.round((base + extra) * 100) / 100,
    };
  });

  return {
    plan: adjusted,
    inheritanceByReceiver,
    totalInheritanceTax: Math.round(totalInheritanceTax * 100) / 100,
    giftLedgers,
    totalGiftTax,
    breakdown,
    yearEstimates,
    itemLines,
    warnings: [...new Set(warnings)],
    status,
    missingDataCount,
    reviewRequiredCount,
  };
}

/** คงชื่อเดิมให้หน้าเดิมเรียกได้ */
export function applyAggregatedInheritanceTaxToPlan(params: {
  plan: PlanItem[];
  assets: Asset[];
  members: Member[];
  scenarios?: Scenario[];
}): Pick<PlanTaxResult, "plan" | "inheritanceByReceiver" | "totalInheritanceTax"> &
  Partial<PlanTaxResult> {
  return applyAggregatedPlanTaxes(params);
}
