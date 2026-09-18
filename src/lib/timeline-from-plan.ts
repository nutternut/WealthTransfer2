import type {
  Asset,
  PlanItem,
  TimelineEvent,
  TimelineYear,
} from "@/data/wealth-transfer";
import { assetEffectiveValue } from "@/lib/format";

function parseSharePercent(share: string) {
  const value = Number.parseFloat(share.replace("%", ""));
  return Number.isNaN(value) ? 0 : value;
}

function planItemTransferValue(item: PlanItem, assets: Asset[]): number {
  const asset = item.assetId
    ? assets.find((a) => a.id === item.assetId)
    : assets.find((a) => a.name === item.asset);
  if (!asset) return 0;
  const sharePercent = parseSharePercent(item.share);
  const assetValue = assetEffectiveValue(asset.value, asset.share) ?? 0;
  return (assetValue * sharePercent) / 100;
}

/** แยกปีจาก year_label เช่น "2569", "2569 (3 ปี)", "2569-2571", "เมื่อรับมรดก" */
export function parseYearSpan(yearLabel: string): string[] {
  const trimmed = yearLabel.trim() || "-";

  const rangeMatch = trimmed.match(/^(\d{4})\s*[-–—]\s*(\d{4})/);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    if (end >= start && end - start < 30) {
      return Array.from({ length: end - start + 1 }, (_, i) =>
        String(start + i),
      );
    }
  }

  const durationMatch = trimmed.match(/^(\d{4})\s*\((\d+)\s*ปี\)/);
  if (durationMatch) {
    const start = Number(durationMatch[1]);
    const duration = Number(durationMatch[2]);
    if (duration >= 1 && duration <= 30) {
      return Array.from({ length: duration }, (_, i) => String(start + i));
    }
  }

  const single = trimmed.match(/^(\d{4})/);
  if (single) return [single[1]];

  return [trimmed];
}

function buildPrep(events: TimelineEvent[]): string[] {
  const tips: string[] = [];
  const methods = new Set(events.map((e) => e.method));

  if (methods.has("ให้") || methods.has("ทยอยให้")) {
    tips.push("เตรียมเอกสารโอนและประเมินราคา");
  }
  if (methods.has("ซื้อขาย")) {
    tips.push("เตรียมสัญญาซื้อขายและเอกสารโอนกรรมสิทธิ์");
  }
  if (methods.has("มรดก")) {
    tips.push("เตรียมพินัยกรรมและเอกสารที่เกี่ยวข้องกับมรดก");
  }
  tips.push("วางแผนสภาพคล่องสำหรับภาษีและค่าธรรมเนียม");
  if (events.some((e) => e.detail?.includes("งวด"))) {
    tips.push("ทบทวนสัดส่วนถือครองหลังแต่ละงวด");
  }

  return [...new Set(tips)].slice(0, 3);
}

function sortYearKeys(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  const aNum = Number.isFinite(na);
  const bNum = Number.isFinite(nb);
  if (aNum && bNum) return na - nb;
  if (aNum) return -1;
  if (bNum) return 1;
  return a.localeCompare(b, "th");
}

/**
 * สร้าง timeline จากรายการในแผนจริง
 * - ปีหลายปี / ระยะเวลา เช่น "2569 (3 ปี)" จะกระจายภาระและเหตุการณ์ตามปี
 * - ค่าใช้จ่ายและมูลค่าเป็นบาท (ไม่ใช่ล้านบาท)
 */
export function buildTimelineSchedule(
  plan: PlanItem[],
  assets: Asset[] = [],
  yearTotals: { year: string; amount: number }[] = [],
): TimelineYear[] {
  type Bucket = { amount: number; events: TimelineEvent[] };
  const buckets = new Map<string, Bucket>();
  const amountOverride = new Map(yearTotals.map((y) => [y.year, y.amount]));

  plan.forEach((item, planIndex) => {
    const years = parseYearSpan(item.year);
    const n = Math.max(years.length, 1);
    const totalCost = Math.round(item.cost);
    const costBase = Math.floor(totalCost / n);
    const costRemainder = totalCost - costBase * n;
    const transferValue = Math.round(planItemTransferValue(item, assets));
    const valueBase = Math.floor(transferValue / n);
    const valueRemainder = transferValue - valueBase * n;
    const itemKey = item.id ?? item.scenarioId ?? `plan-${planIndex}`;

    years.forEach((year, index) => {
      const perYearCost =
        index === n - 1 ? costBase + costRemainder : costBase;
      const perYearValue =
        index === n - 1 ? valueBase + valueRemainder : valueBase;
      const bucket = buckets.get(year) ?? { amount: 0, events: [] };
      bucket.amount += perYearCost;
      bucket.events.push({
        id: `${itemKey}-${year}-${index}`,
        title: item.asset,
        method: item.method,
        receiver: item.receiver || undefined,
        value: perYearValue > 0 ? perYearValue : undefined,
        detail:
          n > 1
            ? `งวดที่ ${index + 1}/${n} · ${item.share}`
            : item.share
              ? item.share
              : undefined,
      });
      buckets.set(year, bucket);
    });
  });

  const rows = [...buckets.entries()]
    .map(([year, bucket]) => ({
      year,
      amount: amountOverride.get(year) ?? bucket.amount,
      events: bucket.events,
      prep: buildPrep(bucket.events),
    }))
    .sort((a, b) => sortYearKeys(a.year, b.year));

  const max = Math.max(...rows.map((r) => r.amount), 1);

  return rows.map((r) => ({
    year: r.year,
    amount: r.amount,
    percent: Math.round((r.amount / max) * 100),
    events: r.events,
    prep: r.prep,
  }));
}
