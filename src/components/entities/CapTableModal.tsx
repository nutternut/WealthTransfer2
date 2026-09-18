"use client";

import { useEffect, useId } from "react";
import { Network, Pencil, X } from "lucide-react";
import type { Entity } from "@/data/wealth-transfer";
import { money } from "@/lib/format";
import { parseShareholders } from "@/lib/entity-store";

type CapTableModalProps = {
  entity: Entity | null;
  onClose: () => void;
  onEdit?: () => void;
};

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

export function CapTableModal({ entity, onClose, onEdit }: CapTableModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!entity) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entity, onClose]);

  if (!entity) return null;

  const rows = [...parseShareholders(entity.shareholders)].sort(
    (a, b) => (b.percent ?? 0) - (a.percent ?? 0),
  );
  const designing = rows.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        aria-label="ปิด"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-t-2xl border border-slate-100 bg-white shadow-xl sm:rounded-2xl"
      >
        <div className="relative overflow-hidden border-b border-slate-100 bg-linear-to-br from-mint-brandLight/60 via-white to-sky-50/40 px-5 py-5">
          <div className="pointer-events-none absolute -top-10 -right-8 h-28 w-28 rounded-full bg-mint-brand/10 blur-2xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-mint-brand shadow-sm ring-1 ring-slate-100">
                <Network className="h-5 w-5" />
              </div>
              <div>
                <h2 id={titleId} className="text-base font-bold text-slate-900">
                  โครงสร้างผู้ถือหุ้น
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">{entity.name}</p>
                <p className="mt-2 inline-flex rounded-lg bg-white/80 px-2 py-1 text-[11px] font-semibold tabular-nums text-slate-700 ring-1 ring-slate-100">
                  {money(entity.value)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-600"
              aria-label="ปิด"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-5 py-5">
          {designing ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
              <p className="text-xs font-medium text-slate-500">
                {entity.shareholders || "อยู่ระหว่างออกแบบโครงสร้างผู้ถือหุ้น"}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-5 flex h-3 overflow-hidden rounded-full bg-slate-100">
                {rows.map((row, i) =>
                  row.percent != null ? (
                    <div
                      key={row.name}
                      className={`${SHARE_COLORS[i % SHARE_COLORS.length]} transition-all`}
                      style={{ width: `${Math.min(100, row.percent)}%` }}
                    />
                  ) : null,
                )}
              </div>
              <ul className="space-y-2.5">
                {rows.map((row, i) => (
                  <li
                    key={row.name}
                    className="flex items-center gap-3 rounded-xl bg-slate-50/80 px-3 py-2.5 ring-1 ring-slate-100/80"
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${SHARE_SOFT[i % SHARE_SOFT.length]}`}
                    >
                      {row.name.replace(/^(คุณ|เด็กชาย|เด็กหญิง|นาย|นาง|นางสาว)/, "").slice(0, 2)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-semibold text-slate-800">
                          {row.name}
                        </span>
                        <span className="shrink-0 tabular-nums font-bold text-slate-900">
                          {row.percent != null ? `${row.percent}%` : "—"}
                        </span>
                      </div>
                      {row.percent != null ? (
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white">
                          <div
                            className={`h-full rounded-full ${SHARE_COLORS[i % SHARE_COLORS.length]}`}
                            style={{ width: `${Math.min(100, row.percent)}%` }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            ปิด
          </button>
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-xl bg-mint-brand px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-mint-brandDark"
            >
              <Pencil className="h-3.5 w-3.5" />
              แก้ไขนิติบุคคล
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
