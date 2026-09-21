"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";

export type ToastKind = "success" | "error";

export type ToastState = {
  kind: ToastKind;
  message: string;
} | null;

export function useToast(durationMs = 3200) {
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), durationMs);
    return () => window.clearTimeout(id);
  }, [toast, durationMs]);

  const showSuccess = useCallback((message: string) => {
    setToast({ kind: "success", message });
  }, []);
  const showError = useCallback((message: string) => {
    setToast({ kind: "error", message });
  }, []);
  const clear = useCallback(() => setToast(null), []);

  return {
    toast,
    showSuccess,
    showError,
    clear,
  };
}

export function Toast({
  toast,
  onClose,
}: {
  toast: ToastState;
  onClose: () => void;
}) {
  if (!toast) return null;

  const isError = toast.kind === "error";

  return (
    <div
      role="alert"
      className={`fixed top-5 left-1/2 z-[70] flex max-w-[min(92vw,420px)] -translate-x-1/2 items-start gap-3 rounded-xl border bg-white px-4 py-3 text-sm shadow-[0_12px_40px_-12px_rgba(18,40,71,0.28)] animate-[fadeUp_0.25s_ease-out] ${
        isError
          ? "border-rose-200 text-rose-700"
          : "border-mint-100 text-mint-brandDark"
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          isError
            ? "bg-rose-100 text-rose-600"
            : "bg-mint-brandLight text-mint-brand"
        }`}
      >
        {isError ? "!" : <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <p className="min-w-0 flex-1 font-medium leading-snug">{toast.message}</p>
      <button
        type="button"
        onClick={onClose}
        className={`shrink-0 rounded-md p-0.5 transition ${
          isError
            ? "text-rose-400 hover:bg-rose-50 hover:text-rose-600"
            : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
        }`}
        aria-label="ปิด"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
