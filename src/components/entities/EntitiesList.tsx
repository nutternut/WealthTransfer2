"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownWideNarrow,
  Building2,
  LayoutGrid,
  List,
  Network,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import type { Entity } from "@/data/wealth-transfer";
import { money } from "@/lib/format";
import {
  mergeStoredEntities,
  nextEntityId,
  parseShareholders,
  syncEntityStorage,
  type ShareholderRow,
} from "@/lib/entity-store";
import { AddEntityModal } from "@/components/entities/AddEntityModal";
import { CapTableModal } from "@/components/entities/CapTableModal";

type EntitiesListProps = {
  initialEntities: Entity[];
};

type ViewMode = "grid" | "list";
type SortKey = "value-desc" | "value-asc" | "name" | "ready";
type StatusFilter = "all" | "ready" | "draft";

const SHARE_COLORS = [
  "bg-mint-brand",
  "bg-sky-400",
  "bg-teal-300",
  "bg-mint-200",
  "bg-slate-300",
];

const SHARE_SOFT = [
  "bg-mint-brandLight text-mint-brandDark",
  "bg-sky-50 text-sky-700",
  "bg-teal-50 text-teal-700",
  "bg-mint-brandLight text-mint-brandDark",
  "bg-slate-100 text-slate-600",
];

function kindTone(kind: string) {
  if (kind.includes("โฮลดิ้ง")) {
    return {
      badge: "bg-violet-100/80 text-violet-700",
      icon: "bg-linear-to-br from-violet-500 to-violet-700 text-white shadow-violet-500/20",
      bar: "from-violet-400 to-violet-600",
      wash: "from-violet-50 via-white to-white",
      ring: "hover:ring-violet-200/80",
    };
  }
  if (kind.includes("มูลนิธิ")) {
    return {
      badge: "bg-amber-100/80 text-amber-800",
      icon: "bg-linear-to-br from-amber-400 to-orange-500 text-white shadow-amber-500/20",
      bar: "from-amber-400 to-orange-500",
      wash: "from-amber-50 via-white to-white",
      ring: "hover:ring-amber-200/80",
    };
  }
  if (kind.includes("ห้างหุ้นส่วน")) {
    return {
      badge: "bg-teal-100/80 text-teal-800",
      icon: "bg-linear-to-br from-teal-400 to-cyan-600 text-white shadow-teal-500/20",
      bar: "from-teal-400 to-cyan-500",
      wash: "from-teal-50 via-white to-white",
      ring: "hover:ring-teal-200/80",
    };
  }
  return {
    badge: "bg-sky-100/80 text-sky-800",
    icon: "bg-linear-to-br from-mint-brand to-mint-brandDark text-white shadow-mint-brand/20",
    bar: "from-mint-brand to-mint-400",
    wash: "from-mint-brandLight via-white to-white",
    ring: "hover:ring-mint-200/80",
  };
}

function kindShort(kind: string) {
  if (kind.includes("โฮลดิ้ง")) return "โฮลดิ้ง";
  if (kind.includes("มูลนิธิ")) return "มูลนิธิ";
  if (kind.includes("ห้างหุ้นส่วน")) return "ห้างหุ้นส่วน";
  if (kind.includes("ดำเนินธุรกิจ")) return "ดำเนินธุรกิจ";
  return kind;
}

function shortName(name: string) {
  return name.replace(/^(คุณ|เด็กชาย|เด็กหญิง|นาย|นาง|นางสาว)/, "").slice(0, 2);
}

function companyInitials(name: string) {
  const cleaned = name
    .replace(/^(บริษัท|ห้างหุ้นส่วนจำกัด|มูลนิธิ)\s*/u, "")
    .replace(/\s*(จำกัด|จำกัด\s*\(มหาชน\))$/u, "")
    .trim();
  return cleaned.slice(0, 2) || name.slice(0, 2);
}

