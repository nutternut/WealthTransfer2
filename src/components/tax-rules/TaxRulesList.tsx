"use client";

import { useMemo, useState } from "react";
import { Info, Pencil, Plus, Search } from "lucide-react";
import type { TaxRule, TaxRuleStatus } from "@/data/wealth-transfer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  TaxRuleModal,
  type TaxRuleFormData,
} from "@/components/tax-rules/TaxRuleModal";

type TaxRulesListProps = {
  initialRules: TaxRule[];
};

function nextRuleId(items: TaxRule[], category: string) {
  const prefix =
    category.includes("มรดก")
      ? "TR-INH"
      : category.includes("อสังหา")
        ? "TR-LAND"
        : category.includes("ธุรกิจ") || category.includes("หุ้น")
          ? "TR-BIZ"
          : "TR-GIFT";
  const nums = items
    .filter((r) => r.id.startsWith(prefix))
    .map((r) => Number(/(\d+)$/.exec(r.id)?.[1] ?? 0));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${String(next).padStart(2, "0")}`;
}

export function TaxRulesList({ initialRules }: TaxRulesListProps) {
  const [items, setItems] = useState<TaxRule[]>(initialRules);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<"all" | TaxRuleStatus>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TaxRule | null>(null);

  const categories = useMemo(
    () => [...new Set(items.map((r) => r.category))],
    [items],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((r) => {
      const matchQuery =
        !q ||
        `${r.id} ${r.name} ${r.category} ${r.threshold} ${r.rate} ${r.version} ${r.source}`
          .toLowerCase()
          .includes(q);
      const matchCategory = category === "all" || r.category === category;
      const matchStatus = status === "all" || r.status === status;
      return matchQuery && matchCategory && matchStatus;
    });
  }, [items, query, category, status]);

  const activeCount = items.filter((r) => r.status === "ใช้งาน").length;
  const versions = [...new Set(items.map((r) => r.version))];

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(rule: TaxRule) {
    setEditing(rule);
    setModalOpen(true);
  }

  function handleSave(data: TaxRuleFormData) {
    if (editing) {
      setItems((prev) =>
        prev.map((r) => (r.id === editing.id ? { ...r, ...data } : r)),
      );
      return;
    }
    const rule: TaxRule = {
      id: nextRuleId(items, data.category),
      ...data,
    };
    setItems((prev) => [...prev, rule]);
  }

  return (
    <>
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            กฎภาษีสำหรับผู้ดูแล
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            บริหารกฎแบบมีรุ่น วันที่มีผล และแหล่งอ้างอิง
            โดยไม่ Hard-code ในหน้าจอคำนวณ
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-mint-brand px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-mint-brandDark"
        >
          <Plus className="h-3.5 w-3.5" />
          เพิ่มกฎ
        </button>
      </div>

      <div className="mb-5 flex gap-3 rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-xs leading-relaxed text-sky-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
        <p>
          การแก้ไขกฎภาษีต้องมีสิทธิผู้ดูแลและต้องบันทึกประวัติ
          ผู้ใช้งานทั่วไปเห็นผลคำนวณแต่แก้กฎไม่ได้
          {versions.length > 0 ? (
            <>
              {" "}
              · รุ่นที่ใช้งานในระบบ:{" "}
              <span className="font-semibold">{versions.join(", ")}</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
          <div className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            กฎทั้งหมด
          </div>
          <div className="mt-1 text-xl font-bold text-slate-900 tabular-nums">
            {items.length}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
          <div className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            กำลังใช้งาน
          </div>
          <div className="mt-1 text-xl font-bold text-mint-brandDark tabular-nums">
            {activeCount}
          </div>
        </div>
        <div className="col-span-2 rounded-2xl border border-slate-100 bg-white px-4 py-3 sm:col-span-1">
          <div className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            รุ่นกฎล่าสุด
          </div>
          <div className="mt-1 text-lg font-bold text-slate-900">
            {versions[0] ?? "—"}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-50 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:p-5">
          <div className="relative min-w-[220px] flex-grow">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหากฎ รหัส หรือแหล่งอ้างอิง..."
              className="w-full rounded-xl border border-slate-200 py-2 pr-4 pl-9 text-xs text-slate-700 transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none"
            />
          </div>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none"
          >
            <option value="all">ทุกประเภท</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as TaxRuleStatus | "all")
            }
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="ใช้งาน">ใช้งาน</option>
            <option value="ร่าง">ร่าง</option>
            <option value="หมดอายุ">หมดอายุ</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                <th className="px-6 py-3">รหัส</th>
                <th className="px-6 py-3">ชื่อกฎ</th>
                <th className="px-6 py-3">ประเภทรายการ</th>
                <th className="px-6 py-3">เกณฑ์ / ยกเว้น</th>
                <th className="px-6 py-3">อัตรา</th>
                <th className="px-6 py-3 text-center">สถานะ</th>
                <th className="px-6 py-3 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-slate-400"
                  >
                    ไม่พบกฎภาษีที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="transition-colors duration-150 hover:bg-slate-50/50"
                  >
                    <td className="px-6 py-4 font-mono text-slate-500">
                      {r.id}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">
                        {r.name}
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-400">
                        {r.version} · มีผล {r.effectiveFrom}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{r.category}</td>
                    <td className="px-6 py-4 text-slate-600">{r.threshold}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {r.rate}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          title="แก้ไขเวอร์ชันกฎ"
                          onClick={() => openEdit(r)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
                        >
                          <Pencil className="h-3 w-3" />
                          แก้ไข
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
            แสดงผล {filtered.length} จากทั้งหมด {items.length} รายการ
          </span>
          <span className="hidden text-[11px] text-slate-400 sm:inline">
            แหล่งอ้างอิงอยู่ในรายละเอียดกฎแต่ละรายการ
          </span>
        </div>
      </div>

      <TaxRuleModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        initial={editing}
      />
    </>
  );
}
