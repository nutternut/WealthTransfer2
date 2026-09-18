import type {
  Asset,
  PlanItem,
  Scenario,
  TimelineYear,
} from "@/data/wealth-transfer";
import { parseYearSpan } from "@/lib/timeline-from-plan";
import { money } from "@/lib/format";

/** ระดับตามข้อ 25.1 */
export type RecommendationLevel = "high" | "medium" | "info";

/** ภาษี/ค่าธรรมเนียมแยกรายทรัพย์สิน */
export type AssetCostBreakdown = {
  name: string;
  tax: number;
  fees: number;
  total: number;
};

export type PlanRecommendation = {
  id: string;
  title: string;
  /** คำแนะนำที่แสดง (ข้อ 25.2) */
  advice: string;
  /** เหตุผล/เงื่อนไขที่ทำให้คำแนะนำปรากฏ (ข้อ 25.4) */
  reason: string;
  level: RecommendationLevel;
  assets: string[];
  /** ภาษีและค่าธรรมเนียมของแต่ละรายการ (ถ้ามี) */
  costByAsset?: AssetCostBreakdown[];
};

export const RECOMMENDATION_LEVEL_LABEL: Record<RecommendationLevel, string> = {
  high: "ควรดำเนินการก่อน",
  medium: "ควรพิจารณา",
  info: "ข้อมูลประกอบการตัดสินใจ",
};

const LEVEL_RANK: Record<RecommendationLevel, number> = {
  high: 0,
  medium: 1,
  info: 2,
};

function receiverCount(receiver: string | undefined): number {
  if (!receiver?.trim()) return 0;
  return receiver
    .split(/\s*\+\s*/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

function giftDurationYears(item: PlanItem): number {
  if (item.method === "ทยอยให้") {
    return Math.max(parseYearSpan(item.year).length, 2);
  }
  return Math.max(parseYearSpan(item.year).length, 1);
}

function isGiftMethod(method: string) {
  return method === "ให้" || method === "ทยอยให้";
}

function findAsset(planItem: PlanItem, assets: Asset[]): Asset | undefined {
  if (planItem.assetId) {
    const byId = assets.find((a) => a.id === planItem.assetId);
    if (byId) return byId;
  }
  return assets.find((a) => a.name === planItem.asset);
}

function noteText(asset: Asset | undefined): string {
  return (asset?.note ?? "").trim();
}

function hasMortgageOrEncumbrance(asset: Asset | undefined): boolean {
  const n = noteText(asset);
  return /จำนอง|ภาระผูกพัน|ภาระหนี้|ภาระค้ำ/.test(n);
}

function hasTransferRestriction(asset: Asset | undefined): boolean {
  const n = noteText(asset);
  return /ข้อจำกัดการโอน|สิทธิซื้อ.*ก่อน|ข้อบังคับ|shareholders?\s*agreement|ROFR/i.test(
    n,
  );
}

function wantsRetainControl(asset: Asset | undefined): boolean {
  const n = noteText(asset);
  return /ต้องการรักษาอำนาจควบคุม|รักษาอำนาจควบคุม|รักษาการควบคุม/.test(n);
}

function isCompanyShare(asset: Asset | undefined, planItem: PlanItem): boolean {
  const type = asset?.type ?? "";
  return (
    type === "หุ้นส่วนบริษัท" ||
    type.includes("หุ้น") ||
    /หุ้น/.test(planItem.asset)
  );
}

function isIncomeAsset(asset: Asset | undefined): boolean {
  const role = asset?.role ?? "";
  return role === "ทรัพย์สินสร้างรายได้" || role.includes("สร้างรายได้");
}

function hasJointOwners(asset: Asset | undefined): boolean {
  return (asset?.owners?.length ?? 0) > 1;
}

function hasInstallment(planItem: PlanItem, asset: Asset | undefined): boolean {
  const hay = `${planItem.year} ${noteText(asset)}`;
  return /ผ่อนชำระ|ผ่อน/.test(hay);
}

function uniqueNames(names: string[]): string[] {
  return [...new Set(names.map((n) => n.trim()).filter(Boolean))];
}

function mergeCostByAsset(
  a: AssetCostBreakdown[] | undefined,
  b: AssetCostBreakdown[] | undefined,
): AssetCostBreakdown[] | undefined {
  if (!a?.length && !b?.length) return undefined;
  const map = new Map<string, AssetCostBreakdown>();
  for (const row of [...(a ?? []), ...(b ?? [])]) {
    const key = row.name.trim();
    if (!key) continue;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...row, name: key });
      continue;
    }
    map.set(key, {
      name: key,
      tax: prev.tax + row.tax,
      fees: prev.fees + row.fees,
      total: prev.total + row.total,
    });
  }
  return [...map.values()];
}

