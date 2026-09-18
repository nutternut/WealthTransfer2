import type { Scenario, ScenarioCriteria } from "@/data/wealth-transfer";
import { scenarios as seedScenarios } from "@/data/wealth-transfer";
import {
  calculateTransferCosts,
  classifyReceiverRelation,
  type ReceiverTaxClass,
} from "@/lib/transfer-cost";

const STORAGE_KEY = "wt_extra_scenarios";
const PLAN_KEY = "wt_extra_plan";

export type TransferMethod =
  | "ให้"
  | "ซื้อขาย"
  | "มรดก"
  | "โอนเข้าบริษัท"
  | "ทยอยให้"
  | "วิธีผสม";

const CRITERIA_BY_METHOD: Record<TransferMethod, ScenarioCriteria> = {
  ให้: { taxEfficiency: 4, control: 2, liquidity: 4, readiness: 5 },
  ซื้อขาย: { taxEfficiency: 2, control: 2, liquidity: 1, readiness: 5 },
  มรดก: { taxEfficiency: 5, control: 5, liquidity: 4, readiness: 2 },
  โอนเข้าบริษัท: { taxEfficiency: 3, control: 4, liquidity: 3, readiness: 3 },
  ทยอยให้: { taxEfficiency: 4, control: 3, liquidity: 4, readiness: 4 },
  วิธีผสม: { taxEfficiency: 3, control: 3, liquidity: 3, readiness: 4 },
};

const DEFAULT_CRITERIA: ScenarioCriteria = {
  taxEfficiency: 3,
  control: 3,
  liquidity: 3,
  readiness: 3,
};

function withCriteria(s: Scenario): Scenario {
  if (s.criteria) return s;
  const method = s.method as TransferMethod;
  return {
    ...s,
    criteria: CRITERIA_BY_METHOD[method] ?? DEFAULT_CRITERIA,
  };
}

export type WizardReceiver = {
  name: string;
  share: number;
  memberId?: string;
  /** ความสัมพันธ์ — ใช้จัดชั้นภาษีถ้าไม่มี taxClass */
  relation?: string;
  taxClass?: ReceiverTaxClass;
  /** ธรรมจรรยา/พิธี/ประเพณี สำหรับผู้รับที่ไม่ใช่ญาติ */
  occasion?: "customary" | "none";
};

export type WizardAssumptions = {
  market: number;
  assessed: number;
  cost: number;
  acquired: string;
  method: string;
};

export type PlanItemStored = {
  asset: string;
  owner: string;
  receiver: string;
  method: string;
  share: string;
  year: string;
  cost: number;
  status: string;
};

export function loadExtraScenarios(): Scenario[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Scenario[];
    return Array.isArray(parsed) ? parsed.map(withCriteria) : [];
  } catch {
    return [];
  }
}

export function persistExtraScenarios(items: Scenario[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function allScenarios(): Scenario[] {
  const extras = loadExtraScenarios();
  const ids = new Set(seedScenarios.map((s) => s.id));
  return [...seedScenarios, ...extras.filter((s) => !ids.has(s.id))];
}

export function nextScenarioId(existing: Scenario[]) {
  const max = existing.reduce((n, s) => {
    const m = /^S-(\d+)$/.exec(s.id);
    return m ? Math.max(n, Number(m[1])) : n;
  }, 0);
  return `S-${String(max + 1).padStart(3, "0")}`;
}

export function calculateScenario(input: {
  assetName: string;
  assetId?: string;
  method: TransferMethod;
  year: string;
  receivers: WizardReceiver[];
  transferShare: number;
  marketValue: number;
  assessedValue?: number;
  costBasis?: number;
  acquiredYear?: string;
  /** วิธีได้มาของทรัพย์ เช่น ซื้อ / ให้ / มรดก */
  acquisitionMethod?: string;
  assetCategory?: string;
  assetSubtype?: string;
  ownerIsJuristic?: boolean;
  /** จำนวนปีที่ทยอยให้ — ยกเว้นภาษีการให้ × จำนวนปี */
  giftDurationYears?: number;
  /** ถ้าส่งมาใช้ id นี้ (เช่นจาก DB) ไม่สร้างจาก local list */
  id?: string;
}): Scenario {
  const transferValue = (input.marketValue * input.transferShare) / 100;
  const assessedFull = input.assessedValue ?? input.marketValue;
  const costFull = input.costBasis ?? 0;
  const ratio = input.transferShare / 100;

  const costs = calculateTransferCosts({
    method: input.method,
    transferValue,
    assessedValue: assessedFull * ratio,
    costBasis: costFull * ratio,
    acquiredYear: input.acquiredYear,
    transactionYear: input.year,
    acquisitionMethod: input.acquisitionMethod,
    assetCategory: input.assetCategory,
    assetSubtype: input.assetSubtype,
    assetName: input.assetName,
    ownerIsJuristic: input.ownerIsJuristic,
    giftDurationYears: input.giftDurationYears,
    receivers: input.receivers.map((r) => ({
      name: r.name,
      share: r.share,
      taxClass:
        r.taxClass ?? classifyReceiverRelation(r.relation),
      occasion: r.occasion,
    })),
  });

  const criteria = CRITERIA_BY_METHOD[input.method] ?? DEFAULT_CRITERIA;
  const burden = transferValue > 0 ? costs.total / transferValue : 0;
  const score = +(
    (criteria.taxEfficiency +
      criteria.control +
      criteria.liquidity +
      criteria.readiness) /
      4 -
    burden * 8
  ).toFixed(1);

  return {
    id: input.id ?? nextScenarioId(allScenarios()),
    asset: input.assetName,
    assetId: input.assetId,
    method: input.method,
    year: input.year,
    receiver: input.receivers.map((r) => r.name).join(" + "),
    tax: costs.tax,
    fees: costs.fees,
    total: costs.total,
    score: Math.min(5, Math.max(1, score)),
    status: "คำนวณแล้ว",
    criteria,
    transferShare: input.transferShare,
    marketValue: input.marketValue,
    receivers: input.receivers,
  };
}

export function saveScenario(scenario: Scenario) {
  const extras = loadExtraScenarios();
  persistExtraScenarios([...extras, scenario]);
}

export function loadExtraPlan(): PlanItemStored[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PlanItemStored[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistExtraPlan(items: PlanItemStored[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PLAN_KEY, JSON.stringify(items));
}

export function addScenarioToPlan(item: PlanItemStored) {
  const extras = loadExtraPlan();
  persistExtraPlan([...extras, item]);
}
