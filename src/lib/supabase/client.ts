import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const browserClientKey = "__wealthTransferSupabaseBrowserClient";

type BrowserClientStore = Record<string, SupabaseClient | undefined>;

function getGlobalStore(): BrowserClientStore {
  return globalThis as unknown as BrowserClientStore;
}

function getBrowserClient(): SupabaseClient | null {
  if (typeof globalThis === "undefined") return null;
  return getGlobalStore()[browserClientKey] ?? null;
}

function setBrowserClient(client: SupabaseClient) {
  getGlobalStore()[browserClientKey] = client;
}

function getAnonKey() {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return anonKey;
}

/** เบราว์เซอร์ใช้ proxy same-origin; เซิร์ฟเวอร์ยิงตรงไป Supabase */
function getSupabaseUrl() {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/supabase`;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return url;
}

/** Client สำหรับข้อมูล + RPC login (ไม่ใช้ Supabase Auth) */
export function getSupabase() {
  const anonKey = getAnonKey();

  if (typeof window === "undefined") {
    return createClient(getSupabaseUrl(), anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  const existing = getBrowserClient();
  if (existing) return existing;

  const client = createClient(getSupabaseUrl(), anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  setBrowserClient(client);
  return client;
}
