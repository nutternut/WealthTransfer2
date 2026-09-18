import type { Asset } from "@/data/wealth-transfer";

const STORAGE_KEY = "wt_extra_assets";

export function loadExtraAssets(): Asset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Asset[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistExtraAssets(assets: Asset[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
}

export function nextAssetId(existing: Asset[]) {
  const max = existing.reduce((n, a) => {
    const m = /^A-(\d+)$/.exec(a.id);
    return m ? Math.max(n, Number(m[1])) : n;
  }, 0);
  return `A-${String(max + 1).padStart(3, "0")}`;
}
