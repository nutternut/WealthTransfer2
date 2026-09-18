"use client";

import {
  Banknote,
  CalendarRange,
  Check,
  Gift,
  Layers,
  ScrollText,
} from "lucide-react";
import type { TransferMethod } from "@/lib/scenario-store";

const METHODS: {
  id: TransferMethod;
  desc: string;
  tip: string;
  icon: typeof Gift;
}[] = [
  {
    id: "ให้",
    desc: "โอนโดยไม่มีค่าตอบแทน",
    tip: "เร็วและตรงไปตรงมา เหมาะกับทรัพย์สินที่ไม่ซับซ้อน",
    icon: Gift,
  },
  {
    id: "ซื้อขาย",
    desc: "ผู้รับชำระค่าทรัพย์สิน",
    tip: "ใช้เมื่อต้องการเปลี่ยนมือแบบมีราคาชัดเจน",
    icon: Banknote,
  },
  {
    id: "มรดก",
    desc: "ส่งต่อเมื่อเกิดการรับมรดก",
    tip: "รักษาการควบคุมไว้ก่อน ส่งต่อภายหลัง",
    icon: ScrollText,
  },
];

const YEARS = ["2569", "2570", "2571", "2572", "2573"] as const;
const DURATION_OPTIONS = [1, 2, 3, 5, 10] as const;

const inputClass =
  "w-full rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-xs text-slate-700 shadow-sm transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none";

type MethodPickerProps = {
  method: TransferMethod;
  year: string;
  durationYears: number;
  salePrice: number;
  onMethodChange: (method: TransferMethod) => void;
  onYearChange: (year: string) => void;
  onDurationYearsChange: (years: number) => void;
  onSalePriceChange: (price: number) => void;
};

