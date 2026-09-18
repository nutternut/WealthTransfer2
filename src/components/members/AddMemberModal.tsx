"use client";

import { useEffect, useId, useState } from "react";
import { Check, Heart, UserPlus, Users, X } from "lucide-react";
import type { Member } from "@/data/wealth-transfer";
import { MemberAvatar } from "@/components/members/MemberAvatar";

const GENS = ["รุ่นที่ 1", "รุ่นที่ 2", "รุ่นที่ 3", "รุ่นที่ 4"];
const RELATIONS = [
  "เจ้าของหลัก",
  "คู่สมรส",
  "บุตร",
  "หลาน",
  "พี่น้อง",
  "อื่น ๆ",
];
const STATUSES = ["มีชีวิต", "ถึงแก่กรรม"];

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-700 transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none";

const labelClass = "block text-xs font-semibold text-slate-500";

type MemberFormData = Omit<Member, "id">;

type AddMemberModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (data: MemberFormData) => void | Promise<void>;
  initial?: Member | null;
  allMembers?: Member[];
};

type FormState = {
  name: string;
  gen: string;
  age: string;
  relation: string;
  status: string;
  partnerId: string;
  parentIds: string[];
};

function genNumber(gen: string) {
  const m = /(\d+)/.exec(gen);
  return m ? Number(m[1]) : 0;
}

const emptyForm: FormState = {
  name: "",
  gen: "รุ่นที่ 2",
  age: "",
  relation: "บุตร",
  status: "มีชีวิต",
  partnerId: "",
  parentIds: [],
};