function formatCostBreakdown(rows: AssetCostBreakdown[]): string {
  const sum = rows.reduce((s, r) => s + r.total, 0);
  if (rows.length <= 1) {
    const row = rows[0];
    if (!row) return money(sum);
    const bits: string[] = [];
    if (row.tax > 0) bits.push(`ภาษี ${money(row.tax)}`);
    if (row.fees > 0) bits.push(`ค่าธรรมเนียม ${money(row.fees)}`);
    if (bits.length === 0) return money(row.total);
    return `${bits.join(" + ")} · รวม ${money(row.total)}`;
  }
  return `ทุกรายการ · รวม ${money(sum)}`;
}

function findScenario(
  planItem: PlanItem,
  scenarios: Scenario[],
): Scenario | undefined {
  if (planItem.scenarioId) {
    const byId = scenarios.find((s) => s.id === planItem.scenarioId);
    if (byId) return byId;
  }
  const sameMethod = scenarios.filter((s) => s.method === planItem.method);
  if (planItem.assetId) {
    const byAssetId = sameMethod.find((s) => s.assetId === planItem.assetId);
    if (byAssetId) return byAssetId;
  }
  return sameMethod.find((s) => s.asset === planItem.asset);
}

/**
 * ยอดภาษี/ค่าธรรมเนียมที่แสดงในรายการเตรียมสภาพคล่อง
 * ไม่ดึงยอดจาก planItem.cost ที่เป็นภาษีมรดกปันส่วนมา — โชว์เฉพาะภาษี/ค่าธรรมเนียมจาก scenario
 */
function costBreakdownForItem(
  assetName: string,
  planItem: PlanItem,
  scenarios: Scenario[],
): AssetCostBreakdown | null {
  const scenario = findScenario(planItem, scenarios);
  if (!scenario) return null;
  const tax = scenario.tax;
  const fees = scenario.fees;
  if (tax <= 0 && fees <= 0) return null;
  return {
    name: assetName,
    tax,
    fees,
    total: scenario.total > 0 ? scenario.total : tax + fees,
  };
}

function pushRec(
  out: PlanRecommendation[],
  rec: PlanRecommendation,
) {
  const existing = out.find((r) => r.id === rec.id);
  if (existing) {
    existing.assets = uniqueNames([...existing.assets, ...rec.assets]);
    existing.costByAsset = mergeCostByAsset(
      existing.costByAsset,
      rec.costByAsset,
    );
    if (existing.costByAsset?.length) {
      existing.reason = refreshReasonWithCosts(existing.reason, existing.costByAsset);
    }
    return;
  }
  out.push({
    ...rec,
    assets: uniqueNames(rec.assets),
    costByAsset: rec.costByAsset
      ? mergeCostByAsset(undefined, rec.costByAsset)
      : undefined,
  });
}

/** อัปเดตส่วนยอดเงินใน reason ให้สะท้อนทุกรายการ */
function refreshReasonWithCosts(
  reason: string,
  costs: AssetCostBreakdown[],
): string {
  const prefix = reason.replace(/\s*\(.*\)\s*$/, "").trim();
  const base = prefix.startsWith("เงื่อนไข")
    ? prefix
    : reason.startsWith("เงื่อนไข")
      ? "เงื่อนไข: มรดก + มีภาษี/ค่าธรรมเนียมที่ต้องชำระ"
      : prefix;
  if (base.includes("มรดก + มีภาษี/ค่าธรรมเนียม")) {
    return `${base.replace(/\s*$/, "")} — ${formatCostBreakdown(costs)}`;
  }
  return `${base} — ${formatCostBreakdown(costs)}`;
}

/**
 * คำแนะนำแบบ Rule-based ตามข้อ 25.2
 * ใช้เฉพาะข้อมูลที่มีในแผน/ทรัพย์สิน — ไม่เดาข้อเท็จจริงเพิ่ม (ข้อ 25.3)
 */
