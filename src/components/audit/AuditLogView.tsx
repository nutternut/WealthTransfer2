"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Eye, ScrollText, Search, X } from "lucide-react";
import type { AuditLog } from "@/data/wealth-transfer";
import { StatusBadge } from "@/components/ui/StatusBadge";

type AuditLogViewProps = {
  initialLogs: AuditLog[];
};

const FILTER_OPTIONS = [
  { value: "all", label: "ทุกประเภท" },
  { value: "ทรัพย์สิน", label: "ทรัพย์สิน" },
  { value: "กฎภาษี", label: "กฎภาษี" },
  { value: "แผน", label: "แผน" },
] as const;

function matchesCategory(category: string, filter: string) {
  if (filter === "all") return true;
  if (filter === "ทรัพย์สิน") return category.includes("ทรัพย์สิน");
  if (filter === "กฎภาษี") {
    return category.includes("กฎภาษี") || /^TH-/i.test(category);
  }
  if (filter === "แผน") return category.includes("แผน");
  return category === filter;
}

function categoryLabel(category: string) {
  if (/^TH-/i.test(category)) return category;
  return category;
}

export function AuditLogView({ initialLogs }: AuditLogViewProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialLogs.filter((log) => {
      const matchQuery =
        !q ||
        `${log.at} ${log.user} ${log.item} ${log.change} ${log.category}`
          .toLowerCase()
          .includes(q);
      const matchCategory = matchesCategory(log.category, category);
      return matchQuery && matchCategory;
    });
  }, [initialLogs, query, category]);

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          ประวัติการเปลี่ยนแปลง
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          ตรวจสอบว่าใครเปลี่ยนข้อมูลอะไร เมื่อใด และผลคำนวณใช้กฎเวอร์ชันใด
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-50 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:p-5">
          <div className="relative min-w-[220px] flex-grow">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหารายการ..."
              className="w-full rounded-xl border border-slate-200 py-2 pr-4 pl-9 text-xs text-slate-700 transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none"
            />
          </div>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                <th className="px-6 py-3">วันเวลา</th>
                <th className="px-6 py-3">ผู้ใช้งาน</th>
                <th className="px-6 py-3">รายการ</th>
                <th className="px-6 py-3">การเปลี่ยนแปลง</th>
                <th className="px-6 py-3">ประเภท</th>
                <th className="px-6 py-3 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-slate-400"
                  >
                    ไม่พบประวัติที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              ) : (
                filtered.map((log, index) => (
                  <tr
                    key={`${log.at}-${log.item}-${index}`}
                    className="transition-colors duration-150 hover:bg-slate-50/50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap tabular-nums text-slate-500">
                      {log.at}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{log.user}</td>
                    <td className="px-6 py-4 font-semibold text-slate-800">
                      {log.item}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{log.change}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={categoryLabel(log.category)} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          title="ดูรายละเอียด"
                          onClick={() => setSelected(log)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          ดูรายละเอียด
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-50 bg-slate-50/50 px-6 py-3 text-xs text-slate-500">
          <span>
            แสดงผล {filtered.length} จากทั้งหมด {initialLogs.length} รายการ
          </span>
        </div>
      </div>

      <AuditDetailModal log={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function AuditDetailModal({
  log,
  onClose,
}: {
  log: AuditLog | null;
  onClose: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!log) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [log, onClose]);

  if (!log) return null;

  const rows = [
    { label: "วันเวลา", value: log.at },
    { label: "ผู้ใช้งาน", value: log.user },
    { label: "รายการ", value: log.item },
    { label: "การเปลี่ยนแปลง", value: log.change },
    { label: "ประเภท / เวอร์ชันกฎ", value: log.category },
  ];

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
                <ScrollText className="h-5 w-5" />
              </div>
              <div>
                <h2 id={titleId} className="text-base font-bold text-slate-900">
                  รายละเอียดการเปลี่ยนแปลง
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">{log.item}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700"
              aria-label="ปิด"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3 px-5 py-5">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-start justify-between gap-4 border-b border-slate-50 pb-3 last:border-0 last:pb-0"
            >
              <span className="shrink-0 text-[11px] font-medium text-slate-400">
                {row.label}
              </span>
              <span className="text-right text-xs font-semibold text-slate-800">
                {row.label.includes("ประเภท") ? (
                  <StatusBadge status={row.value} />
                ) : (
                  row.value
                )}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <p className="text-[11px] leading-relaxed text-slate-500">
            บันทึกนี้ใช้ตรวจสอบความถูกต้องของข้อมูลและฐานกฎที่ใช้คำนวณในขณะนั้น
          </p>
        </div>
      </div>
    </div>
  );
}