export function MethodPicker({
  method,
  year,
  durationYears,
  salePrice,
  onMethodChange,
  onYearChange,
  onDurationYearsChange,
  onSalePriceChange,
}: MethodPickerProps) {
  const selected = METHODS.find((m) => m.id === method) ?? METHODS[0];
  const SelectedIcon = selected.icon;

  const selectionMeta =
    method === "ให้" || method === "ทยอยให้"
      ? `พ.ศ. ${year} · ${durationYears} ปี`
      : method === "ซื้อขาย"
        ? `พ.ศ. ${year} · ${salePrice || 0} บาท`
        : "เมื่อรับมรดก";

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="border-b border-mint-100/80 bg-linear-to-r from-mint-brandLight/50 via-white to-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint-brandLight text-mint-brand">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                วิธีและช่วงเวลา
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                เลือกแนวทางหนึ่งแบบ แล้วกรอกรายละเอียดที่จำเป็น
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-mint-100 bg-white px-3.5 py-2.5 shadow-sm">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-mint-brandLight text-mint-brand">
              <SelectedIcon className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                ที่เลือกไว้
              </div>
              <div className="text-sm font-bold text-mint-brandDark">
                {selected.id}
                <span className="ml-1.5 font-medium text-slate-400">
                  · {selectionMeta}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-3 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
          เลือกวิธีการส่งต่อ
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {METHODS.map((m) => {
            const active = method === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onMethodChange(m.id)}
                className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200 ${
                  active
                    ? "border-mint-brand bg-linear-to-br from-mint-brandLight via-mint-100/70 to-mint-50 shadow-md shadow-mint-brand/15 ring-2 ring-mint-brand/20"
                    : "border-slate-100 bg-white hover:-translate-y-0.5 hover:border-mint-200 hover:shadow-sm"
                }`}
              >
                <span
                  className={`absolute inset-x-0 top-0 h-1 ${
                    active
                      ? "bg-linear-to-r from-mint-brand to-mint-400"
                      : "bg-transparent group-hover:bg-mint-100"
                  }`}
                  aria-hidden
                />
                {active && (
                  <span className="absolute top-3 right-3 grid h-5 w-5 place-items-center rounded-full bg-mint-brand text-white shadow-sm">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
                <div
                  className={`mb-3 grid h-10 w-10 place-items-center rounded-xl transition ${
                    active
                      ? "bg-white text-mint-brand shadow-sm"
                      : "bg-slate-50 text-slate-400 ring-1 ring-slate-100"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="pr-6 text-sm font-bold text-slate-900">{m.id}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {m.desc}
                </p>
                <p
                  className={`mt-2 text-[11px] leading-relaxed ${
                    active ? "text-mint-brandDark" : "text-slate-400"
                  }`}
                >
                  {m.tip}
                </p>
              </button>
            );
          })}
        </div>

        {(method === "ให้" || method === "ทยอยให้") && (
          <div className="mt-5 animate-[scaleIn_0.25s_ease] rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-mint-brand" />
              <div>
                <div className="text-sm font-bold text-slate-900">ช่วงเวลา</div>
                <div className="text-[11px] text-slate-400">
                  กำหนดปีที่เริ่มต้นและจำนวนปี — ยกเว้นภาษีการให้ 20 ลบ./คน × จำนวนปี
                </div>
              </div>
            </div>

            <div className="mb-2 text-xs font-semibold text-slate-500">
              ปีที่เริ่มต้น
            </div>
            <div className="flex flex-wrap gap-2">
              {YEARS.map((y) => {
                const active = year === y;
                return (
                  <button
                    key={y}
                    type="button"
                    onClick={() => onYearChange(y)}
                    className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${
                      active
                        ? "bg-mint-brand text-white shadow-sm shadow-mint-brand/25"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-mint-300 hover:text-mint-brandDark"
                    }`}
                  >
                    พ.ศ. {y}
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <div className="mb-2 text-xs font-semibold text-slate-500">
                จำนวนปี
              </div>
              <div className="flex flex-wrap gap-2">
                {DURATION_OPTIONS.map((n) => {
                  const active = durationYears === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onDurationYearsChange(n)}
                      className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${
                        active
                          ? "bg-mint-brand text-white shadow-sm shadow-mint-brand/25"
                          : "border border-slate-200 bg-white text-slate-600 hover:border-mint-300 hover:text-mint-brandDark"
                      }`}
                    >
                      {n} ปี
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 max-w-xs">
                <label className="mb-1.5 block text-xs font-semibold text-slate-500" htmlFor="wz-duration">
                  หรือระบุจำนวนปี
                </label>
                <input
                  id="wz-duration"
                  type="number"
                  min={1}
                  max={50}
                  className={inputClass}
                  value={durationYears}
                  onChange={(e) =>
                    onDurationYearsChange(
                      Math.max(1, Math.min(50, Number(e.target.value) || 1)),
                    )
                  }
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                ให้ตั้งแต่ พ.ศ. {year} เป็นระยะเวลา {durationYears} ปี
              </p>
            </div>
          </div>
        )}

        {method === "ซื้อขาย" && (
          <div className="mt-5 animate-[scaleIn_0.25s_ease] rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Banknote className="h-4 w-4 text-mint-brand" />
              <div>
                <div className="text-sm font-bold text-slate-900">รายละเอียดการขาย</div>
                <div className="text-[11px] text-slate-400">
                  กำหนดปีที่ขายและราคาขาย
                </div>
              </div>
            </div>

            <div className="mb-2 text-xs font-semibold text-slate-500">
              ปีที่ขาย
            </div>
            <div className="flex flex-wrap gap-2">
              {YEARS.map((y) => {
                const active = year === y;
                return (
                  <button
                    key={y}
                    type="button"
                    onClick={() => onYearChange(y)}
                    className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${
                      active
                        ? "bg-mint-brand text-white shadow-sm shadow-mint-brand/25"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-mint-300 hover:text-mint-brandDark"
                    }`}
                  >
                    พ.ศ. {y}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 max-w-xs">
              <label className="mb-1.5 block text-xs font-semibold text-slate-500" htmlFor="wz-sale">
                ราคาขาย (บาท)
              </label>
              <input
                id="wz-sale"
                type="number"
                step="0.1"
                min={0}
                className={inputClass}
                value={salePrice}
                onChange={(e) => onSalePriceChange(Number(e.target.value) || 0)}
              />
              <p className="mt-2 text-[11px] text-slate-400">
                ใช้เป็นฐานคำนวณเมื่อเลือกวิธีซื้อขาย
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-mint-100 bg-mint-brandLight/40 px-4 py-3 text-xs leading-relaxed text-mint-brandDark">
          <span className="font-bold">{selected.id}</span>
          {" · "}
          {selected.tip}
        </div>
      </div>
    </section>
  );
}

export function formatMethodYear(
  method: TransferMethod,
  year: string,
  durationYears: number,
): string {
  if (method === "มรดก") return "เมื่อรับมรดก";
  if (method === "ให้" || method === "ทยอยให้") {
    return `${year} (${durationYears} ปี)`;
  }
  return year;
}
