"use client";

import { useEffect, useId } from "react";
import { Sparkles, X } from "lucide-react";
import type { Asset, Member } from "@/data/wealth-transfer";
import { ScenarioWizard } from "@/components/wizard/ScenarioWizard";

type WizardModalProps = {
  open: boolean;
  onClose: (reason?: "cancel" | "saved") => void;
  initialAssetId?: string;
  assets?: Asset[];
  members?: Member[];
};

export function WizardModal({
  open,
  onClose,
  initialAssetId,
  assets,
  members,
}: WizardModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="flex min-h-screen items-start justify-center px-3 py-6 text-center sm:px-4 sm:py-8">
        <button
          type="button"
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
          aria-label="ปิด"
          onClick={() => onClose("cancel")}
        />

        <div className="relative flex max-h-[min(92vh,960px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 text-left shadow-xl">
          <div className="flex shrink-0 items-center justify-between border-b border-mint-100 bg-mint-brandLight px-5 py-3.5 sm:px-6">
            <div className="flex items-center gap-2.5 text-mint-brandDark">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm">
                <Sparkles className="h-4 w-4 text-mint-brand" />
              </div>
              <h3 className="text-sm font-bold" id={titleId}>
                Wealth Transfer Plan
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onClose("cancel")}
              className="rounded-lg p-1 text-slate-400 transition hover:bg-white hover:text-slate-600"
              aria-label="ปิดหน้าต่าง"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
            <ScenarioWizard
              key={initialAssetId ?? "new"}
              initialAssetId={initialAssetId}
              assets={assets}
              members={members}
              onClose={onClose}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
