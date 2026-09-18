import type { Entity } from "@/data/wealth-transfer";

const STORAGE_KEY = "wt_extra_entities";
const OVERRIDES_KEY = "wt_entity_overrides";

export function loadExtraEntities(): Entity[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Entity[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistExtraEntities(list: Entity[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function loadEntityOverrides(): Record<string, Entity> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Entity>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function persistEntityOverrides(overrides: Record<string, Entity>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
}

/** รวมข้อมูลเริ่มต้น + ที่แก้ไข + ที่เพิ่มใหม่ */
export function mergeStoredEntities(initial: Entity[]): Entity[] {
  const overrides = loadEntityOverrides();
  const extras = loadExtraEntities();
  const merged = initial.map((e) => overrides[e.id] ?? e);
  const ids = new Set(merged.map((e) => e.id));
  for (const e of extras) {
    if (!ids.has(e.id)) merged.push(e);
  }
  return merged;
}

export function syncEntityStorage(items: Entity[], baseIds: Set<string>) {
  const overrides: Record<string, Entity> = {};
  const extras: Entity[] = [];
  for (const e of items) {
    if (baseIds.has(e.id)) overrides[e.id] = e;
    else extras.push(e);
  }
  persistEntityOverrides(overrides);
  persistExtraEntities(extras);
}

export function nextEntityId(existing: Entity[]) {
  const max = existing.reduce((n, e) => {
    const m = /^E-(\d+)$/.exec(e.id);
    return m ? Math.max(n, Number(m[1])) : n;
  }, 0);
  return `E-${String(max + 1).padStart(3, "0")}`;
}

export type ShareholderRow = {
  name: string;
  percent: number | null;
};

/** แปลงข้อความผู้ถือหุ้น เช่น "คุณสมชาย 68% / คุณอนันต์ 16%" */
export function parseShareholders(text: string): ShareholderRow[] {
  const trimmed = text.trim();
  if (!trimmed || trimmed.includes("อยู่ระหว่าง")) {
    return [];
  }
  return trimmed
    .split(/\s*\/\s*/)
    .map((part) => {
      const m = /^(.+?)\s+(\d+(?:\.\d+)?)\s*%$/.exec(part.trim());
      if (m) {
        return { name: m[1].trim(), percent: Number(m[2]) };
      }
      return { name: part.trim(), percent: null };
    })
    .filter((r) => r.name.length > 0);
}
