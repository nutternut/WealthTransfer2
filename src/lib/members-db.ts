import type { Member } from "@/data/wealth-transfer";
import { requireOwnerId } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase/client";

export type WealthMemberRow = {
  id: string;
  owner_id: string | null;
  name: string;
  gen: string;
  age: number;
  relation: string;
  status: string;
  partner_id: string | null;
  parent_ids: string[] | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function rowToMember(row: WealthMemberRow): Member {
  return {
    id: row.id,
    name: row.name,
    gen: row.gen,
    age: row.age,
    relation: row.relation,
    status: row.status,
    partnerId: row.partner_id ?? undefined,
    parentIds:
      row.parent_ids && row.parent_ids.length > 0
        ? row.parent_ids
        : undefined,
  };
}

function toUpsertRow(
  member: Member,
  sortOrder: number,
  ownerId: string,
) {
  return {
    id: member.id,
    owner_id: ownerId,
    name: member.name,
    gen: member.gen,
    age: member.age,
    relation: member.relation,
    status: member.status,
    partner_id: member.partnerId ?? null,
    parent_ids: member.parentIds ?? [],
    sort_order: sortOrder,
    deleted_at: null as string | null,
  };
}

export async function fetchMembers(): Promise<Member[]> {
  const supabase = getSupabase();
  const ownerId = await requireOwnerId();
  const { data, error } = await supabase
    .from("wealth_members")
    .select("*")
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as WealthMemberRow[]).map(rowToMember);
}

/** รหัสสมาชิกถัดไปจาก RPC — unique ทั้งตาราง กันชนข้ามบัญชี */
export async function nextMemberId(): Promise<string> {
  const supabase = getSupabase();
  const ownerId = await requireOwnerId();
  const { data, error } = await supabase.rpc("wealth_next_member_id", {
    p_owner_id: ownerId,
  });
  if (error) throw new Error(error.message);
  if (typeof data !== "string" || !data) {
    throw new Error("สร้างรหัสสมาชิกไม่สำเร็จ");
  }
  return data;
}

/**
 * บันทึก snapshot ทั้งชุด (สร้าง/แก้/ลำดับ/ความสัมพันธ์)
 * ใช้ 2 เฟสเพื่อหลีกเลี่ยง FK คู่สมรสวนกัน
 * ห้าม upsert ทับแถวของ owner อื่น (เคยทำให้ชื่อผู้ถือกรรมสิทธิ์เพี้ยนข้ามบัญชี)
 */
export async function persistMembers(members: Member[]): Promise<void> {
  const supabase = getSupabase();
  const ownerId = await requireOwnerId();
  const rows = members.map((m, i) => toUpsertRow(m, i + 1, ownerId));
  const ids = rows.map((r) => r.id);

  if (ids.length > 0) {
    const { data: foreign, error: foreignError } = await supabase
      .from("wealth_members")
      .select("id")
      .in("id", ids)
      .neq("owner_id", ownerId);
    if (foreignError) throw new Error(foreignError.message);
    if (foreign && foreign.length > 0) {
      throw new Error(
        "รหัสสมาชิกชนกับบัญชีอื่น — รีเฟรชหน้าแล้วเพิ่มสมาชิกใหม่",
      );
    }
  }

  const withoutPartners = rows.map((r) => ({ ...r, partner_id: null }));
  const { error: phase1 } = await supabase
    .from("wealth_members")
    .upsert(withoutPartners, { onConflict: "id" });
  if (phase1) throw new Error(phase1.message);

  const { error: phase2 } = await supabase
    .from("wealth_members")
    .upsert(rows, { onConflict: "id" });
  if (phase2) throw new Error(phase2.message);
}

/**
 * ลบสมาชิก + เคลียร์ความสัมพันธ์ / ผู้ถือกรรมสิทธิ์ที่อ้างถึง
 * ใช้ hard DELETE เพราะ soft-delete (ตั้ง deleted_at) ถูก RLS with check บน remote บล็อกอยู่
 * (รัน supabase/sql/wealth_members_rls_anon_fix.sql แล้วค่อยกลับไป soft-delete ได้)
 */
export async function softDeleteMember(id: string): Promise<void> {
  const supabase = getSupabase();
  const ownerId = await requireOwnerId();

  // FK wealth_asset_owners.member_id → wealth_members (ON DELETE RESTRICT)
  const { error: ownersError } = await supabase
    .from("wealth_asset_owners")
    .delete()
    .eq("member_id", id)
    .eq("owner_id", ownerId);
  if (ownersError) throw new Error(ownersError.message);

  const { data: others, error: fetchError } = await supabase
    .from("wealth_members")
    .select("id, partner_id, parent_ids")
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .neq("id", id);

  if (fetchError) throw new Error(fetchError.message);

  const touched = (
    (others ?? []) as Pick<WealthMemberRow, "id" | "partner_id" | "parent_ids">[]
  ).filter(
    (row) =>
      row.partner_id === id || (row.parent_ids ?? []).includes(id),
  );

  for (const row of touched) {
    const { error } = await supabase
      .from("wealth_members")
      .update({
        partner_id: row.partner_id === id ? null : row.partner_id,
        parent_ids: (row.parent_ids ?? []).filter((p) => p !== id),
      })
      .eq("id", row.id)
      .eq("owner_id", ownerId);
    if (error) throw new Error(error.message);
  }

  // ตัด self-FK ก่อนลบ กันวงอ้างอิงคู่สมรส
  const { error: clearError } = await supabase
    .from("wealth_members")
    .update({ partner_id: null, parent_ids: [] })
    .eq("id", id)
    .eq("owner_id", ownerId);
  if (clearError) throw new Error(clearError.message);

  const { error } = await supabase
    .from("wealth_members")
    .delete()
    .eq("id", id)
    .eq("owner_id", ownerId);

  if (error) throw new Error(error.message);
}

/** @deprecated ใช้ nextMemberId() (RPC) แทน — local counter ชน id ข้ามบัญชีได้ */
export function nextMemberIdFromList(existing: Member[]) {
  const max = existing.reduce((n, m) => {
    const match = /^M(\d+)$/.exec(m.id);
    return match ? Math.max(n, Number(match[1])) : n;
  }, 0);
  return `M${max + 1}`;
}
