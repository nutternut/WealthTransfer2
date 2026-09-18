"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Boxes, Info, Plus, Trash2, X } from "lucide-react";
import type { Asset, AssetOwnerEntry, Member } from "@/data/wealth-transfer";
import {
  ASSET_CATEGORIES,
  ASSET_CATEGORY_HINTS,
  ASSET_SUBTYPES,
  OWNER_KINDS,
  OWNERSHIP_STATUSES,
  isAssetCategory,
  isFreeTextOwnerKind,
  methodsForCategory,
  type AssetCategory,
  type OwnerKind,
} from "@/data/asset-taxonomy";

const ROLES = [
  "ทรัพย์สินหลักครอบครัว",
  "ธุรกิจหลัก",
  "ทรัพย์สินสร้างรายได้",
  "การลงทุน",
  "สภาพคล่อง",
];

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-700 transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none";

const labelClass = "block text-xs font-semibold text-slate-500";

export type AssetFormPayload = Omit<Asset, "id" | "status"> & {
  note?: string;
  holders?: AssetOwnerEntry[];
};

type AddAssetModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (asset: AssetFormPayload) => void | Promise<void>;
  members: Member[];
  saving?: boolean;
  initial?: Asset | null;
  /** เปิดฟอร์มสร้างใหม่ แต่เติมข้อมูลจากรายการเดิม */
  asDuplicate?: boolean;
};

type HolderFormRow = {
  key: string;
  ownerKind: OwnerKind;
  owner: string;
  share: string;
};

type FormState = {
  name: string;
  type: AssetCategory;
  subtype: string;
  detail: string;
  holders: HolderFormRow[];
  value: string;
  assessed: string;
  cost: string;
  acquired: string;
  transferYear: string;
  method: string;
  role: string;
  ownershipStatus: string;
  note: string;
  area: string;
  assessedPerSqWa: string;
  registeredCapital: string;
  parValue: string;
  bookValue: string;
};

let holderKeySeq = 0;
function nextHolderKey() {
  holderKeySeq += 1;
  return `h-${holderKeySeq}`;
}

function defaultHolder(members: Member[]): HolderFormRow {
  return {
    key: nextHolderKey(),
    ownerKind: "บุคคลธรรมดา",
    owner: members[0]?.name ?? "",
    share: "100",
  };
}

function emptyForm(
  category: AssetCategory = "อสังหาริมทรัพย์",
  members: Member[] = [],
): FormState {
  const subtypes = ASSET_SUBTYPES[category];
  return {
    name: "",
    type: category,
    subtype: subtypes[0] ?? "",
    detail: "",
    holders: [defaultHolder(members)],
    value: "",
    assessed: "",
    cost: "",
    acquired: "",
    transferYear: "",
    method: methodsForCategory(category)[0] ?? "ซื้อ",
    role: "ทรัพย์สินหลักครอบครัว",
    ownershipStatus: "สินส่วนตัว",
    note: "",
    area: "",
    assessedPerSqWa: "",
    registeredCapital: "",
    parValue: "",
    bookValue: "",
  };
}

