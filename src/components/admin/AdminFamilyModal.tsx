"use client";

import { useEffect, useId, useState } from "react";
import { Home, X } from "lucide-react";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-700 transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400";

const labelClass = "block text-xs font-semibold text-slate-500";

export type AdminFamilyFormData = {
  name: string;
  ownerUsername: string;
};

export type AdminFamilyOwnerOption = {
  username: string;
  displayName: string | null;
};

type AdminFamilyModalProps = {
  open: boolean;
  initialName?: string;
  initialOwnerUsername?: string;
  ownerOptions: AdminFamilyOwnerOption[];
  saving?: boolean;
  onClose: () => void;
  onSave: (data: AdminFamilyFormData) => void | Promise<void>;
};

export function AdminFamilyModal({
  open,
  initialName,
  initialOwnerUsername,
  ownerOptions,
  saving = false,
  onClose,
  onSave,
}: AdminFamilyModalProps) {
  const titleId = useId();
  const isEdit = Boolean(initialOwnerUsername);
  const [name, setName] = useState("");
  const [ownerUsername, setOwnerUsername] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setName(initialName ?? "");
    setOwnerUsername(initialOwnerUsername ?? ownerOptions[0]?.username ?? "");
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, initialName, initialOwnerUsername, ownerOptions]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("กรุณากรอกชื่อครอบครัว");
      return;
    }
    if (!isEdit && !ownerUsername) {
      setError("ไม่มีบัญชีที่ยังไม่มีครอบครัว");
      return;
    }
    setError("");
    await onSave({
      name: trimmed,
      ownerUsername: isEdit ? (initialOwnerUsername ?? "") : ownerUsername,
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
          disabled={saving}
          onClick={onClose}
        />

        <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-xl">
          <div className="flex items-center justify-between border-b border-orange-100 bg-orange-50 px-6 py-4">
            <div className="flex items-center space-x-2.5 text-orange-800">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm">
                <Home className="h-4 w-4 text-orange-600" />
              </div>
              <h3 className="text-sm font-bold" id={titleId}>
                {isEdit ? "แก้ไขครอบครัว" : "เพิ่มครอบครัว"}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg p-1 text-slate-400 transition hover:bg-white hover:text-slate-600 disabled:opacity-50"
              aria-label="ปิดหน้าต่าง"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-6">
            <div>
              <label htmlFor="admin-family-name" className={labelClass}>
                ชื่อครอบครัว
              </label>
              <input
                id="admin-family-name"
                className={`${inputClass} mt-1.5`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
                placeholder="เช่น ตระกูลสมชาย"
                required
              />
            </div>

            <div>
              <label htmlFor="admin-family-owner" className={labelClass}>
                เจ้าของบัญชี
              </label>
              {isEdit ? (
                <input
                  id="admin-family-owner"
                  className={`${inputClass} mt-1.5`}
                  value={initialOwnerUsername}
                  disabled
                />
              ) : ownerOptions.length === 0 ? (
                <p className="mt-1.5 rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-2 text-[11px] text-amber-800">
                  ทุกบัญชีมีครอบครัวแล้ว — สร้างบัญชีใหม่ก่อน หรือลบครอบครัวเดิม
                </p>
              ) : (
                <select
                  id="admin-family-owner"
                  className={`${inputClass} mt-1.5`}
                  value={ownerUsername}
                  onChange={(e) => setOwnerUsername(e.target.value)}
                  disabled={saving}
                  required
                >
                  {ownerOptions.map((owner) => (
                    <option key={owner.username} value={owner.username}>
                      {owner.username}
                      {owner.displayName ? ` · ${owner.displayName}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {error ? (
              <p className="text-xs font-medium text-rose-600">{error}</p>
            ) : null}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={saving || (!isEdit && ownerOptions.length === 0)}
                className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
              >
                {saving ? "กำลังบันทึก..." : isEdit ? "บันทึก" : "สร้างครอบครัว"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
