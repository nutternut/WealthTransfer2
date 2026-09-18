"use client";

import { useEffect, useId } from "react";
import { Trash2, X } from "lucide-react";
import type { Asset } from "@/data/wealth-transfer";

type DeleteAssetModalProps = {
  open: boolean;
  assets: Asset[];
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteAssetModal({
  open,
  assets,
  busy = false,
  onClose,
  onConfirm,
}: DeleteAssetModalProps) {
  const titleId = useId();
  const count = assets.length;
  const single = count === 1 ? assets[0] : null;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || count === 0) return null;

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
          disabled={busy}
          onClick={onClose}
        />

        <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-xl">
          <div className="flex items-center justify-between border-b border-rose-100 bg-rose-50 px-6 py-4">
            <div className="flex items-center space-x-2.5 text-rose-700">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm">
                <Trash2 className="h-4 w-4 text-rose-500" />
              </div>
              <h3 className="text-sm font-bold" id={titleId}>
                {single ? "ยืนยันการลบ" : `ยืนยันการลบ ${count} รายการ`}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg p-1 text-slate-400 transition hover:bg-white hover:text-slate-600 disabled:opacity-50"
              aria-label="ปิดหน้าต่าง"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-5 p-6">
            {single ? (
              <p className="text-sm leading-relaxed text-slate-600">
                ลบทรัพย์สิน “
                <span className="font-semibold text-slate-800">{single.name}</span>
                ” ออกจากรายการ?
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm leading-relaxed text-slate-600">
                  ลบทรัพย์สินที่เลือกทั้งหมด {count} รายการ ออกจากรายการ?
                </p>
                <ul className="max-h-40 overflow-y-auto rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {assets.slice(0, 12).map((asset) => (
                    <li key={asset.id} className="truncate py-0.5">
                      {asset.name}
                    </li>
                  ))}
                  {count > 12 ? (
                    <li className="py-0.5 text-slate-400">และอีก {count - 12} รายการ</li>
                  ) : null}
                </ul>
              </div>
            )}
            <p className="text-xs text-slate-400">
              จะลบสถานการณ์และรายการในแผนที่ผูกกับทรัพย์สินนี้ด้วย
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {busy ? "กำลังลบ..." : single ? "ลบทรัพย์สิน" : "ลบทั้งหมด"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
