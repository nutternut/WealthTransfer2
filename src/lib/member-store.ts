import type { Member } from "@/data/wealth-transfer";

const STORAGE_KEY = "wt_extra_members";
const ORDER_KEY = "wt_member_order";
const DELETED_KEY = "wt_deleted_members";
const RELATIONS_KEY = "wt_member_relations";

export type MemberRelationPatch = {
  parentIds?: string[];
  partnerId?: string;
};

export function loadExtraMembers(): Member[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Member[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistExtraMembers(members: Member[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
}

export function loadMemberOrder(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistMemberOrder(ids: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
}

export function loadDeletedMemberIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistDeletedMemberIds(ids: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DELETED_KEY, JSON.stringify(ids));
}

export function loadMemberRelations(): Record<string, MemberRelationPatch> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(RELATIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, MemberRelationPatch>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function persistMemberRelations(
  relations: Record<string, MemberRelationPatch>,
) {
  if (typeof window === "undefined") return;
  localStorage.setItem(RELATIONS_KEY, JSON.stringify(relations));
}

export function mergeMemberRelations(members: Member[]): Member[] {
  const patches = loadMemberRelations();
  return members.map((m) => {
    const patch = patches[m.id];
    if (!patch) return m;
    return {
      ...m,
      parentIds: patch.parentIds ?? m.parentIds,
      partnerId: patch.partnerId ?? m.partnerId,
    };
  });
}

export function persistMemberRelation(
  member: Member,
  baseIds: Set<string>,
) {
  if (baseIds.has(member.id)) {
    const relations = loadMemberRelations();
    relations[member.id] = {
      parentIds: member.parentIds,
      partnerId: member.partnerId,
    };
    persistMemberRelations(relations);
    return;
  }
  const extras = loadExtraMembers();
  persistExtraMembers(
    extras.map((m) => (m.id === member.id ? member : m)),
  );
}

export function applyMemberOrder(members: Member[], order: string[]) {
  if (order.length === 0) return members;
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...members].sort((a, b) => {
    const ai = rank.has(a.id) ? rank.get(a.id)! : Number.MAX_SAFE_INTEGER;
    const bi = rank.has(b.id) ? rank.get(b.id)! : Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return 0;
  });
}

export function nextMemberId(existing: Member[]) {
  const max = existing.reduce((n, m) => {
    const match = /^M(\d+)$/.exec(m.id);
    return match ? Math.max(n, Number(match[1])) : n;
  }, 0);
  return `M${max + 1}`;
}
