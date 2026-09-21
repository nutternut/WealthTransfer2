import { getSupabase } from "@/lib/supabase/client";
import { getStoredUsername } from "@/lib/auth";

export type AdminUserRow = {
  userId: string;
  username: string;
  displayName: string | null;
  isActive: boolean;
  isAdmin: boolean;
  familyId: string | null;
  familyName: string | null;
  createdAt: string;
};

export type AdminFamilyRow = {
  familyId: string;
  name: string;
  ownerUsername: string;
  ownerDisplayName: string | null;
  createdAt: string;
};

export type AdminStats = {
  userCount: number;
  familyCount: number;
  adminCount: number;
  activeUserCount: number;
};

function actorUsername() {
  const username = getStoredUsername();
  if (!username) throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  return username;
}

function rpcMessage(error: { message?: string } | null, fallback: string) {
  const raw = error?.message ?? "";
  if (raw.includes("ไม่มีสิทธิ์")) return "ไม่มีสิทธิ์ผู้ดูแลระบบ";
  if (raw.includes("ห้ามปิด")) return "ห้ามปิดหรือเปิดบัญชีของตัวเอง";
  if (raw.includes("ห้ามลบบัญชี")) return "ห้ามลบบัญชีของตัวเอง";
  if (raw.includes("ห้ามถอนสิทธิ์ผู้ดูแลของตัวเอง"))
    return "ห้ามถอนสิทธิ์ผู้ดูแลของตัวเอง";
  if (raw.includes("ห้ามถอนสิทธิ์ผู้ดูแลคนสุดท้าย"))
    return "ห้ามถอนสิทธิ์ผู้ดูแลคนสุดท้าย";
  if (raw.includes("ห้ามลบผู้ดูแลคนสุดท้าย")) return "ห้ามลบผู้ดูแลคนสุดท้าย";
  if (raw.includes("ถูกใช้แล้ว")) return "username นี้ถูกใช้แล้ว";
  if (raw.includes("ใช้ได้เฉพาะ"))
    return "username ใช้ได้เฉพาะ a-z, 0-9, _ ความยาว 3–32 ตัว";
  if (raw.includes("สั้นเกินไป")) return "รหัสผ่านสั้นเกินไป";
  if (raw.includes("ไม่พบ username")) return raw.replace(/^.*ไม่พบ/, "ไม่พบ");
  if (raw.includes("ไม่พบบัญชีเจ้าของ")) return raw.replace(/^.*ไม่พบ/, "ไม่พบ");
  if (raw.includes("ไม่พบครอบครัว")) return raw.replace(/^.*ไม่พบ/, "ไม่พบ");
  if (raw.includes("มีครอบครัวอยู่แล้ว")) return "บัญชีนี้มีครอบครัวอยู่แล้ว";
  if (raw.includes("ชื่อครอบครัวว่าง")) return "กรุณากรอกชื่อครอบครัว";
  return fallback;
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const { data, error } = await getSupabase().rpc("wealth_admin_stats", {
    p_actor: actorUsername(),
  });
  if (error) throw new Error(rpcMessage(error, "โหลดสถิติไม่สำเร็จ"));
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        user_count: number;
        family_count: number;
        admin_count: number;
        active_user_count: number;
      }
    | undefined;
  return {
    userCount: Number(row?.user_count ?? 0),
    familyCount: Number(row?.family_count ?? 0),
    adminCount: Number(row?.admin_count ?? 0),
    activeUserCount: Number(row?.active_user_count ?? 0),
  };
}

export async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  const { data, error } = await getSupabase().rpc("wealth_admin_list_users", {
    p_actor: actorUsername(),
  });
  if (error) throw new Error(rpcMessage(error, "โหลดบัญชีผู้ใช้ไม่สำเร็จ"));
  return ((data ?? []) as Array<{
    user_id: string;
    username: string;
    display_name: string | null;
    is_active: boolean;
    is_admin: boolean;
    family_id: string | null;
    family_name: string | null;
    created_at: string;
  }>).map((row) => ({
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    isActive: row.is_active,
    isAdmin: row.is_admin,
    familyId: row.family_id,
    familyName: row.family_name,
    createdAt: row.created_at,
  }));
}

