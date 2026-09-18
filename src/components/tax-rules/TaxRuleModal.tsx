"use client";

import { useEffect, useId, useState } from "react";
import { BookMarked, X } from "lucide-react";
import type { TaxRule, TaxRuleStatus } from "@/data/wealth-transfer";

const CATEGORIES = ["การให้", "มรดก", "อสังหาริมทรัพย์", "ธุรกิจ/หุ้น", "อื่น ๆ"];
const STATUSES: TaxRuleStatus[] = ["ใช้งาน", "ร่าง", "หมดอายุ"];

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-700 transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none";

const labelClass = "block text-xs font-semibold text-slate-500";

export type TaxRuleFormData = Omit<TaxRule, "id">;

type TaxRuleModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (data: TaxRuleFormData) => void;
  initial?: TaxRule | null;
};

type FormState = {
  name: string;
  category: string;
  threshold: string;
  rate: string;
  status: TaxRuleStatus;
  version: string;
  effectiveFrom: string;
  source: string;
};

const emptyForm: FormState = {
  name: "",
  category: "การให้",
  threshold: "",
  rate: "ตามกฎ",
  status: "ร่าง",
  version: "TH-2569.09",
  effectiveFrom: "",
  source: "",
};

export function TaxRuleModal({
  open,
  onClose,
  onSave,
  initial = null,
}: TaxRuleModalProps) {
  const titleId = useId();
  const [form, setForm] = useState<FormState>(emptyForm);
  const isEdit = Boolean(initial);

  useEffect(() => {
    if (!open) return;
    setForm(
      initial
        ? {
            name: initial.name,
            category: initial.category,
            threshold: initial.threshold,
            rate: initial.rate,
            status: initial.status,
            version: initial.version,
            effectiveFrom: initial.effectiveFrom,
            source: initial.source,
          }
        : emptyForm,
    );
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, initial]);

  if (!open) return null;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return;
    onSave({
      name,
      category: form.category,
      threshold: form.threshold.trim() || "ตามฐานกฎหมาย",
      rate: form.rate.trim() || "ตามกฎ",
      status: form.status,
      version: form.version.trim() || "TH-2569.09",
      effectiveFrom: form.effectiveFrom.trim() || "—",
      source: form.source.trim() || "—",
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="ปิด"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-100 bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mint-brandLight text-mint-brand">
              <BookMarked className="h-4 w-4" />
            </div>
            <div>
              <h2 id={titleId} className="text-sm font-bold text-slate-900">
                {isEdit ? "แก้ไขกฎภาษี" : "เพิ่มกฎภาษี"}
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {isEdit
                  ? `${initial?.id} · รุ่น ${initial?.version}`
                  : "กำหนดเกณฑ์ วันที่มีผล และแหล่งอ้างอิง"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-4 overflow-y-auto px-5 py-4">
            <div>
              <label htmlFor="tr-name" className={labelClass}>
                ชื่อกฎ
              </label>
              <input
                id="tr-name"
                required
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                className={`${inputClass} mt-1.5`}
                placeholder="เช่น การให้ บุพการี/ผู้สืบสันดาน"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="tr-cat" className={labelClass}>
                  ประเภทรายการ
                </label>
                <select
                  id="tr-cat"
                  value={form.category}
                  onChange={(e) => setField("category", e.target.value)}
                  className={`${inputClass} mt-1.5`}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="tr-status" className={labelClass}>
                  สถานะ
                </label>
                <select
                  id="tr-status"
                  value={form.status}
                  onChange={(e) =>
                    setField("status", e.target.value as TaxRuleStatus)
                  }
                  className={`${inputClass} mt-1.5`}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="tr-threshold" className={labelClass}>
                  เกณฑ์ / ยกเว้น
                </label>
                <input
                  id="tr-threshold"
                  value={form.threshold}
                  onChange={(e) => setField("threshold", e.target.value)}
                  className={`${inputClass} mt-1.5`}
                  placeholder="เช่น 20 ล้านบาท/ปี"
                />
              </div>
              <div>
                <label htmlFor="tr-rate" className={labelClass}>
                  อัตรา
                </label>
                <input
                  id="tr-rate"
                  value={form.rate}
                  onChange={(e) => setField("rate", e.target.value)}
                  className={`${inputClass} mt-1.5`}
                  placeholder="เช่น 5% หรือ ตามกฎ"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="tr-version" className={labelClass}>
                  รุ่นกฎ
                </label>
                <input
                  id="tr-version"
                  value={form.version}
                  onChange={(e) => setField("version", e.target.value)}
                  className={`${inputClass} mt-1.5`}
                  placeholder="TH-2569.09"
                />
              </div>
              <div>
                <label htmlFor="tr-effective" className={labelClass}>
                  วันที่มีผล
                </label>
                <input
                  id="tr-effective"
                  value={form.effectiveFrom}
                  onChange={(e) => setField("effectiveFrom", e.target.value)}
                  className={`${inputClass} mt-1.5`}
                  placeholder="01/09/2569"
                />
              </div>
            </div>

            <div>
              <label htmlFor="tr-source" className={labelClass}>
                แหล่งอ้างอิง
              </label>
              <input
                id="tr-source"
                value={form.source}
                onChange={(e) => setField("source", e.target.value)}
                className={`${inputClass} mt-1.5`}
                placeholder="เช่น พ.ร.บ.ภาษีการรับมรดก พ.ศ. 2558"
              />
            </div>

            <p className="rounded-xl border border-amber-100 bg-amber-50/80 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-800">
              การแก้ไขกฎภาษีต้องมีสิทธิผู้ดูแลและจะถูกบันทึกในประวัติการเปลี่ยนแปลง
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="rounded-xl bg-mint-brand px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-mint-brandDark"
            >
              {isEdit ? "บันทึกรุ่น" : "สร้างกฎ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