export function AddMemberModal({
  open,
  onClose,
  onSave,
  initial = null,
  allMembers = [],
}: AddMemberModalProps) {
  const titleId = useId();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial);

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    setForm(
      initial
        ? {
            name: initial.name,
            gen: initial.gen,
            age: String(initial.age),
            relation: initial.relation,
            status: initial.status,
            partnerId: initial.partnerId ?? "",
            parentIds: initial.parentIds ?? [],
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const name = form.name.trim();
    if (!name) return;
    const age = Math.max(0, Math.min(120, Number(form.age) || 0));
    setSaving(true);
    try {
      await onSave({
        name,
        gen: form.gen,
        age,
        relation: form.relation,
        status: form.status,
        partnerId: form.partnerId || undefined,
        parentIds: form.parentIds.length > 0 ? form.parentIds : undefined,
      });
      onClose();
    } catch {
      // parent แสดง error แล้ว — ค้างฟอร์มให้แก้ต่อ
    } finally {
      setSaving(false);
    }
  }

  const selfId = initial?.id;
  const genN = genNumber(form.gen);
  const partnerOptions = allMembers.filter(
    (m) => m.id !== selfId && genNumber(m.gen) === genN,
  );
  const parentOptions = allMembers.filter(
    (m) => m.id !== selfId && genNumber(m.gen) === genN - 1,
  );

  function toggleParent(id: string) {
    setForm((f) => {
      const has = f.parentIds.includes(id);
      const next = has
        ? f.parentIds.filter((x) => x !== id)
        : [...f.parentIds, id].slice(-2);
      return { ...f, parentIds: next };
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="flex min-h-screen items-center justify-center px-4 py-8 text-center">
        <button
          type="button"
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
          aria-label="ปิด"
          onClick={onClose}
        />

        <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-xl">
          <div className="flex items-center justify-between border-b border-mint-100 bg-mint-brandLight px-6 py-4">
            <div className="flex items-center space-x-2.5 text-mint-brandDark">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm">
                <UserPlus className="h-4 w-4 text-mint-brand" />
              </div>
              <h3 className="text-sm font-bold" id={titleId}>
                {isEdit ? "แก้ไขสมาชิก" : "เพิ่มสมาชิก"}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 transition hover:bg-white hover:text-slate-600"
              aria-label="ปิดหน้าต่าง"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-6">
            <div>
              <label className={labelClass} htmlFor="member-name">
                ชื่อ-นามสกุล / คำนำหน้า
              </label>
              <input
                id="member-name"
                className={`${inputClass} mt-1.5`}
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="เช่น คุณสมชาย"
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="member-gen">
                  รุ่น
                </label>
                <select
                  id="member-gen"
                  className={`${inputClass} mt-1.5`}
                  value={form.gen}
                  onChange={(e) => setField("gen", e.target.value)}
                >
                  {GENS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="member-age">
                  อายุ (ปี)
                </label>
                <input
                  id="member-age"
                  type="number"
                  min={0}
                  max={120}
                  className={`${inputClass} mt-1.5`}
                  value={form.age}
                  onChange={(e) => setField("age", e.target.value)}
                  placeholder="0"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="member-relation">
                  ความสัมพันธ์
                </label>
                <select
                  id="member-relation"
                  className={`${inputClass} mt-1.5`}
                  value={form.relation}
                  onChange={(e) => setField("relation", e.target.value)}
                >
                  {RELATIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="member-status">
                  สถานะ
                </label>
                <select
                  id="member-status"
                  className={`${inputClass} mt-1.5`}
                  value={form.status}
                  onChange={(e) => setField("status", e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {partnerOptions.length > 0 && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2.5">
                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                  <Heart className="h-3 w-3 text-rose-400" />
                  คู่สมรส · เลือก 1 คน
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setField("partnerId", "")}
                    className={`rounded-lg border px-2 py-1 text-[10px] font-semibold transition ${
                      !form.partnerId
                        ? "border-mint-brand bg-mint-brandLight text-mint-brandDark"
                        : "border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    ไม่ระบุ
                  </button>
                  {partnerOptions.map((m) => {
                    const selected = form.partnerId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          setField("partnerId", selected ? "" : m.id)
                        }
                        className={`inline-flex max-w-[140px] items-center gap-1.5 rounded-lg border px-1.5 py-1 text-left transition ${
                          selected
                            ? "border-mint-brand bg-white ring-1 ring-mint-100"
                            : "border-slate-200 bg-white hover:border-mint-200"
                        }`}
                      >
                        <MemberAvatar
                          seed={m.id}
                          name={m.name}
                          size={20}
                        />
                        <span className="min-w-0 truncate text-[10px] font-semibold text-slate-700">
                          {m.name}
                        </span>
                        {selected && (
                          <Check className="h-2.5 w-2.5 shrink-0 text-mint-brand" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {parentOptions.length > 0 && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2.5">
                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                  <Users className="h-3 w-3 text-mint-brand" />
                  พ่อ/แม่ · สูงสุด 2 คน
                  {form.parentIds.length > 0 && (
                    <span className="ml-auto tabular-nums text-mint-brandDark">
                      {form.parentIds.length}/2
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {parentOptions.map((m) => {
                    const selected = form.parentIds.includes(m.id);
                    const atLimit = form.parentIds.length >= 2 && !selected;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        disabled={atLimit}
                        onClick={() => toggleParent(m.id)}
                        className={`inline-flex max-w-[140px] items-center gap-1.5 rounded-lg border px-1.5 py-1 text-left transition ${
                          selected
                            ? "border-mint-brand bg-white ring-1 ring-mint-100"
                            : atLimit
                              ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-45"
                              : "border-slate-200 bg-white hover:border-mint-200"
                        }`}
                      >
                        <MemberAvatar
                          seed={m.id}
                          name={m.name}
                          size={20}
                        />
                        <span className="min-w-0 truncate text-[10px] font-semibold text-slate-700">
                          {m.name}
                        </span>
                        {selected && (
                          <Check className="h-2.5 w-2.5 shrink-0 text-mint-brand" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-slate-50 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-mint-brand px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-mint-brandDark disabled:opacity-50"
              >
                {saving
                  ? "กำลังบันทึก..."
                  : isEdit
                    ? "บันทึกการแก้ไข"
                    : "เพิ่มสมาชิก"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