function formFromAsset(asset: Asset, members: Member[]): FormState {
  const type: AssetCategory = isAssetCategory(asset.type)
    ? asset.type
    : "อสังหาริมทรัพย์";
  const subtypes = ASSET_SUBTYPES[type];
  const source =
    asset.owners && asset.owners.length > 0
      ? asset.owners
      : [
          {
            ownerKind: asset.ownerKind ?? ("บุคคลธรรมดา" as OwnerKind),
            owner:
              asset.owner && asset.owner !== "—"
                ? asset.owner
                : (members[0]?.name ?? ""),
            share: asset.share ?? 100,
          },
        ];

  return {
    name: asset.name,
    type,
    subtype: asset.subtype ?? subtypes[0] ?? "",
    detail: asset.detail ?? "",
    holders: source.map((h) => ({
      key: nextHolderKey(),
      ownerKind: h.ownerKind,
      owner: h.owner,
      share: String(h.share),
    })),
    value: asset.value != null ? String(asset.value) : "",
    assessed: asset.assessed != null ? String(asset.assessed) : "",
    cost: asset.cost != null ? String(asset.cost) : "",
    acquired: asset.acquired && asset.acquired !== "-" ? asset.acquired : "",
    transferYear: asset.transferYear ?? "",
    method: asset.method || methodsForCategory(type)[0] || "",
    role: asset.role || "ทรัพย์สินหลักครอบครัว",
    ownershipStatus: asset.ownershipStatus || "สินส่วนตัว",
    note: asset.note ?? "",
    area: asset.area ?? "",
    assessedPerSqWa:
      asset.assessedPerSqWa != null ? String(asset.assessedPerSqWa) : "",
    registeredCapital:
      asset.registeredCapital != null ? String(asset.registeredCapital) : "",
    parValue: asset.parValue != null ? String(asset.parValue) : "",
    bookValue: asset.bookValue != null ? String(asset.bookValue) : "",
  };
}

