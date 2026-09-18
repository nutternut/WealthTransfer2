"use client";

import { Check } from "lucide-react";

const FULL_STEPS = [
  { label: "ทรัพย์สิน", hint: "ผู้โอน" },
  { label: "ผู้รับ", hint: "สัดส่วน" },
  { label: "วิธี/เวลา", hint: "แนวทาง" },
  { label: "สมมติฐาน", hint: "ภาษี" },
] as const;

const SKIP_ASSET_STEPS = [
  { label: "ผู้รับ", hint: "สัดส่วน" },
  { label: "วิธี/เวลา", hint: "แนวทาง" },
  { label: "สมมติฐาน", hint: "ภาษี" },
] as const;

type WizardStepperProps = {
  current: number;
  /** Hide asset/owner step (e.g. opened from a specific asset) */
  skipAssetStep?: boolean;
};

export function WizardStepper({
  current,
  skipAssetStep = false,
}: WizardStepperProps) {
  const steps = skipAssetStep ? SKIP_ASSET_STEPS : FULL_STEPS;
  const displayCurrent = skipAssetStep ? current - 1 : current;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-mint-100/80 bg-gradient-to-br from-mint-brandLight/40 via-white to-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
          ความคืบหน้า
        </span>
        <span className="rounded-full bg-mint-brand/10 px-2.5 py-0.5 text-[11px] font-bold text-mint-brandDark">
          ขั้นที่ {displayCurrent} จาก {steps.length}
        </span>
      </div>

      <ol className="relative flex items-start justify-between gap-2">
        {steps.map((step, i) => {
          const n = i + 1;
          const done = n < displayCurrent;
          const active = n === displayCurrent;
          const lineDone = n < displayCurrent;

          return (
            <li
              key={step.label}
              className="relative z-10 flex flex-1 flex-col items-center text-center"
            >
              {i < steps.length - 1 ? (
                <span
                  className="pointer-events-none absolute top-4 left-[calc(50%+18px)] h-0.5 w-[calc(100%-36px)]"
                  aria-hidden
                >
                  <span className="block h-full overflow-hidden rounded-full bg-slate-100">
                    <span
                      className={`block h-full rounded-full bg-mint-brand transition-all duration-500 ${
                        lineDone ? "w-full" : "w-0"
                      }`}
                    />
                  </span>
                </span>
              ) : null}

              <span
                className={`relative mb-2 grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition-all duration-300 ${
                  done
                    ? "bg-mint-brand text-white shadow-md shadow-mint-brand/25"
                    : active
                      ? "scale-105 bg-white text-mint-brand shadow-md shadow-mint-brand/20 ring-2 ring-mint-brand ring-offset-2 ring-offset-white"
                      : "bg-white text-slate-400 ring-1 ring-slate-200"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}
              </span>

              <span
                className={`text-[11px] font-bold transition-colors sm:text-xs ${
                  active
                    ? "text-mint-brandDark"
                    : done
                      ? "text-slate-700"
                      : "text-slate-400"
                }`}
              >
                {step.label}
              </span>
              <span
                className={`mt-0.5 text-[10px] transition-colors ${
                  active ? "text-mint-brand/80" : "text-slate-400"
                }`}
              >
                {step.hint}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