function OwnershipStrip({
  rows,
  designing,
  compact = false,
}: {
  rows: ShareholderRow[];
  designing: boolean;
  compact?: boolean;
}) {
  if (designing) {
    return (
      <div className={compact ? "space-y-1" : "space-y-2"}>
        <div className={`flex overflow-hidden rounded-full bg-slate-200/60 ${compact ? "h-1" : "h-1.5"}`}>
          <div className="w-1/3 animate-pulse rounded-full bg-slate-300" />
        </div>
        {compact ? null : (
          <p className="text-[10px] text-slate-400">อยู่ระหว่างออกแบบ</p>
        )}
      </div>
    );
  }

  const ranked = [...rows].sort(
    (a, b) => (b.percent ?? 0) - (a.percent ?? 0),
  );
  const top = ranked.slice(0, 3);
  const more = ranked.length - top.length;
  const majority = ranked[0];

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2.5"}>
      <div className={`flex overflow-hidden rounded-full bg-slate-100/80 ${compact ? "h-1.5" : "h-1.5"}`}>
        {rows.map((row, i) =>
          row.percent != null ? (
            <div
              key={row.name}
              className={SHARE_COLORS[i % SHARE_COLORS.length]}
              style={{ width: `${Math.min(100, row.percent)}%` }}
              title={`${row.name} ${row.percent}%`}
            />
          ) : null,
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="flex -space-x-1.5">
            {top.map((row, i) => (
              <span
                key={row.name}
                title={`${row.name}${row.percent != null ? ` ${row.percent}%` : ""}`}
                className={`flex items-center justify-center rounded-full font-bold ring-2 ring-white ${
                  compact ? "h-5 w-5 text-[8px]" : "h-6 w-6 text-[9px]"
                } ${SHARE_SOFT[i % SHARE_SOFT.length]}`}
              >
                {shortName(row.name)}
              </span>
            ))}
            {more > 0 ? (
              <span
                className={`flex items-center justify-center rounded-full bg-slate-100 font-bold text-slate-500 ring-2 ring-white ${
                  compact ? "h-5 w-5 text-[8px]" : "h-6 w-6 text-[9px]"
                }`}
              >
                +{more}
              </span>
            ) : null}
          </div>
          {!compact ? (
            <span className="truncate text-[11px] text-slate-500">
              {rows.length} คน
            </span>
          ) : null}
        </div>
        {majority?.percent != null ? (
          <span
            className={`shrink-0 font-semibold tabular-nums text-slate-600 ${
              compact ? "text-[10px]" : "text-[11px]"
            }`}
          >
            {compact ? `${majority.percent}%` : `ใหญ่สุด ${majority.percent}%`}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function EntityCard({
  entity,
  mode,
  onOpenCap,
  onEdit,
}: {
  entity: Entity;
  mode: ViewMode;
  onOpenCap: () => void;
  onEdit: () => void;
}) {
  const tone = kindTone(entity.kind);
  const rows = parseShareholders(entity.shareholders);
  const designing = rows.length === 0;
  const initials = companyInitials(entity.name);

  if (mode === "list") {
    return (
      <article className="group flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-4 transition duration-200 hover:border-slate-200 hover:shadow-md sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xs font-bold shadow-sm ${tone.icon}`}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] leading-4 font-semibold ${tone.badge}`}
              >
                {entity.kind}
              </span>
              <span className="font-mono text-[10px] text-slate-300">{entity.id}</span>
              {designing ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  ออกแบบ
                </span>
              ) : (
                <span className="rounded-full bg-mint-brandLight px-2 py-0.5 text-[10px] font-semibold text-mint-brandDark">
                  พร้อม
                </span>
              )}
            </div>
            <h2 className="mt-1.5 truncate text-sm font-bold text-slate-900">
              {entity.name}
            </h2>
            <p className="mt-1 text-xs tabular-nums text-slate-500">
              มูลค่า {money(entity.value)}
            </p>
          </div>
        </div>

        <div className="min-w-0 flex-1 sm:max-w-xs">
          <OwnershipStrip rows={rows} designing={designing} />
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            แก้ไข
          </button>
          <button
            type="button"
            onClick={onOpenCap}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 transition group-hover:border-mint-200 group-hover:bg-mint-brandLight group-hover:text-mint-brandDark"
          >
            <Network className="h-3.5 w-3.5" />
            โครงสร้าง
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="group relative overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition duration-200 hover:border-slate-200 hover:shadow-md">
      <div
        className={`absolute inset-y-0 left-0 w-[3px] bg-linear-to-b ${tone.bar}`}
        aria-hidden
      />

      <div className="p-3 pl-3.5">
        <div className="flex items-start gap-2.5">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold shadow-sm ${tone.icon}`}
            aria-hidden
          >
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-2 text-[12px] leading-snug font-bold text-slate-900">
              {entity.name}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-slate-400">
              <span className="font-semibold text-slate-500">
                {kindShort(entity.kind)}
              </span>
              <span aria-hidden>·</span>
              <span
                className={`inline-flex items-center gap-1 font-medium ${
                  designing ? "text-amber-600" : "text-mint-brand"
                }`}
              >
                <span
                  className={`h-1 w-1 rounded-full ${
                    designing ? "bg-amber-500" : "bg-mint-brandLight0"
                  }`}
                />
                {designing ? "ออกแบบ" : "พร้อม"}
              </span>
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-0.5">
            <button
              type="button"
              onClick={onEdit}
              title="แก้ไข"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="sr-only">แก้ไข</span>
            </button>
            <button
              type="button"
              onClick={onOpenCap}
              title="ดูโครงสร้างผู้ถือหุ้น"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-mint-brandLight hover:text-mint-brandDark"
            >
              <Network className="h-3.5 w-3.5" />
              <span className="sr-only">ดูโครงสร้างผู้ถือหุ้น</span>
            </button>
          </div>
        </div>

        <div className="mt-2.5 flex items-baseline justify-between gap-2">
          <p className="text-[15px] font-bold tracking-tight tabular-nums text-slate-900">
            {money(entity.value)}
          </p>
          {!designing && rows.length > 0 ? (
            <span className="text-[10px] font-medium tabular-nums text-slate-400">
              {rows.length} ผู้ถือหุ้น
            </span>
          ) : null}
        </div>

        <div className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2">
          <OwnershipStrip rows={rows} designing={designing} compact />
        </div>
      </div>
    </article>
  );
}

export function EntitiesList({ initialEntities }: EntitiesListProps) {
  const baseIds = useMemo(
    () => new Set(initialEntities.map((e) => e.id)),
    [initialEntities],
  );
  const [items, setItems] = useState<Entity[]>(initialEntities);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [capEntity, setCapEntity] = useState<Entity | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("value-desc");
  const [view, setView] = useState<ViewMode>("grid");

  useEffect(() => {
    setItems(mergeStoredEntities(initialEntities));
  }, [initialEntities]);

  const kinds = useMemo(
    () => [...new Set(items.map((e) => e.kind))],
    [items],
  );

  const stats = useMemo(() => {
    const totalValue = items.reduce((s, e) => s + e.value, 0);
    const designed = items.filter(
      (e) => parseShareholders(e.shareholders).length > 0,
    ).length;
    return {
      count: items.length,
      totalValue,
      designed,
      drafting: items.length - designed,
    };
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter((e) => {
      const rows = parseShareholders(e.shareholders);
      const ready = rows.length > 0;
      const matchQuery =
        !q ||
        `${e.name} ${e.kind} ${e.id} ${e.shareholders}`.toLowerCase().includes(q);
      const matchKind = kind === "all" || e.kind === kind;
      const matchStatus =
        status === "all" ||
        (status === "ready" && ready) ||
        (status === "draft" && !ready);
      return matchQuery && matchKind && matchStatus;
    });

    return list.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "th");
      if (sort === "value-asc") return a.value - b.value;
      if (sort === "ready") {
        const ar = parseShareholders(a.shareholders).length > 0 ? 0 : 1;
        const br = parseShareholders(b.shareholders).length > 0 ? 0 : 1;
        if (ar !== br) return ar - br;
        return b.value - a.value;
      }
      return b.value - a.value;
    });
  }, [items, query, kind, status, sort]);

  function openAddModal() {
    setEditingEntity(null);
    setModalOpen(true);
  }

  function openEditModal(entity: Entity) {
    setEditingEntity(entity);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingEntity(null);
  }

  function handleSave(data: Omit<Entity, "id">) {
    if (editingEntity) {
      const updated: Entity = { ...editingEntity, ...data };
      setItems((prev) => {
        const next = prev.map((e) => (e.id === editingEntity.id ? updated : e));
        syncEntityStorage(next, baseIds);
        return next;
      });
      setCapEntity((prev) => (prev?.id === editingEntity.id ? updated : prev));
    } else {
      const entity: Entity = {
        id: nextEntityId(items),
        ...data,
      };
      setItems((prev) => {
        const next = [...prev, entity];
        syncEntityStorage(next, baseIds);
        return next;
      });
    }
    closeModal();
  }

  return (
    <>
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            นิติบุคคลและโครงสร้างผู้ถือหุ้น
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            ค้นหา กรอง และดูโครงสร้างหลายบริษัทในพอร์ตครอบครัวพร้อมกัน
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-1.5 rounded-xl bg-mint-brand px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-mint-brandDark"
        >
          <Plus className="h-3.5 w-3.5" />
          เพิ่มนิติบุคคล
        </button>
      </div>

      <div className="mb-5 overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-50 sm:grid-cols-4 sm:divide-y-0">
          <div className="px-4 py-3.5 sm:px-5">
            <p className="text-[11px] text-slate-400">ทั้งหมด</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">
              {stats.count}
              <span className="ml-1 text-xs font-medium text-slate-400">แห่ง</span>
            </p>
          </div>
          <div className="px-4 py-3.5 sm:px-5">
            <p className="text-[11px] text-slate-400">มูลค่ารวม</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">
              {money(stats.totalValue)}
            </p>
          </div>
          <div className="px-4 py-3.5 sm:px-5">
            <p className="text-[11px] text-slate-400">โครงสร้างพร้อม</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-mint-brandDark">
              {stats.designed}
            </p>
          </div>
          <div className="px-4 py-3.5 sm:px-5">
            <p className="text-[11px] text-slate-400">อยู่ระหว่างออกแบบ</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-amber-600">
              {stats.drafting}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-5 overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-50 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:p-4">
          <div className="relative min-w-[200px] flex-grow">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อบริษัท ผู้ถือหุ้น หรือรหัส..."
              className="w-full rounded-xl border border-slate-200 py-2 pr-4 pl-9 text-xs text-slate-700 transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none"
            />
          </div>

          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none"
          >
            <option value="all">ทุกประเภท</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="ready">โครงสร้างพร้อม</option>
            <option value="draft">อยู่ระหว่างออกแบบ</option>
          </select>

          <div className="relative">
            <ArrowDownWideNarrow className="pointer-events-none absolute top-2.5 left-3 h-3.5 w-3.5 text-slate-400" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-xl border border-slate-200 bg-white py-2 pr-3 pl-8 text-xs text-slate-600 transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none"
            >
              <option value="value-desc">มูลค่าสูง → ต่ำ</option>
              <option value="value-asc">มูลค่าต่ำ → สูง</option>
              <option value="name">ชื่อ A–Z</option>
              <option value="ready">พร้อมก่อน</option>
            </select>
          </div>

          <div className="ml-auto flex rounded-xl border border-slate-200 p-0.5">
            <button
              type="button"
              onClick={() => setView("grid")}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                view === "grid"
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              aria-pressed={view === "grid"}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              กริด
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                view === "list"
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              aria-pressed={view === "list"}
            >
              <List className="h-3.5 w-3.5" />
              รายการ
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between bg-slate-50/60 px-4 py-2.5 text-xs text-slate-500 sm:px-5">
          <span>
            แสดงผล {filtered.length} จากทั้งหมด {items.length} บริษัท
          </span>
          {query || kind !== "all" || status !== "all" ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setKind("all");
                setStatus("all");
              }}
              className="font-semibold text-mint-brand hover:text-mint-brandDark"
            >
              ล้างตัวกรอง
            </button>
          ) : null}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-linear-to-b from-white to-slate-50 px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-brandLight text-mint-brand">
            <Building2 className="h-6 w-6" />
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-700">
            ยังไม่มีนิติบุคคล
          </p>
          <p className="mt-1 text-xs text-slate-400">
            กดเพิ่มนิติบุคคลเพื่อเริ่มเชื่อมโครงสร้างกับแผนส่งต่อ
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-mint-brand px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-mint-brandDark"
          >
            <Plus className="h-3.5 w-3.5" />
            เพิ่มนิติบุคคล
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white px-6 py-14 text-center text-sm text-slate-400">
          ไม่พบนิติบุคคลที่ตรงกับเงื่อนไข
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((e) => (
            <EntityCard
              key={e.id}
              entity={e}
              mode="grid"
              onOpenCap={() => setCapEntity(e)}
              onEdit={() => openEditModal(e)}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((e) => (
            <EntityCard
              key={e.id}
              entity={e}
              mode="list"
              onOpenCap={() => setCapEntity(e)}
              onEdit={() => openEditModal(e)}
            />
          ))}
        </div>
      )}

      <AddEntityModal
        open={modalOpen}
        onClose={closeModal}
        onSave={handleSave}
        entity={editingEntity}
      />
      <CapTableModal
        entity={capEntity}
        onClose={() => setCapEntity(null)}
        onEdit={() => {
          if (!capEntity) return;
          setCapEntity(null);
          openEditModal(capEntity);
        }}
      />
    </>
  );
}