export function AddAssetModal({
  open,
  onClose,
  onSave,
  members,
  saving = false,
  initial = null,
  asDuplicate = false,
}: AddAssetModalProps) {
  const titleId = useId();
  const isEdit = Boolean(initial) && !asDuplicate;
  const [form, setForm] = useState<FormState>(() =>
    emptyForm("อสังหาริมทรัพย์", members),
  );
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!open) return;
    setFormError("");
    setForm(
      initial ? formFromAsset(initial, members) : emptyForm("อสังหาริมทรัพย์", members),
    );
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, initial, members]);

  const subtypes = ASSET_SUBTYPES[form.type];
  const methods = useMemo(() => methodsForCategory(form.type), [form.type]);

  if (!open) return null;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateHolder(
    key: string,
    patch: Partial<Omit<HolderFormRow, "key">>,
  ) {
    setForm((f) => ({
      ...f,
      holders: f.holders.map((h) => (h.key === key ? { ...h, ...patch } : h)),
    }));
  }

  function addHolder() {
    setForm((f) => {
      const used = new Set(
        f.holders
          .filter((h) => h.ownerKind === "บุคคลธรรมดา")
          .map((h) => h.owner),
      );
      const nextMember = members.find((m) => !used.has(m.name));
      const remaining = Math.max(
        0,
        100 - f.holders.reduce((s, h) => s + (Number(h.share) || 0), 0),
      );
      return {
        ...f,
        holders: [
          ...f.holders,
          {
            key: nextHolderKey(),
            ownerKind: "บุคคลธรรมดา" as OwnerKind,
            owner: nextMember?.name ?? members[0]?.name ?? "",
            share: remaining > 0 ? String(remaining) : "",
          },
        ],
      };
    });
  }

  function removeHolder(key: string) {
    setForm((f) => {
      if (f.holders.length <= 1) return f;
      return { ...f, holders: f.holders.filter((h) => h.key !== key) };
    });
  }

  function distributeEvenly() {
    const n = form.holders.length;
    if (n === 0) return;
    const base = Math.floor((100 / n) * 100) / 100;
    const values = Array.from({ length: n }, () => base);
    const diff = Math.round((100 - base * n) * 100) / 100;
    values[0] = Math.round((values[0] + diff) * 100) / 100;
    setForm((f) => ({
      ...f,
      holders: f.holders.map((h, i) => ({
        ...h,
        share: String(values[i]),
      })),
    }));
  }

  function changeCategory(next: AssetCategory) {
    const nextSubtypes = ASSET_SUBTYPES[next];
    setForm((f) => ({
      ...f,
      type: next,
      subtype: nextSubtypes[0] ?? "",
      method: methodsForCategory(next)[0] ?? f.method,
    }));
  }

  const shareTotal = form.holders.reduce(
    (s, h) => s + (Number(h.share) || 0),
    0,
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFormError("");
    const name = form.name.trim();
    if (!name) return;

    const holders: AssetOwnerEntry[] = [];
    for (const h of form.holders) {
      const ownerName = h.owner.trim();
      if (!ownerName) return;
      if (h.ownerKind === "บุคคลธรรมดา" && members.length === 0) return;
      const share = Math.min(100, Math.max(0.0001, Number(h.share) || 0));
      if (!share) return;
      holders.push({
        ownerKind: h.ownerKind,
        owner: ownerName,
        share,
      });
    }
    if (holders.length === 0) return;

    const parseOptional = (raw: string) => {
      const t = raw.trim();
      if (!t) return undefined;
      const n = Number(t);
      return Number.isFinite(n) ? n : undefined;
    };
    const value = parseOptional(form.value);
    const assessed = parseOptional(form.assessed);
    const cost = parseOptional(form.cost);
    const year = form.acquired.trim()
      ? (() => {
          const raw = form.acquired.trim();
          if (/^\d{4}$/.test(raw)) {
            let y = Number(raw);
            if (y >= 1800 && y <= 2200) y += 543;
            return String(y);
          }
          const d = new Date(raw);
          if (Number.isNaN(d.getTime())) return "-";
          return String(d.getFullYear() + 543);
        })()
      : "-";

    if (form.acquired.trim() && year === "-") {
      setFormError("ปีที่ได้มาไม่ถูกต้อง — ใช้ พ.ศ. เช่น 2545");
      return;
    }
    if (year !== "-") {
      const y = Number(year);
      if (y < 2400 || y > 2800) {
        setFormError("ปีที่ได้มาต้องเป็น พ.ศ. ระหว่าง 2400–2800");
        return;
      }
    }

    const primary = holders[0]!;
    const payload: AssetFormPayload = {
      name,
      type: form.type,
      subtype: form.subtype || undefined,
      detail: form.detail.trim() || undefined,
      owner: primary.owner,
      ownerKind: primary.ownerKind,
      share: primary.share,
      holders,
      owners: holders,
      value,
      assessed,
      cost,
      acquired: year,
      transferYear: form.transferYear.trim() || undefined,
      method: form.method,
      role: form.role,
      ownershipStatus: form.ownershipStatus,
      note: form.note.trim() || undefined,
    };

    if (form.type === "อสังหาริมทรัพย์") {
      payload.area = form.area.trim() || undefined;
      const per = parseOptional(form.assessedPerSqWa);
      if (per != null) payload.assessedPerSqWa = per;
    }

    if (form.type === "หุ้นส่วนบริษัท") {
      const reg = parseOptional(form.registeredCapital);
      const par = parseOptional(form.parValue);
      const book = parseOptional(form.bookValue);
      if (reg != null) payload.registeredCapital = reg;
      if (par != null) payload.parValue = par;
      if (book != null) payload.bookValue = book;
      if (form.detail.trim()) payload.detail = form.detail.trim();
    }

    void onSave(payload);
  }

  const isRealEstate = form.type === "อสังหาริมทรัพย์";
  const isShares = form.type === "หุ้นส่วนบริษัท";
  const isFinancialOrOther =
    form.type === "ทรัพย์สินทางการเงิน" || form.type === "ทรัพย์สินอื่น";
  const categoryHint = ASSET_CATEGORY_HINTS[form.type];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="flex min-h-screen items-center justify-center px-4 py-8 text-center">
        <button
          type="button"
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
          aria-label="ปิด"
          onClick={onClose}
        />

        <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-xl">
          <div className="flex items-center justify-between border-b border-mint-100 bg-mint-brandLight px-6 py-4">
            <div className="flex items-center space-x-2.5 text-mint-brandDark">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm">
                <Boxes className="h-4 w-4 text-mint-brand" />
              </div>
              <div>
                <h3 className="text-sm font-bold" id={titleId}>
                  {isEdit
                    ? "แก้ไขทรัพย์สิน"
                    : asDuplicate
                      ? "ทำซ้ำทรัพย์สิน"
                      : "เพิ่มทรัพย์สิน"}
                </h3>
                <p className="text-[10px] font-medium text-mint-brand/80">
                  {isEdit
                    ? `รหัส ${initial?.id ?? ""}`
                    : asDuplicate
                      ? "สร้างรายการใหม่จากข้อมูลเดิม — ตรวจชื่อและสัดส่วนก่อนบันทึก"
                      : "ตามกลุ่มประเภททรัพย์สินของระบบ"}
                </p>
              </div>
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

          <form onSubmit={handleSubmit}>
            <div className="max-h-[min(70vh,640px)] space-y-5 overflow-y-auto px-6 py-5">
              <section className="space-y-3">
                <h4 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  1. ประเภททรัพย์สิน
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="ประเภททรัพย์สิน *" htmlFor="af-type">
                    <select
                      id="af-type"
                      value={form.type}
                      onChange={(e) => changeCategory(e.target.value as AssetCategory)}
                      className={inputClass}
                    >
                      {ASSET_CATEGORIES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {subtypes.length > 0 ? (
                    <Field label="ตัวอย่าง / ประเภทย่อย *" htmlFor="af-subtype">
                      <select
                        id="af-subtype"
                        value={form.subtype}
                        onChange={(e) => setField("subtype", e.target.value)}
                        className={inputClass}
                      >
                        {subtypes.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : null}
                  {categoryHint ? (
                    <div className="sm:col-span-2 rounded-xl border border-mint-100 bg-mint-brandLight/50 px-3.5 py-2.5 text-[11px] text-mint-brandDark">
                      <span className="font-semibold">ตัวอย่างในกลุ่มนี้: </span>
                      {categoryHint}
                    </div>
                  ) : null}
                  <Field
                    label={isShares ? "ชื่อบริษัท *" : "ชื่อทรัพย์สิน *"}
                    htmlFor="af-name"
                  >
                    <input
                      id="af-name"
                      required
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      placeholder={
                        isShares
                          ? "เช่น บริษัท เอ บิสซิเนส จำกัด"
                          : "เช่น ที่ดินสุขุมวิท"
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="รายละเอียด" htmlFor="af-detail">
                    <input
                      id="af-detail"
                      value={form.detail}
                      onChange={(e) => setField("detail", e.target.value)}
                      placeholder="ระบุรายละเอียด"
                      className={inputClass}
                    />
                  </Field>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                    2. ผู้ถือกรรมสิทธิ์
                  </h4>
                  <div className="flex items-center gap-1">
                    {form.holders.length > 1 ? (
                      <button
                        type="button"
                        onClick={distributeEvenly}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-mint-brand transition hover:bg-mint-brandLight"
                      >
                        สัดส่วนเท่ากัน
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={addHolder}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-mint-brand transition hover:bg-mint-brandLight"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      เพิ่มผู้ถือร่วม
                    </button>
                  </div>
                </div>

                {form.holders.length > 1 ? (
                  <p className="rounded-xl border border-mint-100 bg-mint-brandLight/50 px-3.5 py-2 text-[11px] text-mint-brandDark">
                    กรรมสิทธิ์ร่วม:{" "}
                    {form.holders
                      .map((h) => h.owner.trim())
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </p>
                ) : null}

                <div className="space-y-3">
                  {form.holders.map((h, index) => (
                    <div
                      key={h.key}
                      className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-500">
                          ผู้ถือคนที่ {index + 1}
                        </span>
                        {form.holders.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeHolder(h.key)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-red-500"
                            aria-label={`ลบผู้ถือคนที่ ${index + 1}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <Field
                          label="ประเภทผู้ถือ *"
                          htmlFor={`af-owner-kind-${h.key}`}
                        >
                          <select
                            id={`af-owner-kind-${h.key}`}
                            value={h.ownerKind}
                            onChange={(e) => {
                              const next = e.target.value as OwnerKind;
                              updateHolder(h.key, {
                                ownerKind: next,
                                owner:
                                  next === "บุคคลธรรมดา"
                                    ? (members[0]?.name ?? "")
                                    : "",
                              });
                            }}
                            className={inputClass}
                          >
                            {OWNER_KINDS.map((k) => (
                              <option key={k} value={k}>
                                {k}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field
                          label="ชื่อผู้ถือ *"
                          htmlFor={`af-owner-${h.key}`}
                        >
                          {isFreeTextOwnerKind(h.ownerKind) ? (
                            <input
                              id={`af-owner-${h.key}`}
                              required
                              value={h.owner}
                              onChange={(e) =>
                                updateHolder(h.key, { owner: e.target.value })
                              }
                              placeholder={
                                h.ownerKind === "คนนอก"
                                  ? "ระบุชื่อคนนอก"
                                  : "ระบุชื่อนิติบุคคล"
                              }
                              className={inputClass}
                            />
                          ) : members.length === 0 ? (
                              <p className="rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-2 text-[11px] text-amber-800">
                                ยังไม่มีสมาชิก — เพิ่มที่หน้าสมาชิกก่อน
                              </p>
                            ) : (
                              <select
                                id={`af-owner-${h.key}`}
                                required
                                value={h.owner}
                                onChange={(e) =>
                                  updateHolder(h.key, { owner: e.target.value })
                                }
                                className={inputClass}
                              >
                                {members.map((m) => (
                                  <option key={m.id} value={m.name}>
                                    {m.name}
                                  </option>
                                ))}
                              </select>
                            )}
                        </Field>
                        <Field
                          label="สัดส่วน (%) *"
                          htmlFor={`af-share-${h.key}`}
                        >
                          <input
                            id={`af-share-${h.key}`}
                            type="number"
                            min={0.01}
                            max={100}
                            step="0.01"
                            required
                            value={h.share}
                            onChange={(e) =>
                              updateHolder(h.key, { share: e.target.value })
                            }
                            className={inputClass}
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <p
                    className={`self-end rounded-xl px-3.5 py-2 text-[11px] ${
                      Math.abs(shareTotal - 100) < 0.01
                        ? "bg-mint-brandLight/60 font-semibold text-mint-brandDark"
                        : "bg-amber-50 font-semibold text-amber-800"
                    }`}
                  >
                    รวมสัดส่วน {shareTotal.toFixed(2)}%
                    {Math.abs(shareTotal - 100) >= 0.01
                      ? " — แนะนำให้รวม 100%"
                      : ""}
                  </p>
                  <Field label="บทบาทของทรัพย์สิน" htmlFor="af-role">
                    <select
                      id="af-role"
                      value={form.role}
                      onChange={(e) => setField("role", e.target.value)}
                      className={inputClass}
                    >
                      {ROLES.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="สถานะกรรมสิทธิ์" htmlFor="af-ownership-status">
                    <select
                      id="af-ownership-status"
                      value={form.ownershipStatus}
                      onChange={(e) => setField("ownershipStatus", e.target.value)}
                      className={inputClass}
                    >
                      {OWNERSHIP_STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  3.{" "}
                  {isRealEstate
                    ? "มูลค่าและข้อมูลอสังหาริมทรัพย์"
                    : isShares
                      ? "มูลค่าและข้อมูลหุ้น"
                      : "มูลค่า"}
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {isRealEstate ? (
                    <>
                      <Field label="เนื้อที่ (ไร่-งาน-ตร.ว.)" htmlFor="af-area">
                        <input
                          id="af-area"
                          value={form.area}
                          onChange={(e) => setField("area", e.target.value)}
                          placeholder="เช่น 2-1-20"
                          className={inputClass}
                        />
                      </Field>
                      <Field
                        label="ราคาประเมินต่อตารางวา (บาท)"
                        htmlFor="af-psw"
                      >
                        <input
                          id="af-psw"
                          type="number"
                          step="0.01"
                          min={0}
                          value={form.assessedPerSqWa}
                          onChange={(e) =>
                            setField("assessedPerSqWa", e.target.value)
                          }
                          placeholder="เช่น 21275000"
                          className={inputClass}
                        />
                      </Field>
                      <Field label="ราคาประเมินที่ดิน (บาท)" htmlFor="af-assessed">
                        <input
                          id="af-assessed"
                          type="number"
                          step="0.1"
                          min={0}
                          value={form.assessed}
                          onChange={(e) => setField("assessed", e.target.value)}
                          placeholder="เช่น 21275000"
                          className={inputClass}
                        />
                      </Field>
                      <Field label="ราคาซื้อขายที่ดิน (บาท)" htmlFor="af-value">
                        <input
                          id="af-value"
                          type="number"
                          step="0.1"
                          min={0}
                          value={form.value}
                          onChange={(e) => setField("value", e.target.value)}
                          placeholder="เช่น 21275000"
                          className={inputClass}
                        />
                      </Field>
                      <Field
                        label="ราคาต้นทุนที่ดิน (บาท)"
                        htmlFor="af-cost"
                      >
                        <input
                          id="af-cost"
                          type="number"
                          step="0.1"
                          min={0}
                          value={form.cost}
                          onChange={(e) => setField("cost", e.target.value)}
                          placeholder="กรณีโอนออกจากนิติบุคคล"
                          className={inputClass}
                        />
                      </Field>
                      <Field label="ปีที่ถือครอง" htmlFor="af-acquired">
                        <input
                          id="af-acquired"
                          value={form.acquired}
                          onChange={(e) => setField("acquired", e.target.value)}
                          placeholder="พ.ศ. เช่น 2545"
                          className={inputClass}
                        />
                      </Field>
                      <Field label="ปีที่โอน (ถ้ามี)" htmlFor="af-transfer">
                        <input
                          id="af-transfer"
                          value={form.transferYear}
                          onChange={(e) =>
                            setField("transferYear", e.target.value)
                          }
                          placeholder="พ.ศ."
                          className={inputClass}
                        />
                      </Field>
                      <Field label="วิธีได้มาของอสังหาริมทรัพย์" htmlFor="af-method">
                        <select
                          id="af-method"
                          value={form.method}
                          onChange={(e) => setField("method", e.target.value)}
                          className={inputClass}
                        >
                          {methods.map((m) => (
                            <option key={m}>{m}</option>
                          ))}
                        </select>
                      </Field>
                    </>
                  ) : null}

                  {isShares ? (
                    <>
                      <Field label="ทุนจดทะเบียน (บาท)" htmlFor="af-reg">
                        <input
                          id="af-reg"
                          type="number"
                          step="0.1"
                          min={0}
                          value={form.registeredCapital}
                          onChange={(e) =>
                            setField("registeredCapital", e.target.value)
                          }
                          placeholder="เช่น 21275000"
                          className={inputClass}
                        />
                      </Field>
                      <Field label="มูลค่าหุ้น ราคาพาร์ (บาท)" htmlFor="af-par">
                        <input
                          id="af-par"
                          type="number"
                          step="0.1"
                          min={0}
                          value={form.parValue}
                          onChange={(e) => setField("parValue", e.target.value)}
                          placeholder="เช่น 21275000"
                          className={inputClass}
                        />
                      </Field>
                      <Field
                        label="มูลค่าหุ้น ราคาตลาด (บาท)"
                        htmlFor="af-value"
                      >
                        <input
                          id="af-value"
                          type="number"
                          step="0.1"
                          min={0}
                          value={form.value}
                          onChange={(e) => setField("value", e.target.value)}
                          placeholder="เช่น 21275000"
                          className={inputClass}
                        />
                      </Field>
                      <Field
                        label="มูลค่าหุ้น Book Value (บาท)"
                        htmlFor="af-book"
                      >
                        <input
                          id="af-book"
                          type="number"
                          step="0.1"
                          min={0}
                          value={form.bookValue}
                          onChange={(e) => setField("bookValue", e.target.value)}
                          placeholder="เช่น 21275000"
                          className={inputClass}
                        />
                      </Field>
                      <Field label="มูลค่าต้นทุน (บาท)" htmlFor="af-cost">
                        <input
                          id="af-cost"
                          type="number"
                          step="0.1"
                          min={0}
                          value={form.cost}
                          onChange={(e) => setField("cost", e.target.value)}
                          placeholder="เช่น 21275000"
                          className={inputClass}
                        />
                      </Field>
                      <Field label="ปีที่ได้มา" htmlFor="af-acquired">
                        <input
                          id="af-acquired"
                          value={form.acquired}
                          onChange={(e) => setField("acquired", e.target.value)}
                          placeholder="พ.ศ."
                          className={inputClass}
                        />
                      </Field>
                      <Field label="วิธีได้มา" htmlFor="af-method">
                        <select
                          id="af-method"
                          value={form.method}
                          onChange={(e) => setField("method", e.target.value)}
                          className={inputClass}
                        >
                          {methods.map((m) => (
                            <option key={m}>{m}</option>
                          ))}
                        </select>
                      </Field>
                    </>
                  ) : null}

                  {isFinancialOrOther ? (
                    <>
                      <Field label="มูลค่า (บาท)" htmlFor="af-value">
                        <input
                          id="af-value"
                          type="number"
                          step="0.1"
                          min={0}
                          value={form.value}
                          onChange={(e) => {
                            setField("value", e.target.value);
                            if (!form.assessed) setField("assessed", e.target.value);
                            if (!form.cost) setField("cost", e.target.value);
                          }}
                          placeholder="เช่น 21275000"
                          className={inputClass}
                        />
                      </Field>
                      <Field label="วิธีได้มา" htmlFor="af-method">
                        <select
                          id="af-method"
                          value={form.method}
                          onChange={(e) => setField("method", e.target.value)}
                          className={inputClass}
                        >
                          {methods.map((m) => (
                            <option key={m}>{m}</option>
                          ))}
                        </select>
                      </Field>
                    </>
                  ) : null}
                </div>
              </section>

              <Field label="หมายเหตุ/ข้อจำกัด" htmlFor="af-note">
                <textarea
                  id="af-note"
                  rows={3}
                  value={form.note}
                  onChange={(e) => setField("note", e.target.value)}
                  placeholder="เช่น ต้องการรักษาไว้ในครอบครัว / มีภาระจำนอง / มีข้อจำกัดการโอน"
                  className={inputClass}
                />
              </Field>

              <div className="flex items-start space-x-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-[11px] text-slate-500">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                <span>
                  ฟิลด์มูลค่าตามกลุ่มประเภท — บันทึกข้อเท็จจริงก่อน
                  สมมติฐานภาษีจะกำหนดตอนสร้างสถานการณ์วางแผน
                </span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 border-t border-slate-100 px-6 py-4">
              {formError ? (
                <p className="mr-auto self-center text-[11px] font-medium text-red-600">
                  {formError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-95 disabled:opacity-60"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={
                  saving ||
                  form.holders.some(
                    (h) =>
                      h.ownerKind === "บุคคลธรรมดา" && members.length === 0,
                  )
                }
                className="rounded-xl bg-mint-brand px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-mint-brandDark active:scale-95 disabled:opacity-60"
              >
                {saving
                  ? "กำลังบันทึก..."
                  : isEdit
                    ? "บันทึกการแก้ไข"
                    : asDuplicate
                      ? "บันทึกสำเนา"
                      : "บันทึกทรัพย์สิน"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className={labelClass}>
        {label.includes("*") ? (
          <>
            {label.replace(" *", "")} <span className="text-mint-brand">*</span>
          </>
        ) : (
          label
        )}
      </label>
      {children}
    </div>
  );
}
