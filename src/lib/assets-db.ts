import type { Asset, AssetOwnerEntry, AssetStatus } from "@/data/wealth-transfer";
import type { OwnerKind } from "@/data/asset-taxonomy";
import { requireOwnerId } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase/client";
import { fetchMembers } from "@/lib/members-db";
import { fetchAssetPlanFlags } from "@/lib/plans-db";
import type { AssetPlanFlags } from "@/lib/plans-db";

export type AssetFormInput = Omit<Asset, "id" | "status" | "owners"> & {
  note?: string;
  /** รายการผู้ถือ — ถ้าไม่ส่ง ใช้ owner/ownerKind/share เดี่ยว */
  holders?: AssetOwnerEntry[];
};

type AssetAttrs = {
  assessed_per_sq_wa?: number;
  registered_capital?: number;
  par_value?: number;
  book_value?: number;
  note?: string;
  ownership_status?: string;
  asset_code?: string;
  shares_held?: number;
  [key: string]: unknown;
};

type OwnerJson = {
  id: string;
  holder_kind: OwnerKind;
  member_id: string | null;
  entity_id: string | null;
  share_pct: number;
  holder_name: string | null;
  sort_order: number;
};

type AssetWithOwnersRow = {
  id: string;
  owner_id: string | null;
  name: string;
  category: string;
  subtype: string | null;
  detail: string | null;
  role: string | null;
  method: string | null;
  acquired_year: number | null;
  transfer_year: number | null;
  value_amount: number | string | null;
  value_unit: string;
  assessed_amount: number | string | null;
  assessed_unit: string;
  cost_amount: number | string | null;
  cost_unit: string;
  area_rai: number | string | null;
  area_ngan: number | string | null;
  area_sq_wa: number | string | null;
  attrs: AssetAttrs | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  owners: OwnerJson[] | null;
};

function optionalNum(
  v: number | string | null | undefined,
): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function num(v: number | string | null | undefined, fallback = 0): number {
  return optionalNum(v) ?? fallback;
}

function formatArea(
  rai: number | string | null,
  ngan: number | string | null,
  sqWa: number | string | null,
): string | undefined {
  if (rai == null && ngan == null && sqWa == null) return undefined;
  const r = num(rai);
  const n = num(ngan);
  const w = num(sqWa);
  if (r === 0 && n === 0 && w === 0) return undefined;
  return `${r}-${n}-${w}`;
}

/** แปลง "2-1-20" หรือ "2-1-20.5" → คอลัมน์แยก */
export function parseArea(area?: string): {
  area_rai: number | null;
  area_ngan: number | null;
  area_sq_wa: number | null;
} {
  if (!area?.trim()) {
    return { area_rai: null, area_ngan: null, area_sq_wa: null };
  }
  const parts = area.trim().split(/[-–—\s]+/).filter(Boolean);
  if (parts.length === 0) {
    return { area_rai: null, area_ngan: null, area_sq_wa: null };
  }
  return {
    area_rai: parts[0] != null ? num(parts[0]) : null,
    area_ngan: parts[1] != null ? num(parts[1]) : null,
    area_sq_wa: parts[2] != null ? num(parts[2]) : null,
  };
}

function yearOrNull(acquired: string | undefined): number | null {
  if (!acquired || acquired === "-") return null;
  const m = /(\d{4})/.exec(acquired.trim());
  if (!m) return null;
  let y = Number(m[1]);
  // รับทั้ง พ.ศ. และ ค.ศ. (แปลงเป็น พ.ศ.)
  if (y >= 1800 && y <= 2200) y += 543;
  return y >= 2400 && y <= 2800 ? y : null;
}

/** อัปเดตข้อมูลภาษี/สมมติฐานของทรัพย์โดยไม่แตะผู้ถือ */
export async function patchAssetTaxFacts(
  id: string,
  facts: {
    acquired?: string;
    method?: string;
    assessed?: number;
    cost?: number;
    value?: number;
  },
): Promise<void> {
  const supabase = getSupabase();
  const patch: Record<string, unknown> = {};

  if (facts.acquired != null) {
    const raw = facts.acquired.trim();
    if (!raw || raw === "-") {
      patch.acquired_year = null;
    } else {
      const y = yearOrNull(raw);
      if (y == null) {
        throw new Error("ปีที่ได้มาไม่ถูกต้อง — ใช้ พ.ศ. เช่น 2545");
      }
      patch.acquired_year = y;
    }
  }
  if (facts.method != null && facts.method.trim()) {
    patch.method = facts.method.trim();
  }
  if (facts.assessed != null && Number.isFinite(facts.assessed)) {
    patch.assessed_amount = facts.assessed;
    patch.assessed_unit = "บาท";
  }
  if (facts.cost != null && Number.isFinite(facts.cost)) {
    patch.cost_amount = facts.cost;
    patch.cost_unit = "บาท";
  }
  if (facts.value != null && Number.isFinite(facts.value)) {
    patch.value_amount = facts.value;
    patch.value_unit = "บาท";
  }

  if (Object.keys(patch).length === 0) return;

  const ownerId = await requireOwnerId();
  const { error } = await supabase
    .from("wealth_assets")
    .update(patch)
    .eq("id", id)
    .eq("owner_id", ownerId)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
}

