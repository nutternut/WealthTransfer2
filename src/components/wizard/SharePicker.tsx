"use client";

import { useId } from "react";
import { MintRange } from "@/components/ui/MintRange";
import { money } from "@/lib/format";

type SharePickerProps = {
  value: number;
  max: number;
  transferValueLabel: string;
  assetValue: number;
  onChange: (value: number) => void;
};

const PRESETS = [25, 50, 75, 100] as const;

export function SharePicker({
  value,
  max,
  transferValueLabel,
  assetValue,
  onChange,
}: SharePickerProps) {
  const uid = useId();
  const gradId = `share-grad-${uid.replace(/:/g, "")}`;
  const clamped = Math.min(Math.max(1, value), max);
  const ofMax = max > 0 ? (clamped / max) * 100 : 0;
  const remainingShare = Math.max(0, max - clamped);
  const remainingValue = (assetValue * remainingShare) / 100;

  const size = 108;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (ofMax / 100) * circumference;

  function setShare(next: number) {
    const n = Math.round(Number.isFinite(next) ? next : 1);
    onChange(Math.min(max, Math.max(1, n)));
  }

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-mint-100 bg-white shadow-sm">
      <div className="bg-linear-to-br from-mint-brandLight via-white to-mint-50/60 p-4 sm:p-5">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <svg width={size} height={size} className="-rotate-90">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth={stroke}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={`url(#${gradId})`}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="transition-[stroke-dashoffset] duration-300 ease-out"
              />
              <defs>
                <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#1b3a5c" />
                  <stop offset="100%" stopColor="#3a5f8a" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <div className="text-2xl font-bold tracking-tight text-mint-brandDark">
                  {clamped}
                  <span className="text-sm">%</span>
                </div>
                <div className="text-[9px] font-semibold tracking-wide text-slate-400 uppercase">
                  ส่งต่อ
                </div>
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-slate-500">
              สัดส่วนที่ส่งต่อ
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              จากกรรมสิทธิ์สูงสุด{" "}
              <span className="font-bold text-slate-800">{max}%</span>
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              ใช้ปุ่มลัดหรือเลื่อนแถบด้านล่างเพื่อปรับค่า
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const presetValue = Math.max(1, Math.round((max * p) / 100));
            const active = clamped === presetValue;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setShare(presetValue)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                  active
                    ? "bg-mint-brand text-white shadow-sm shadow-mint-brand/25"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-mint-300 hover:text-mint-brandDark"
                }`}
              >
                {p === 100 ? "ทั้งหมด" : `${p}%`}
              </button>
            );
          })}
        </div>

        <MintRange
          className="mt-4"
          min={1}
          max={max}
          value={clamped}
          onChange={setShare}
          aria-label="ปรับสัดส่วนที่ส่งต่อ"
        />
      </div>

      <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100">
        <div className="px-4 py-3">
          <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            มูลค่าที่ส่งต่อ
          </div>
          <div className="mt-1 text-sm font-bold text-mint-brandDark">
            {transferValueLabel}
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            คงเหลือผู้โอน
          </div>
          <div className="mt-1 text-sm font-bold text-slate-700">
            {remainingShare}%
            <span className="ml-1.5 text-[11px] font-medium text-slate-400">
              ≈ {money(remainingValue)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
