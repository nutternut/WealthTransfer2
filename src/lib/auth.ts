import { getSupabase } from "@/lib/supabase/client";

/** Cookie สำหรับ proxy กันหน้าที่ยังไม่ login */
export const AUTH_COOKIE = "wt_session";

const OWNER_STORAGE_KEY = "wt_owner_id";
const USERNAME_STORAGE_KEY = "wt_username";
const FAMILY_STORAGE_KEY = "wt_family_name";
const DISPLAY_STORAGE_KEY = "wt_display_name";
const ADMIN_STORAGE_KEY = "wt_is_admin";

const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function setSessionCookie(username: string) {
  document.cookie = `${AUTH_COOKIE}=${encodeURIComponent(username.trim())}; path=/; max-age=${SESSION_MAX_AGE}; SameSite=Lax`;
}

export function clearSessionCookie() {
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function hasSessionCookie() {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split("; ")
    .some((row) => row.startsWith(`${AUTH_COOKIE}=`));
}

function setLocalSession(opts: {
  userId: string;
  username: string;
  displayName?: string | null;
  familyName?: string | null;
  isAdmin?: boolean;
}) {
  localStorage.setItem(OWNER_STORAGE_KEY, opts.userId);
  localStorage.setItem(USERNAME_STORAGE_KEY, opts.username);
  localStorage.setItem(ADMIN_STORAGE_KEY, opts.isAdmin ? "1" : "0");
  if (opts.displayName) {
    localStorage.setItem(DISPLAY_STORAGE_KEY, opts.displayName);
  } else {
    localStorage.removeItem(DISPLAY_STORAGE_KEY);
  }
  if (opts.familyName) {
    localStorage.setItem(FAMILY_STORAGE_KEY, opts.familyName);
  } else {
    localStorage.removeItem(FAMILY_STORAGE_KEY);
  }
}

function clearLocalSession() {
  localStorage.removeItem(OWNER_STORAGE_KEY);
  localStorage.removeItem(USERNAME_STORAGE_KEY);
  localStorage.removeItem(FAMILY_STORAGE_KEY);
  localStorage.removeItem(DISPLAY_STORAGE_KEY);
  localStorage.removeItem(ADMIN_STORAGE_KEY);
}

export type LoginResult =
  | {
      ok: true;
      userId: string;
      username: string;
      familyName?: string;
      isAdmin: boolean;
    }
  | { ok: false; message: string };

type WealthLoginRow = {
  user_id: string;
  username: string;
  display_name: string | null;
  family_id: string | null;
  family_name: string | null;
  is_admin?: boolean | null;
};

/**
 * Login ด้วย username + password ผ่าน RPC wealth_login
 * (ตรวจจากตาราง wealth_users — ไม่ใช้ Supabase Auth)
 */
export async function loginWithUsernamePassword(
  username: string,
  password: string,
): Promise<LoginResult> {
  const trimmed = username.trim();
  if (!trimmed || !password) {
    return { ok: false, message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("wealth_login", {
    p_username: trimmed,
    p_password: password,
  });

  if (error) {
    return {
      ok: false,
      message: "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่",
    };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | WealthLoginRow
    | undefined;

  if (!row?.user_id) {
    return {
      ok: false,
      message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
    };
  }

  const isAdmin = Boolean(row.is_admin);

  setLocalSession({
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    familyName: row.family_name ?? row.display_name,
    isAdmin,
  });
  setSessionCookie(row.username);

  return {
    ok: true,
    userId: row.user_id,
    username: row.username,
    familyName: row.family_name ?? undefined,
    isAdmin,
  };
}

export async function logout() {
  clearLocalSession();
  clearSessionCookie();
}

/** owner_id จาก session ในเบราว์เซอร์ (= wealth_users.id) */
export async function getOwnerId(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const ownerId = localStorage.getItem(OWNER_STORAGE_KEY);
  if (!ownerId || !hasSessionCookie()) return null;
  return ownerId;
}

export async function requireOwnerId(): Promise<string> {
  const ownerId = await getOwnerId();
  if (!ownerId) {
    throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  }
  return ownerId;
}

export function getStoredUsername(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(USERNAME_STORAGE_KEY);
}

export function getStoredDisplayName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(DISPLAY_STORAGE_KEY);
}

export function getStoredFamilyName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(FAMILY_STORAGE_KEY);
}

export function getStoredIsAdmin(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ADMIN_STORAGE_KEY) === "1";
}