function buildAttrs(input: AssetFormInput): AssetAttrs {
  const attrs: AssetAttrs = {};
  if (input.note?.trim()) attrs.note = input.note.trim();
  if (input.assessedPerSqWa != null) attrs.assessed_per_sq_wa = input.assessedPerSqWa;
  if (input.registeredCapital != null) attrs.registered_capital = input.registeredCapital;
  if (input.parValue != null) attrs.par_value = input.parValue;
  if (input.bookValue != null) attrs.book_value = input.bookValue;
  if (input.ownershipStatus?.trim()) attrs.ownership_status = input.ownershipStatus.trim();
  if (input.assetCode?.trim()) attrs.asset_code = input.assetCode.trim();
  return attrs;
}

function statusFromFlags(flags?: AssetPlanFlags): AssetStatus {
  // มีสถานการณ์หรือรายการแผนแล้ว = วางแผนเสร็จ
  if (flags?.hasPlan || flags?.hasScenario) return "มีแผนแล้ว";
  return "ยังไม่ได้วางแผน";
}

function rowToAsset(
  row: AssetWithOwnersRow,
  flags?: AssetPlanFlags,
): Asset {
  const owners = [...(row.owners ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
  );
  const primary = owners[0];
  const attrs = row.attrs ?? {};
  const status = statusFromFlags(flags);

  const ownerEntries: AssetOwnerEntry[] = owners
    .filter((o) => o.holder_name?.trim())
    .map((o) => ({
      ownerKind: o.holder_kind,
      owner: o.holder_name!.trim(),
      share: num(o.share_pct, 0),
    }));

  // สัดส่วนของทรัพย์ = รวมผู้ถือทั้งหมด (ถือร่วม 3 คน คนละ ~33.33% → 100%)
  const totalShare =
    ownerEntries.length > 0
      ? ownerEntries.reduce((s, o) => s + o.share, 0)
      : num(primary?.share_pct, 100);
  const shareRounded =
    Math.abs(100 - totalShare) < 0.05
      ? 100
      : Math.round(totalShare * 1000) / 1000;

  return {
    id: row.id,
    name: row.name,
    type: row.category,
    subtype: row.subtype ?? undefined,
    detail: row.detail ?? undefined,
    owner: primary?.holder_name?.trim() || "—",
    ownerKind: primary?.holder_kind,
    owners: ownerEntries.length > 0 ? ownerEntries : undefined,
    value: optionalNum(row.value_amount),
    share: Math.min(100, Math.max(0, shareRounded)),
    status,
    role: row.role ?? "",
    assessed: optionalNum(row.assessed_amount),
    cost: optionalNum(row.cost_amount),
    acquired:
      row.acquired_year != null ? String(row.acquired_year) : "-",
    method: row.method ?? "",
    transferYear:
      row.transfer_year != null ? String(row.transfer_year) : undefined,
    area: formatArea(row.area_rai, row.area_ngan, row.area_sq_wa),
    assessedPerSqWa: optionalNum(attrs.assessed_per_sq_wa),
    registeredCapital: optionalNum(attrs.registered_capital),
    parValue: optionalNum(attrs.par_value),
    bookValue: optionalNum(attrs.book_value),
    note: typeof attrs.note === "string" ? attrs.note : undefined,
    ownershipStatus:
      typeof attrs.ownership_status === "string"
        ? attrs.ownership_status
        : undefined,
    assetCode:
      typeof attrs.asset_code === "string" ? attrs.asset_code : undefined,
  };
}

export async function fetchAssets(): Promise<Asset[]> {
  const supabase = getSupabase();
  const ownerId = await requireOwnerId();
  const [assetsResult, flags] = await Promise.all([
    supabase
      .from("wealth_assets_with_owners")
      .select("*")
      .eq("owner_id", ownerId)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    fetchAssetPlanFlags(),
  ]);

  if (assetsResult.error) throw new Error(assetsResult.error.message);
  return ((assetsResult.data ?? []) as AssetWithOwnersRow[]).map((row) =>
    rowToAsset(row, flags.get(row.id)),
  );
}

export async function fetchAssetById(id: string): Promise<Asset | null> {
  const supabase = getSupabase();
  const ownerId = await requireOwnerId();
  const [assetResult, flags] = await Promise.all([
    supabase
      .from("wealth_assets_with_owners")
      .select("*")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle(),
    fetchAssetPlanFlags(),
  ]);

  if (assetResult.error) throw new Error(assetResult.error.message);
  if (!assetResult.data) return null;
  const row = assetResult.data as AssetWithOwnersRow;
  return rowToAsset(row, flags.get(row.id));
}

export function nextAssetIdFromList(existing: Asset[]) {
  const max = existing.reduce((n, a) => {
    const match = /^A(\d+)$/.exec(a.id);
    return match ? Math.max(n, Number(match[1])) : n;
  }, 0);
  return `A${max + 1}`;
}

async function nextAssetId(ownerId: string): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("wealth_next_asset_id", {
    p_owner_id: ownerId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

async function nextEntityId(ownerId: string): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("wealth_next_entity_id", {
    p_owner_id: ownerId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

async function nextAssetOwnerId(ownerId: string): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("wealth_next_asset_owner_id", {
    p_owner_id: ownerId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

async function resolveEntityId(name: string, ownerId: string): Promise<string> {
  const supabase = getSupabase();
  const trimmed = name.trim();
  const { data: existing, error: findError } = await supabase
    .from("wealth_entities")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("name", trimmed)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (findError) throw new Error(findError.message);
  if (existing?.id) return existing.id as string;

  const id = await nextEntityId(ownerId);
  const { error } = await supabase.from("wealth_entities").insert({
    id,
    owner_id: ownerId,
    name: trimmed,
    kind: "บริษัทจำกัด",
    sort_order: 0,
  });
  if (error) throw new Error(error.message);
  return id;
}

function isDuplicateKeyError(message: string) {
  return /duplicate key|unique constraint/i.test(message);
}

/**
 * บันทึกทรัพย์สินใหม่ + ผู้ถือกรรมสิทธิ์ (รองรับถือร่วมหลายคน)
 */
export async function createAsset(input: AssetFormInput): Promise<Asset> {
  const supabase = getSupabase();
  const ownerId = await requireOwnerId();
  const holders = normalizeHolders(input);

  const { count, error: countError } = await supabase
    .from("wealth_assets")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .is("deleted_at", null);
  if (countError) throw new Error(countError.message);

  const sortOrder = (count ?? 0) + 1;
  const row = assetRowFromInput(input);
  let lastError = "สร้างรหัสทรัพย์สินไม่สำเร็จ";

  // retry เมื่อ race / id เก่าจากฟังก์ชัน next-id ที่ยังไม่แพตช์
  for (let attempt = 0; attempt < 5; attempt++) {
    const assetId = await nextAssetId(ownerId);
    const { error: assetError } = await supabase.from("wealth_assets").insert({
      id: assetId,
      owner_id: ownerId,
      ...row,
      sort_order: sortOrder,
    });

    if (!assetError) {
      await insertOwners(assetId, holders, ownerId);
      const created = await fetchAssetById(assetId);
      if (!created) throw new Error("บันทึกแล้ว แต่โหลดทรัพย์สินกลับไม่สำเร็จ");
      return created;
    }

    lastError = assetError.message;
    if (!isDuplicateKeyError(assetError.message)) {
      throw new Error(assetError.message);
    }
  }

  throw new Error(lastError);
}

function normalizeHolders(input: AssetFormInput): AssetOwnerEntry[] {
  if (input.holders && input.holders.length > 0) {
    return input.holders.map((h) => ({
      ownerKind: h.ownerKind ?? "บุคคลธรรมดา",
      owner: h.owner.trim(),
      share: Math.min(100, Math.max(0.0001, Number(h.share) || 0)),
    }));
  }
  return [
    {
      ownerKind: input.ownerKind ?? "บุคคลธรรมดา",
      owner: input.owner.trim(),
      share: Math.min(100, Math.max(0.0001, Number(input.share) || 100)),
    },
  ];
}

async function insertOwners(
  assetId: string,
  holders: AssetOwnerEntry[],
  ownerId: string,
) {
  const supabase = getSupabase();
  const members = await fetchMembers();

  for (let i = 0; i < holders.length; i++) {
    const entry = holders[i]!;
    const holderKind: OwnerKind = entry.ownerKind ?? "บุคคลธรรมดา";
    let memberId: string | null = null;
    let entityId: string | null = null;
    let externalName: string | null = null;

    if (holderKind === "บุคคลธรรมดา") {
      const match = members.find((m) => m.name === entry.owner);
      if (!match) {
        throw new Error(
          `ไม่พบสมาชิก "${entry.owner}" ในฐานข้อมูล — เพิ่มสมาชิกก่อน`,
        );
      }
      memberId = match.id;
    } else if (holderKind === "คนนอก") {
      externalName = entry.owner.trim();
      if (!externalName) {
        throw new Error("กรุณาระบุชื่อคนนอก");
      }
    } else {
      entityId = await resolveEntityId(entry.owner, ownerId);
    }

    let lastError = "สร้างรหัสผู้ถือกรรมสิทธิ์ไม่สำเร็จ";
    let inserted = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const id = await nextAssetOwnerId(ownerId);
      const { error } = await supabase.from("wealth_asset_owners").insert({
        id,
        owner_id: ownerId,
        asset_id: assetId,
        holder_kind: holderKind,
        member_id: memberId,
        entity_id: entityId,
        external_name: externalName,
        share_pct: entry.share,
        sort_order: i + 1,
      });
      if (!error) {
        inserted = true;
        break;
      }
      lastError = error.message;
      if (!isDuplicateKeyError(error.message)) {
        throw new Error(error.message);
      }
    }
    if (!inserted) throw new Error(lastError);
  }
}

function assetRowFromInput(input: AssetFormInput) {
  const area = parseArea(input.area);
  return {
    name: input.name.trim(),
    category: input.type,
    subtype: input.subtype ?? null,
    detail: input.detail?.trim() || null,
    role: input.role || null,
    method: input.method || null,
    acquired_year: yearOrNull(input.acquired),
    transfer_year: yearOrNull(input.transferYear),
    value_amount: input.value ?? null,
    value_unit: "บาท",
    assessed_amount: input.assessed ?? null,
    assessed_unit: "บาท",
    cost_amount: input.cost ?? null,
    cost_unit: "บาท",
    area_rai: area.area_rai,
    area_ngan: area.area_ngan,
    area_sq_wa: area.area_sq_wa,
    attrs: buildAttrs(input),
  };
}

/**
 * แก้ไขทรัพย์สิน + แทนที่รายการผู้ถือทั้งหมด (รองรับถือร่วม)
 */
export async function updateAsset(
  id: string,
  input: AssetFormInput,
): Promise<Asset> {
  const supabase = getSupabase();
  const ownerId = await requireOwnerId();
  const holders = normalizeHolders(input);

  const { error: assetError } = await supabase
    .from("wealth_assets")
    .update(assetRowFromInput(input))
    .eq("id", id)
    .eq("owner_id", ownerId)
    .is("deleted_at", null);
  if (assetError) throw new Error(assetError.message);

  const { error: delError } = await supabase
    .from("wealth_asset_owners")
    .delete()
    .eq("asset_id", id)
    .eq("owner_id", ownerId);
  if (delError) throw new Error(delError.message);

  await insertOwners(id, holders, ownerId);

  const updated = await fetchAssetById(id);
  if (!updated) throw new Error("อัปเดตแล้ว แต่โหลดทรัพย์สินกลับไม่สำเร็จ");
  return updated;
}

/**
 * ลบทรัพย์สิน + ผู้ถือกรรมสิทธิ์ / สถานการณ์ / รายการในแผน (FK cascade)
 * ใช้ hard DELETE เพราะ soft-delete (ตั้ง deleted_at) ถูก RLS with check บน remote บล็อกอยู่
 */
export async function softDeleteAsset(id: string): Promise<void> {
  const supabase = getSupabase();
  const ownerId = await requireOwnerId();

  const { error: ownersError } = await supabase
    .from("wealth_asset_owners")
    .delete()
    .eq("asset_id", id)
    .eq("owner_id", ownerId);
  if (ownersError) throw new Error(ownersError.message);

  const { error } = await supabase
    .from("wealth_assets")
    .delete()
    .eq("id", id)
    .eq("owner_id", ownerId);

  if (error) throw new Error(error.message);
}

export async function softDeleteAssets(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  if (ids.length === 1) {
    await softDeleteAsset(ids[0]!);
    return;
  }

  const supabase = getSupabase();
  const ownerId = await requireOwnerId();

  const { error: ownersError } = await supabase
    .from("wealth_asset_owners")
    .delete()
    .in("asset_id", ids)
    .eq("owner_id", ownerId);
  if (ownersError) throw new Error(ownersError.message);

  const { error } = await supabase
    .from("wealth_assets")
    .delete()
    .in("id", ids)
    .eq("owner_id", ownerId);
  if (error) throw new Error(error.message);
}
