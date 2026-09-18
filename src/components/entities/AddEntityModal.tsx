"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  Building2,
  Landmark,
  Percent,
  Plus,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { Entity } from "@/data/wealth-transfer";
import { members } from "@/data/wealth-transfer";
import { parseShareholders } from "@/lib/entity-store";

const ENTITY_KINDS = [
  {
    id: "บริษัทดำเนินธุรกิจ",
    label: "ดำเนินธุรกิจ",
    hint: "บริษัทปฏิบัติการ",
    icon: Building2,
    tone: "border-mint-200 bg-mint-brandLight text-mint-brandDark ring-mint-brand",
    idle: "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
  },
  {
    id: "บริษัทโฮลดิ้ง",
    label: "โฮลดิ้ง",
    hint: "ถือหุ้นบริษัทอื่น",
    icon: Landmark,
    tone: "border-violet-200 bg-violet-50 text-violet-700 ring-violet-500",
    idle: "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
  },
  {
    id: "ห้างหุ้นส่วนจำกัด",
    label: "ห้างหุ้นส่วน",
    hint: "หุ้นส่วนจำกัด",
    icon: Users,
    tone: "border-teal-200 bg-teal-50 text-teal-700 ring-teal-500",
    idle: "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
  },
  {
    id: "มูลนิธิ",
    label: "มูลนิธิ",
    hint: "เพื่อสาธารณประโยชน์",
    icon: Sparkles,
    tone: "border-amber-200 bg-amber-50 text-amber-700 ring-amber-500",
    idle: "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
  },
] as const;

const SHARE_COLORS = [
  "bg-mint-brand",
  "bg-sky-400",
  "bg-teal-300",
  "bg-mint-200",
  "bg-violet-300",
  "bg-amber-300",
];

const SHARE_SOFT = [
  "bg-mint-brandLight text-mint-brandDark",
  "bg-sky-50 text-sky-700",
  "bg-teal-50 text-teal-700",
  "bg-mint-brandLight text-mint-brandDark",
  "bg-violet-50 text-violet-700",
  "bg-amber-50 text-amber-700",
];

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-700 transition-all placeholder:text-slate-300 focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none";

const labelClass = "block text-[11px] font-semibold tracking-wide text-slate-500";

type AddEntityModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (entity: Omit<Entity, "id">) => void;
  entity?: Entity | null;
};

type ShareholderDraft = {
  member: string;
  percent: string;
};

type FormState = {
  name: string;
  kind: string;
  value: string;
  shareholders: ShareholderDraft[];
  designing: boolean;
};

function shortName(name: string) {
  return name.replace(/^(คุณ|เด็กชาย|เด็กหญิง|นาย|นาง|นางสาว)/, "").slice(0, 2);
}

function emptyShareholder(exclude: string[] = []): ShareholderDraft {
  const available = members.find((m) => !exclude.includes(m.name));
  return {
    member: available?.name ?? members[0]?.name ?? "",
    percent: "",
  };
}

const initialForm: FormState = {
  name: "",
  kind: ENTITY_KINDS[0].id,
  value: "",
  shareholders: [emptyShareholder()],
  designing: false,
};

function entityToForm(entity: Entity): FormState {
  const rows = parseShareholders(entity.shareholders);
  const designing = rows.length === 0;
  return {
    name: entity.name,
    kind: entity.kind,
    value: entity.value ? String(entity.value) : "",
    designing,
    shareholders: designing
      ? [emptyShareholder()]
      : rows.map((r) => ({
          member: r.name,
          percent: r.percent != null ? String(r.percent) : "",
        })),
  };
}