export function buildPlanRecommendations(
  plan: PlanItem[],
  assets: Asset[],
  schedule: TimelineYear[] = [],
  scenarios: Scenario[] = [],
): PlanRecommendation[] {
  const out: PlanRecommendation[] = [];

  for (const item of plan) {
    const asset = findAsset(item, assets);
    const assetName = asset?.name || item.asset;
    const method = item.method;

    if (method === "มรดก") {
      pushRec(out, {
        id: "inherit-will",
        title: "จัดทำหรือทบทวนพินัยกรรม",
        advice:
          "ควรจัดทำหรือทบทวนพินัยกรรมให้สอดคล้องกับแผน เพื่อกำหนดผู้รับและทรัพย์สินให้ชัดเจน",
        reason: "เงื่อนไข: วิธีส่งต่อ = มรดก",
        level: "medium",
        assets: [assetName],
      });

      if (receiverCount(item.receiver) > 1) {
        pushRec(out, {
          id: "inherit-multi-receiver",
          title: "กำหนดผู้รับและสัดส่วนในพินัยกรรม",
          advice:
            "ควรกำหนดผู้รับและสัดส่วนของแต่ละคนในพินัยกรรมให้ชัดเจน เพื่อลดความไม่แน่นอนในการแบ่งทรัพย์",
          reason: "เงื่อนไข: มรดก + ผู้รับมากกว่า 1 คน",
          level: "medium",
          assets: [assetName],
        });
      }

      const costRow = costBreakdownForItem(assetName, item, scenarios);
      if (costRow) {
        pushRec(out, {
          id: "inherit-liquidity",
          title: "เตรียมสภาพคล่องกองมรดก",
          advice:
            "ควรเตรียมสภาพคล่องของกองมรดกสำหรับภาษี ค่าธรรมเนียม และค่าใช้จ่ายที่เกี่ยวข้อง",
          reason: `เงื่อนไข: มรดก + มีภาษี/ค่าธรรมเนียมที่ต้องชำระ — ${formatCostBreakdown([costRow])}`,
          level: "medium",
          assets: [assetName],
          costByAsset: [costRow],
        });
      }
    }

    if (isGiftMethod(method)) {
      const years = giftDurationYears(item);
      if (years > 1 || method === "ทยอยให้") {
        pushRec(out, {
          id: "gift-multi-year",
          title: "ทบทวนแผนการทยอยให้ทุกปี",
          advice:
            "การทยอยให้สามารถกระจายภาระภาษีตามช่วงเวลาได้ แต่ต้องดำเนินการต่อเนื่องหลายปีและควรทบทวนแผนทุกปี",
          reason: `เงื่อนไข: วิธีส่งต่อ = ${method} และจำนวนปี > 1 (${years} ปี)`,
          level: "info",
          assets: [assetName],
        });
      } else {
        pushRec(out, {
          id: "gift-single-year",
          title: "เปรียบเทียบกับการทยอยให้",
          advice:
            "ควรเปรียบเทียบภาระภาษีกับทางเลือกทยอยให้หลายปี ก่อนยืนยันการให้ทั้งหมดในครั้งเดียว",
          reason: "เงื่อนไข: วิธีส่งต่อ = ให้ และจำนวนปี = 1",
          level: "info",
          assets: [assetName],
        });
      }
    }

    if (method === "ซื้อขาย") {
      pushRec(out, {
        id: "sale-liquidity-check",
        title: "ตรวจสอบสภาพคล่องและต้นทุนการซื้อขาย",
        advice:
          "การซื้อขายทำให้การเปลี่ยนกรรมสิทธิ์ชัดเจน แต่ควรประเมินสภาพคล่องหรือแหล่งเงินของผู้ซื้อ และพิจารณาต้นทุนธุรกรรมรวมก่อนดำเนินการ",
        reason: "เงื่อนไข: วิธีส่งต่อ = ซื้อขาย",
        level: "medium",
        assets: [assetName],
      });

      if (hasInstallment(item, asset)) {
        pushRec(out, {
          id: "sale-installment",
          title: "กำหนดเงื่อนไขการผ่อนชำระให้ชัดเจน",
          advice:
            "ควรกำหนดเงินดาวน์ ระยะเวลาผ่อน เงื่อนไขการชำระ และผลกรณีผิดนัดให้ชัดเจน",
          reason: "เงื่อนไข: ซื้อขาย + รูปแบบชำระ = ผ่อนชำระ",
          level: "high",
          assets: [assetName],
        });
      }
    }

    if (isCompanyShare(asset, item)) {
      if (wantsRetainControl(asset)) {
        pushRec(out, {
          id: "company-control",
          title: "ตรวจสอบอำนาจควบคุมหลังส่งต่อ",
          advice:
            "ควรตรวจสอบสัดส่วนหุ้นและอำนาจควบคุมหลังการส่งต่อ รวมถึงสิทธิออกเสียงก่อนยืนยันแผน",
          reason:
            "เงื่อนไข: ประเภท = หุ้นส่วนบริษัท + ระบุว่าต้องการรักษาอำนาจควบคุม",
          level: "high",
          assets: [assetName],
        });
      }

      if (hasTransferRestriction(asset)) {
        pushRec(out, {
          id: "company-restriction",
          title: "ตรวจสอบข้อจำกัดการโอนหุ้น",
          advice:
            "ควรตรวจสอบข้อบังคับบริษัท ข้อตกลงผู้ถือหุ้น หรือสิทธิซื้อหุ้นก่อน ก่อนดำเนินการโอน",
          reason:
            "เงื่อนไข: ประเภท = หุ้นส่วนบริษัท + มีข้อจำกัดการโอน/สิทธิซื้อก่อน/ข้อบังคับ",
          level: "high",
          assets: [assetName],
        });
      }
    }

    if (isGiftMethod(method) && isIncomeAsset(asset)) {
      pushRec(out, {
        id: "income-gift",
        title: "พิจารณารักษารายได้ก่อนให้",
        advice:
          "หลังการให้ เจ้าของเดิมอาจสูญเสียสิทธิในรายได้จากทรัพย์สิน ควรพิจารณาความจำเป็นในการรักษารายได้ไว้ก่อนส่งต่อ",
        reason: "เงื่อนไข: ทรัพย์สินเพื่อสร้างรายได้ + วิธี = ให้",
        level: "medium",
        assets: [assetName],
      });
    }

    if (hasMortgageOrEncumbrance(asset)) {
      pushRec(out, {
        id: "encumbrance",
        title: "ตรวจสอบความยินยอมเจ้าหนี้",
        advice:
          "ควรตรวจสอบเงื่อนไขของเจ้าหนี้หรือคู่สัญญา และความยินยอมที่จำเป็นก่อนดำเนินการโอน",
        reason: "เงื่อนไข: ทรัพย์สินมีภาระจำนองหรือภาระผูกพัน",
        level: "high",
        assets: [assetName],
      });
    }

    if (hasJointOwners(asset)) {
      pushRec(out, {
        id: "joint-owners",
        title: "ตรวจสอบสิทธิผู้ถือกรรมสิทธิ์ร่วม",
        advice:
          "ควรตรวจสอบสิทธิและสัดส่วนของผู้ถือกรรมสิทธิ์ร่วม และดำเนินการเฉพาะส่วนที่เจ้าของมีสิทธิส่งต่อ",
        reason: "เงื่อนไข: ทรัพย์สินมีผู้ถือกรรมสิทธิ์ร่วมมากกว่า 1 คน",
        level: "high",
        assets: [assetName],
      });
    }
  }

  // แผนเดียวกันมีทั้งให้และมรดกสำหรับเจ้าของรายเดียวกัน
  const byOwner = new Map<string, Set<string>>();
  const ownerAssets = new Map<string, string[]>();
  for (const item of plan) {
    const owner = item.owner.trim() || "—";
    const methods = byOwner.get(owner) ?? new Set();
    methods.add(item.method);
    byOwner.set(owner, methods);
    const list = ownerAssets.get(owner) ?? [];
    list.push(item.asset);
    ownerAssets.set(owner, list);
  }
  for (const [owner, methods] of byOwner) {
    const hasGift = [...methods].some(isGiftMethod);
    const hasInherit = methods.has("มรดก");
    if (hasGift && hasInherit) {
      pushRec(out, {
        id: `mix-gift-inherit-${owner}`,
        title: "ปรับพินัยกรรมให้สอดคล้องกับของที่ให้แล้ว",
        advice:
          "ควรให้พินัยกรรมสอดคล้องกับทรัพย์สินที่ได้โอนไปแล้ว เพื่อไม่ให้รายการในพินัยกรรมซ้ำหรือขัดกับโครงสร้างทรัพย์สินปัจจุบัน",
        reason: `เงื่อนไข: แผนเดียวกันมีทั้ง “ให้” และ “มรดก” สำหรับเจ้าของ ${owner}`,
        level: "medium",
        assets: ownerAssets.get(owner) ?? [],
      });
    }
  }

  // จากตารางสรุปข้อ 25: รายการมูลค่าสูงกระจุกในปีเดียว
  if (schedule.length >= 2) {
    const peak = schedule.reduce((best, y) =>
      y.amount > best.amount ? y : best,
    );
    const total = schedule.reduce((s, y) => s + y.amount, 0);
    if (total > 0 && peak.amount / total >= 0.6 && peak.amount > 0) {
      const related = uniqueNames(
        peak.events.map((e) => e.title),
      );
      pushRec(out, {
        id: "cost-concentration",
        title: "กระจายภาระค่าใช้จ่ายหลายปี",
        advice:
          "ประเมินสภาพคล่องและพิจารณากระจายธุรกรรมหลายปี เมื่อภาระกระจุกในปีเดียวสูง",
        reason: `เงื่อนไข: รายการมูลค่าสูงกระจุกในปีเดียว (${yearLabel(peak.year)} ≈ ${Math.round((peak.amount / total) * 100)}% ของภาระรวม ${money(peak.amount)})`,
        level: "high",
        assets: related,
      });
    }
  }

  // ใบสภาพคล่องสร้างจากรายการที่มีภาษี/ค่าธรรมเนียมรายตัวเท่านั้น
  // แต่ภาษีมรดกคิดรวมระดับแผน — ควรแสดงทรัพย์มรดกทั้งหมดในแผน
  const liquidity = out.find((r) => r.id === "inherit-liquidity");
  if (liquidity) {
    const allInherit = plan
      .filter((i) => i.method === "มรดก")
      .map((i) => findAsset(i, assets)?.name || i.asset);
    liquidity.assets = uniqueNames([...liquidity.assets, ...allInherit]);
  }

  return dedupeOverlapping(out).sort((a, b) => {
    const rank = LEVEL_RANK[a.level] - LEVEL_RANK[b.level];
    if (rank !== 0) return rank;
    return a.title.localeCompare(b.title, "th");
  });
}

