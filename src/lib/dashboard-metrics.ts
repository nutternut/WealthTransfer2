import { ASSET_CATEGORIES } from "@/data/asset-taxonomy";
import type { Asset, PlanItem } from "@/data/wealth-transfer";
import {
  assetDisplayAmount,
  assetEffectiveDisplayValue,
} from "@/lib/format";

export type ShareSlice = {
  label: string;
  percent: number;
  color?: string;
};

const TYPE_COLORS: Record<string, string> = {
  หุ้นส่วนบริษัท: "#1B3A5C",
  อสังหาริมทรัพย์: "#3A5F8A",
  ทรัพย์สินทางการเงิน: "#6B8BB0",
  ทรัพย์สินอื่น: "#A3B8D0",
};

const FALLBACK_COLORS = ["#1B3A5C", "#3A5F8A", "#6B8BB0", "#A3B8D0", "#94A3B8"];

function parseSharePercent(share: string) {
  const value = Number.parseFloat(share.replace("%", ""));
  return Number.isNaN(value) ? 0 : value;
}

function roundPct(n: number) {
  return Math.round(n * 10) / 10;
}

/** มูลค่ารวมของทรัพย์ (ตามสัดส่วนถือครอง) */
export function totalAssetValue(assets: Asset[]) {
  return assets.reduce(
    (sum, a) => sum + (assetEffectiveDisplayValue(a) ?? 0),
    0,
  );
}

/**
 * มูลค่าทรัพย์ที่อยู่ในแผน = มูลค่าทรัพย์ที่มีสถานะไม่ใช่ "ยังไม่ได้วางแผน"
 * (มีแผนแล้ว / อยู่ระหว่างวางแผน)
 */
export function plannedAssetValue(assets: Asset[]) {
  return assets
    .filter((a) => a.status !== "ยังไม่ได้วางแผน")
    .reduce((sum, a) => sum + (assetEffectiveDisplayValue(a) ?? 0), 0);
}

/** ค่าใช้จ่ายรวมตามรายการในแผน */
export function plannedPlanCost(plan: PlanItem[]) {
  return plan.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
}

/** สัดส่วนมูลค่าตามประเภททรัพย์สิน */
export function computeAssetTypeShares(assets: Asset[]): ShareSlice[] {
  const totals = new Map<string, number>();
  for (const a of assets) {
    const v = assetEffectiveDisplayValue(a) ?? 0;
    if (v <= 0) continue;
    const label = a.type?.trim() || "อื่น ๆ";
    totals.set(label, (totals.get(label) ?? 0) + v);
  }

  const grand = [...totals.values()].reduce((s, n) => s + n, 0);
  if (grand <= 0) return [];

  const orderedLabels = [
    ...ASSET_CATEGORIES.filter((c) => totals.has(c)),
    ...[...totals.keys()].filter(
      (k) => !(ASSET_CATEGORIES as readonly string[]).includes(k),
    ),
  ];

  return orderedLabels.map((label, i) => ({
    label,
    percent: roundPct(((totals.get(label) ?? 0) / grand) * 100),
    color: TYPE_COLORS[label] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
  }));
}

/**
 * สัดส่วนมูลค่าตามผู้ถือกรรมสิทธิ์ — จัดสรรตามผู้ถือแต่ละคน × สัดส่วน
 */
export function computeOwnerShares(assets: Asset[]): ShareSlice[] {
  const byOwner = new Map<string, number>();

  for (const a of assets) {
    const base = assetDisplayAmount(a) ?? 0;
    if (base <= 0) continue;

    const holders =
      a.owners && a.owners.length > 0
        ? a.owners
        : [{ owner: a.owner, share: a.share }];

    for (const h of holders) {
      const slice = (base * (Number(h.share) || 0)) / 100;
      if (slice <= 0) continue;
      const name = h.owner?.trim() && h.owner !== "—" ? h.owner.trim() : "ไม่ระบุ";
      byOwner.set(name, (byOwner.get(name) ?? 0) + slice);
    }
  }

  const grand = [...byOwner.values()].reduce((s, n) => s + n, 0);
  if (grand <= 0) return [];

  const ranked = [...byOwner.entries()]
    .map(([label, amount]) => ({
      label,
      amount,
      percent: roundPct((amount / grand) * 100),
    }))
    .sort((a, b) => b.amount - a.amount);

  const MAX_ROWS = 6;
  if (ranked.length <= MAX_ROWS) {
    return ranked.map(({ label, percent }) => ({ label, percent }));
  }

  const top = ranked.slice(0, MAX_ROWS - 1);
  const restPct = roundPct(
    ranked.slice(MAX_ROWS - 1).reduce((s, r) => s + r.percent, 0),
  );
  return [
    ...top.map(({ label, percent }) => ({ label, percent })),
    { label: "อื่น ๆ", percent: restPct },
  ];
}

/** ทรัพย์ที่ควรเริ่มวางแผน — แสดงครบทุกรายการที่ยังไม่มีแผน ตามลำดับเดียวกับหน้า assets (sort_order) */
export function priorityAssets(assets: Asset[]): Asset[] {
  return assets.filter((a) => a.status !== "มีแผนแล้ว");
}

/** มูลค่าที่วางแผนโอน (สำหรับอ้างอิงแผน — ไม่ใช้บน KPI หลัก) */
export function planTransferValue(plan: PlanItem[], assets: Asset[]) {
  return plan.reduce((sum, item) => {
    const asset = assets.find(
      (a) => a.id === item.assetId || a.name === item.asset,
    );
    const sharePercent = parseSharePercent(item.share);
    const assetValue = asset ? (assetEffectiveDisplayValue(asset) ?? 0) : 0;
    return sum + (assetValue * sharePercent) / 100;
  }, 0);
}