export async function fetchAdminFamilies(): Promise<AdminFamilyRow[]> {
  const { data, error } = await getSupabase().rpc("wealth_admin_list_families", {
    p_actor: actorUsername(),
  });
  if (error) throw new Error(rpcMessage(error, "โหลดครอบครัวไม่สำเร็จ"));
  return ((data ?? []) as Array<{
    family_id: string;
    name: string;
    owner_username: string;
    owner_display_name: string | null;
    created_at: string;
  }>).map((row) => ({
    familyId: row.family_id,
    name: row.name,
    ownerUsername: row.owner_username,
    ownerDisplayName: row.owner_display_name,
    createdAt: row.created_at,
  }));
}

export async function setAdminUserActive(username: string, active: boolean) {
  const { error } = await getSupabase().rpc("wealth_admin_set_user_active", {
    p_actor: actorUsername(),
    p_username: username,
    p_active: active,
  });
  if (error) throw new Error(rpcMessage(error, "เปลี่ยนสถานะบัญชีไม่สำเร็จ"));
}

export type AdminUserWrite = {
  username: string;
  password?: string;
  displayName: string;
  familyName: string;
  isAdmin: boolean;
  isActive: boolean;
};

export async function createAdminUser(input: AdminUserWrite) {
  const { error } = await getSupabase().rpc("wealth_admin_create_user", {
    p_actor: actorUsername(),
    p_username: input.username,
    p_password: input.password ?? "",
    p_display_name: input.displayName || null,
    p_is_admin: input.isAdmin,
    p_is_active: input.isActive,
    p_family_name: input.familyName || null,
  });
  if (error) throw new Error(rpcMessage(error, "สร้างบัญชีไม่สำเร็จ"));
}

export async function updateAdminUser(input: AdminUserWrite) {
  const { error } = await getSupabase().rpc("wealth_admin_update_user", {
    p_actor: actorUsername(),
    p_username: input.username,
    p_display_name: input.displayName || null,
    p_is_admin: input.isAdmin,
    p_is_active: input.isActive,
    p_password: input.password || null,
    p_family_name: input.familyName || null,
  });
  if (error) throw new Error(rpcMessage(error, "แก้ไขบัญชีไม่สำเร็จ"));
}

export async function deleteAdminUser(username: string) {
  const { error } = await getSupabase().rpc("wealth_admin_delete_user", {
    p_actor: actorUsername(),
    p_username: username,
  });
  if (error) throw new Error(rpcMessage(error, "ลบบัญชีไม่สำเร็จ"));
}

export async function createAdminFamily(name: string, ownerUsername: string) {
  const { error } = await getSupabase().rpc("wealth_admin_create_family", {
    p_actor: actorUsername(),
    p_name: name,
    p_owner_username: ownerUsername,
  });
  if (error) throw new Error(rpcMessage(error, "สร้างครอบครัวไม่สำเร็จ"));
}

export async function updateAdminFamily(familyId: string, name: string) {
  const { error } = await getSupabase().rpc("wealth_admin_update_family", {
    p_actor: actorUsername(),
    p_family_id: familyId,
    p_name: name,
  });
  if (error) throw new Error(rpcMessage(error, "แก้ไขครอบครัวไม่สำเร็จ"));
}

export async function deleteAdminFamily(familyId: string) {
  const { error } = await getSupabase().rpc("wealth_admin_delete_family", {
    p_actor: actorUsername(),
    p_family_id: familyId,
  });
  if (error) throw new Error(rpcMessage(error, "ลบครอบครัวไม่สำเร็จ"));
}