/**
 * รวมคำแนะนำเรื่องเดียวกันเหลือใบเดียว
 * เลือกข้อความจากกฎที่เฉพาะ/สำคัญกว่า แล้วรวมทรัพย์สิน + เงื่อนไข
 */
function dedupeOverlapping(
  items: PlanRecommendation[],
): PlanRecommendation[] {
  const list = items.map((r) => ({ ...r, assets: [...r.assets] }));

  /** กลุ่มเรื่องเดียวกัน — เรียงจากเฉพาะเจาะจง/สำคัญก่อน */
  const topicGroups: string[][] = [
    // พินัยกรรม / มรดก
    ["inherit-multi-receiver", "inherit-will", "mix-gift-inherit"],
    // ภาระค่าใช้จ่ายกระจุก / สภาพคล่องกองมรดก
    ["cost-concentration", "inherit-liquidity"],
    // ซื้อขาย
    ["sale-installment", "sale-liquidity-check"],
    // การให้ตามช่วงเวลา
    ["gift-multi-year", "gift-single-year"],
    // หุ้นบริษัท
    ["company-control", "company-restriction"],
  ];

  const used = new Set<string>();
  const merged: PlanRecommendation[] = [];

  for (const group of topicGroups) {
    const matched = list.filter((r) =>
      group.some((prefix) => r.id === prefix || r.id.startsWith(`${prefix}-`)),
    );
    if (matched.length === 0) continue;

    // เลือกใบหลักตามลำดับใน group
    let primary = matched[0];
    for (const prefix of group) {
      const hit = matched.find(
        (r) => r.id === prefix || r.id.startsWith(`${prefix}-`),
      );
      if (hit) {
        primary = hit;
        break;
      }
    }

    const assets = uniqueNames(matched.flatMap((r) => r.assets));
    const reasons = uniqueNames(matched.map((r) => r.reason));
    const costByAsset = matched.reduce<AssetCostBreakdown[] | undefined>(
      (acc, r) => mergeCostByAsset(acc, r.costByAsset),
      undefined,
    );
    const level = matched.reduce(
      (best, r) => (LEVEL_RANK[r.level] < LEVEL_RANK[best] ? r.level : best),
      primary.level,
    );

    let reason =
      reasons.length === 1
        ? reasons[0]
        : `เงื่อนไขรวม: ${reasons.map(stripReasonPrefix).join(" · ")}`;
    if (costByAsset?.length && primary.id === "inherit-liquidity") {
      reason = refreshReasonWithCosts(
        "เงื่อนไข: มรดก + มีภาษี/ค่าธรรมเนียมที่ต้องชำระ",
        costByAsset,
      );
    }

    merged.push({
      ...primary,
      id: primary.id,
      level,
      assets,
      costByAsset,
      reason,
    });

    for (const r of matched) used.add(r.id);
  }

  for (const r of list) {
    if (!used.has(r.id)) merged.push(r);
  }

  return merged;
}

function stripReasonPrefix(reason: string) {
  return reason.replace(/^เงื่อนไข:\s*/, "").trim();
}

function yearLabel(year: string) {
  return /^\d{4}$/.test(year) ? `พ.ศ. ${year}` : year;
}
