import type { PlanItem, Scenario, ScenarioCriteria } from "@/data/wealth-transfer";
import { requireOwnerId } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase/client";
import type { WizardReceiver } from "@/lib/scenario-store";

type ScenarioRow = {
  id: string;
  asset_id: string;
  method: string;
  year_label: string;
  transfer_share_pct: number | string;
  market_value: number | string;
  tax_amount: number | string;
  fees_amount: number | string;
  total_amount: number | string;
  score: number | string;
  status: string;
  criteria: ScenarioCriteria | null;
  receivers: WizardReceiver[] | null;
  wealth_assets?: { name: string } | { name: string }[] | null;
};

type PlanItemRow = {
  id: string;
  asset_id: string;
  scenario_id: string | null;
  owner_name: string;
  receiver_label: string;
  method: string;
  share_label: string;
  year_label: string;
  cost_amount: number | string;
  status: string;
  wealth_assets?: { name: string } | { name: string }[] | null;
};

export type AssetPlanFlags = {
  hasPlan: boolean;
  hasScenario: boolean;
};

function num(v: number | string | null | undefined, fallback = 0): number {
  if (v == null || v === "") return fallback;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function assetNameFromJoin(
  join: ScenarioRow["wealth_assets"] | PlanItemRow["wealth_assets"],
): string {
  if (!join) return "";
  if (Array.isArray(join)) return join[0]?.name?.trim() || "";
  return join.name?.trim() || "";
}

function rowToScenario(row: ScenarioRow): Scenario {
  const receivers = Array.isArray(row.receivers) ? row.receivers : [];
  return {
    id: row.id,
    asset: assetNameFromJoin(row.wealth_assets) || row.asset_id,
    assetId: row.asset_id,
    method: row.method,
    year: row.year_label,
    receiver: receivers.map((r) => r.name).filter(Boolean).join(" + ") || "—",
    tax: num(row.tax_amount),
    fees: num(row.fees_amount),
    total: num(row.total_amount),
    score: num(row.score),
    status: row.status,
    criteria: row.criteria ?? {
      taxEfficiency: 3,
      control: 3,
      liquidity: 3,
      readiness: 3,
    },
    transferShare: num(row.transfer_share_pct),
    marketValue: num(row.market_value),
    receivers: receivers.map((r) => ({
      name: r.name,
      share: num(r.share),
      memberId: r.memberId,
      relation: r.relation,
      taxClass: r.taxClass,
      occasion: r.occasion,
    })),
  };
}

function rowToPlanItem(row: PlanItemRow): PlanItem {
  return {
    id: row.id,
    asset: assetNameFromJoin(row.wealth_assets) || row.asset_id,
    assetId: row.asset_id,
    scenarioId: row.scenario_id ?? undefined,
    owner: row.owner_name,
    receiver: row.receiver_label,
    method: row.method,
    share: row.share_label,
    year: row.year_label,
    cost: num(row.cost_amount),
    status: row.status,
  };
}

async function nextScenarioId(ownerId: string): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("wealth_next_scenario_id", {
    p_owner_id: ownerId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

async function nextPlanItemId(ownerId: string): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("wealth_next_plan_item_id", {
    p_owner_id: ownerId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function fetchScenarios(): Promise<Scenario[]> {
  const supabase = getSupabase();
  const ownerId = await requireOwnerId();
  const { data, error } = await supabase
    .from("wealth_scenarios")
    .select("*, wealth_assets(name)")
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ScenarioRow[]).map(rowToScenario);
}

/** สถานการณ์ล่าสุดของทรัพย์ — ใช้เติมผู้รับ/วิธีโอนเมื่อเปิด wizard ซ้ำ */
export async function fetchLatestScenarioForAsset(
  assetId: string,
): Promise<Scenario | null> {
  if (!assetId) return null;
  const supabase = getSupabase();
  const ownerId = await requireOwnerId();
  const { data, error } = await supabase
    .from("wealth_scenarios")
    .select("*, wealth_assets(name)")
    .eq("owner_id", ownerId)
    .eq("asset_id", assetId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowToScenario(data as ScenarioRow);
}

export async function createScenario(input: {
  assetId: string;
  assetName: string;
  method: string;
  year: string;
  transferShare: number;
  marketValue: number;
  tax: number;
  fees: number;
  total: number;
  score: number;
  status?: string;
  criteria: ScenarioCriteria;
  receivers: WizardReceiver[];
}): Promise<Scenario> {
  const supabase = getSupabase();
  const ownerId = await requireOwnerId();
  const id = await nextScenarioId(ownerId);

  const { count, error: countError } = await supabase
    .from("wealth_scenarios")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .is("deleted_at", null);
  if (countError) throw new Error(countError.message);

  const { error } = await supabase.from("wealth_scenarios").insert({
    id,
    owner_id: ownerId,
    asset_id: input.assetId,
    method: input.method,
    year_label: input.year,
    transfer_share_pct: input.transferShare,
    market_value: input.marketValue,
    tax_amount: input.tax,
    fees_amount: input.fees,
    total_amount: input.total,
    score: input.score,
    status: input.status ?? "คำนวณแล้ว",
    criteria: input.criteria,
    receivers: input.receivers,
    sort_order: (count ?? 0) + 1,
  });
  if (error) throw new Error(error.message);

  return {
    id,
    asset: input.assetName,
    assetId: input.assetId,
    method: input.method,
    year: input.year,
    receiver: input.receivers.map((r) => r.name).join(" + "),
    tax: input.tax,
    fees: input.fees,
    total: input.total,
    score: input.score,
    status: input.status ?? "คำนวณแล้ว",
    criteria: input.criteria,
    transferShare: input.transferShare,
    marketValue: input.marketValue,
    receivers: input.receivers,
  };
}

export async function fetchPlanItems(): Promise<PlanItem[]> {
  const supabase = getSupabase();
  const ownerId = await requireOwnerId();
  const { data, error } = await supabase
    .from("wealth_plan_items")
    .select("*, wealth_assets(name)")
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as PlanItemRow[]).map(rowToPlanItem);
}

export async function addPlanItem(input: {
  assetId: string;
  assetName: string;
  scenarioId?: string;
  owner: string;
  receiver: string;
  method: string;
  share: string;
  year: string;
  cost: number;
  status?: string;
}): Promise<PlanItem> {
  const supabase = getSupabase();
  const ownerId = await requireOwnerId();
  const status = input.status ?? "เลือกเข้าสู่แผนแล้ว";
  const payload = {
    asset_id: input.assetId,
    scenario_id: input.scenarioId ?? null,
    owner_name: input.owner,
    receiver_label: input.receiver,
    method: input.method,
    share_label: input.share,
    year_label: input.year,
    cost_amount: input.cost,
    status,
  };

  // หนึ่งแผนต่อทรัพย์ — มีอยู่แล้วให้อัปเดต ไม่ insert ซ้ำ
  const { data: existing, error: findError } = await supabase
    .from("wealth_plan_items")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("asset_id", input.assetId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (findError) throw new Error(findError.message);

  if (existing?.id) {
    const { error } = await supabase
      .from("wealth_plan_items")
      .update(payload)
      .eq("id", existing.id)
      .eq("owner_id", ownerId)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);

    // ลบรายการซ้ำของทรัพย์เดียวกัน (ถ้ามีจาก insert เก่า)
    await supabase
      .from("wealth_plan_items")
      .delete()
      .eq("owner_id", ownerId)
      .eq("asset_id", input.assetId)
      .neq("id", existing.id);

    return {
      id: existing.id,
      asset: input.assetName,
      assetId: input.assetId,
      scenarioId: input.scenarioId,
      owner: input.owner,
      receiver: input.receiver,
      method: input.method,
      share: input.share,
      year: input.year,
      cost: input.cost,
      status,
    };
  }

  const id = await nextPlanItemId(ownerId);
  const { count, error: countError } = await supabase
    .from("wealth_plan_items")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .is("deleted_at", null);
  if (countError) throw new Error(countError.message);

  const { error } = await supabase.from("wealth_plan_items").insert({
    id,
    owner_id: ownerId,
    ...payload,
    sort_order: (count ?? 0) + 1,
  });
  if (error) throw new Error(error.message);

  return {
    id,
    asset: input.assetName,
    assetId: input.assetId,
    scenarioId: input.scenarioId,
    owner: input.owner,
    receiver: input.receiver,
    method: input.method,
    share: input.share,
    year: input.year,
    cost: input.cost,
    status,
  };
}

/** ล้างแผน + สถานการณ์ — hard delete (soft-delete ถูก RLS บล็อกบน remote) */
export async function clearPlanData(): Promise<void> {
  const supabase = getSupabase();
  const ownerId = await requireOwnerId();

  const { error: planError } = await supabase
    .from("wealth_plan_items")
    .delete()
    .eq("owner_id", ownerId);
  if (planError) throw new Error(planError.message);

  const { error: scenarioError } = await supabase
    .from("wealth_scenarios")
    .delete()
    .eq("owner_id", ownerId);
  if (scenarioError) throw new Error(scenarioError.message);
}

/** ธงสถานะแผนต่อ asset_id — สำหรับ derive Asset.status */
export async function fetchAssetPlanFlags(): Promise<
  Map<string, AssetPlanFlags>
> {
  const supabase = getSupabase();
  const map = new Map<string, AssetPlanFlags>();

  const { data, error } = await supabase
    .from("wealth_asset_plan_status")
    .select("asset_id, has_plan, has_scenario");

  if (error) {
    // ถ้ายังไม่ได้รัน SQL view — fallback ว่าง (สถานะยังไม่ได้วางแผนทั้งหมด)
    if (/wealth_asset_plan_status|does not exist|schema cache/i.test(error.message)) {
      return map;
    }
    throw new Error(error.message);
  }

  for (const row of data ?? []) {
    const r = row as {
      asset_id: string;
      has_plan: boolean;
      has_scenario: boolean;
    };
    map.set(r.asset_id, {
      hasPlan: Boolean(r.has_plan),
      hasScenario: Boolean(r.has_scenario),
    });
  }
  return map;
}