export function AddEntityModal({
  open,
  onClose,
  onSave,
  entity,
}: AddEntityModalProps) {
  const titleId = useId();
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState("");

  const isEdit = Boolean(entity);

  useEffect(() => {
    if (!open) return;
    setForm(entity ? entityToForm(entity) : initialForm);
    setError("");
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, entity]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const shareTotal = useMemo(() => {
    return form.shareholders.reduce((sum, row) => {
      const n = Number(row.percent);
      return sum + (Number.isFinite(n) && n > 0 ? n : 0);
    }, 0);
  }, [form.shareholders]);

  const remaining = Math.round((100 - shareTotal) * 10) / 10;
  const totalOk = Math.abs(shareTotal - 100) <= 0.05;
  const usedMembers = form.shareholders.map((r) => r.member);
  const canAddMore = members.some((m) => !usedMembers.includes(m.name));

  if (!open) return null;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  }

  function updateShareholder(index: number, patch: Partial<ShareholderDraft>) {
    setForm((prev) => ({
      ...prev,
      shareholders: prev.shareholders.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    }));
    setError("");
  }

  function removeShareholder(index: number) {
    setForm((prev) => ({
      ...prev,
      shareholders: prev.shareholders.filter((_, i) => i !== index),
    }));
    setError("");
  }

  function addShareholder() {
    setForm((prev) => {
      const exclude = prev.shareholders.map((r) => r.member);
      return {
        ...prev,
        shareholders: [...prev.shareholders, emptyShareholder(exclude)],
      };
    });
    setError("");
  }

  function distributeEvenly() {
    const n = form.shareholders.length;
    if (n === 0) return;
    const base = Math.floor((100 / n) * 10) / 10;
    const values = Array.from({ length: n }, () => base);
    const diff = Math.round((100 - base * n) * 10) / 10;
    values[0] = Math.round((values[0] + diff) * 10) / 10;
    setForm((prev) => ({
      ...prev,
      shareholders: prev.shareholders.map((row, i) => ({
        ...row,
        percent: String(values[i]),
      })),
    }));
    setError("");
  }

  function fillRemaining(index: number) {
    if (remaining <= 0) return;
    const current = Number(form.shareholders[index]?.percent) || 0;
    updateShareholder(index, {
      percent: String(Math.round((current + remaining) * 10) / 10),
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError("กรุณาระบุชื่อนิติบุคคล");
      return;
    }

    let shareholders = "อยู่ระหว่างออกแบบ";
    if (!form.designing) {
      const rows = form.shareholders
        .map((r) => ({
          member: r.member.trim(),
          percent: Number(r.percent),
        }))
        .filter((r) => r.member && Number.isFinite(r.percent) && r.percent > 0);

      if (rows.length === 0) {
        setError("กรุณาเพิ่มผู้ถือหุ้น หรือเลือกอยู่ระหว่างออกแบบ");
        return;
      }

      const names = new Set(rows.map((r) => r.member));
      if (names.size !== rows.length) {
        setError("ผู้ถือหุ้นซ้ำกัน กรุณาเลือกคนละคน");
        return;
      }

      const total = rows.reduce((s, r) => s + r.percent, 0);
      if (Math.abs(total - 100) > 0.05) {
        setError(`สัดส่วนรวมต้องเป็น 100% (ปัจจุบัน ${total}%)`);
        return;
      }

      shareholders = rows.map((r) => `${r.member} ${r.percent}%`).join(" / ");
    }

    onSave({
      name,
      kind: form.kind,
      value: Number(form.value) || 0,
      shareholders,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center px-3 py-6 sm:items-center sm:px-4 sm:py-10">
        <button
          type="button"
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]"
          aria-label="ปิด"
          onClick={onClose}
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-slate-100 bg-white shadow-2xl sm:rounded-2xl"
        >
          <div className="relative overflow-hidden border-b border-mint-100 bg-linear-to-br from-mint-brandLight via-white to-sky-50/50 px-5 py-5 sm:px-6">
            <div className="pointer-events-none absolute -top-12 -right-10 h-36 w-36 rounded-full bg-mint-brand/10 blur-2xl" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-mint-brand shadow-sm ring-1 ring-slate-100">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 id={titleId} className="text-base font-bold text-slate-900">
                    {isEdit ? "แก้ไขนิติบุคคล" : "เพิ่มนิติบุคคล"}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {isEdit
                      ? `แก้ไขข้อมูล ${entity?.id ?? ""}`
                      : "กำหนดประเภท มูลค่า และโครงสร้างผู้ถือหุ้นในขั้นตอนเดียว"}
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

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="max-h-[min(70vh,640px)] space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              <div>
                <label className={labelClass} htmlFor="entity-name">
                  ชื่อนิติบุคคล
                </label>
                <input
                  id="entity-name"
                  className={`${inputClass} mt-1.5`}
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="เช่น บริษัท แฟมิลี่ โฮลดิ้ง จำกัด"
                  autoFocus
                />
              </div>

              <div>
                <p className={labelClass}>ประเภท</p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {ENTITY_KINDS.map((k) => {
                    const Icon = k.icon;
                    const selected = form.kind === k.id;
                    return (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => setField("kind", k.id)}
                        className={`rounded-2xl border px-3 py-3 text-left transition ${
                          selected
                            ? `${k.tone} ring-1`
                            : k.idle
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <p className="mt-2 text-[11px] font-bold leading-tight">
                          {k.label}
                        </p>
                        <p className="mt-0.5 text-[10px] opacity-70">{k.hint}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="entity-value">
                  มูลค่ากิจการโดยประมาณ
                </label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-xs font-semibold text-slate-400">
                    ฿
                  </span>
                  <input
                    id="entity-value"
                    type="number"
                    min={0}
                    step="0.1"
                    className={`${inputClass} pr-14 pl-8`}
                    value={form.value}
                    onChange={(e) => setField("value", e.target.value)}
                    placeholder="0"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[11px] font-medium text-slate-400">
                    ล้านบาท
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-800">ผู้ถือหุ้น</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      กำหนดสัดส่วนให้ครบ 100%
                    </p>
                  </div>
                  <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5">
                    <button
                      type="button"
                      onClick={() => setField("designing", false)}
                      className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                        !form.designing
                          ? "bg-slate-900 text-white"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      กำหนดแล้ว
                    </button>
                    <button
                      type="button"
                      onClick={() => setField("designing", true)}
                      className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                        form.designing
                          ? "bg-amber-500 text-white"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      อยู่ระหว่างออกแบบ
                    </button>
                  </div>
                </div>

                {form.designing ? (
                  <div className="mt-4 rounded-xl border border-dashed border-amber-200 bg-amber-50/70 px-4 py-6 text-center">
                    <p className="text-xs font-medium text-amber-800">
                      จะบันทึกสถานะเป็น “อยู่ระหว่างออกแบบ”
                    </p>
                    <p className="mt-1 text-[11px] text-amber-700/80">
                      สามารถกลับมาใส่โครงสร้างผู้ถือหุ้นทีหลังได้
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-100">
                      <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-semibold text-slate-600">
                          สัดส่วนรวม
                        </span>
                        <span
                          className={`font-bold tabular-nums ${
                            totalOk
                              ? "text-mint-brand"
                              : shareTotal > 100
                                ? "text-red-600"
                                : "text-slate-800"
                          }`}
                        >
                          {shareTotal}%
                          <span className="font-medium text-slate-400"> / 100%</span>
                        </span>
                      </div>
                      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
                        {form.shareholders.map((row, i) => {
                          const pct = Number(row.percent);
                          if (!Number.isFinite(pct) || pct <= 0) return null;
                          return (
                            <div
                              key={`${row.member}-${i}`}
                              className={SHARE_COLORS[i % SHARE_COLORS.length]}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          );
                        })}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                        <span>
                          {totalOk
                            ? "ครบ 100% พร้อมบันทึก"
                            : remaining > 0
                              ? `เหลือจัดสรรอีก ${remaining}%`
                              : `เกิน ${Math.abs(remaining)}%`}
                        </span>
                        <button
                          type="button"
                          onClick={distributeEvenly}
                          className="font-semibold text-mint-brand hover:text-mint-brandDark"
                        >
                          แบ่งเท่ากัน
                        </button>
                      </div>
                    </div>

                    <div className="max-h-56 space-y-2 overflow-y-auto pr-0.5">
                      {form.shareholders.map((row, index) => {
                        const options = members.filter(
                          (m) =>
                            m.name === row.member ||
                            !usedMembers.includes(m.name),
                        );
                        return (
                          <div
                            key={index}
                            className="flex items-center gap-2 rounded-xl bg-white p-2 ring-1 ring-slate-100"
                          >
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${SHARE_SOFT[index % SHARE_SOFT.length]}`}
                            >
                              {shortName(row.member)}
                            </span>
                            <select
                              className={`${inputClass} min-w-0 flex-1 py-2`}
                              value={row.member}
                              onChange={(e) =>
                                updateShareholder(index, {
                                  member: e.target.value,
                                })
                              }
                            >
                              {options.map((m) => (
                                <option key={m.id} value={m.name}>
                                  {m.name} · {m.relation}
                                </option>
                              ))}
                            </select>
                            <div className="relative w-22 shrink-0">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.1"
                                className={`${inputClass} py-2 pr-7 text-right tabular-nums`}
                                value={row.percent}
                                onChange={(e) =>
                                  updateShareholder(index, {
                                    percent: e.target.value,
                                  })
                                }
                                onDoubleClick={() => fillRemaining(index)}
                                placeholder="0"
                                title="ดับเบิลคลิกเพื่อเติมส่วนที่เหลือ"
                              />
                              <Percent className="pointer-events-none absolute top-1/2 right-2.5 h-3 w-3 -translate-y-1/2 text-slate-300" />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeShareholder(index)}
                              disabled={form.shareholders.length <= 1}
                              className="rounded-lg p-2 text-slate-300 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                              aria-label="ลบผู้ถือหุ้น"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={addShareholder}
                      disabled={!canAddMore}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-mint-200 bg-mint-brandLight/40 px-3 py-2.5 text-xs font-semibold text-mint-brandDark transition hover:bg-mint-brandLight disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      เพิ่มผู้ถือหุ้น
                      {!canAddMore ? " (ครบทุกคนในครอบครัวแล้ว)" : ""}
                    </button>
                  </div>
                )}
              </div>

              {error ? (
                <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-600">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-4 sm:px-6">
              <p className="hidden text-[11px] text-slate-400 sm:block">
                {!form.designing && !totalOk
                  ? "ต้องมีสัดส่วนรวม 100% ก่อนบันทึก"
                  : isEdit
                    ? "การเปลี่ยนแปลงจะถูกบันทึกทันที"
                    : "ข้อมูลจะถูกเพิ่มเข้าพอร์ตนิติบุคคลทันที"}
              </p>
              <div className="ml-auto flex gap-2">
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
                  {isEdit ? "บันทึกการแก้ไข" : "บันทึกนิติบุคคล"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
