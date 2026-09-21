"use client";

import { useEffect, useId, useState } from "react";
import { Eye, EyeOff, Power, Shield, UserPlus, X } from "lucide-react";
import type { AdminUserRow } from "@/lib/admin-db";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-700 transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400";

const labelClass = "block text-xs font-semibold text-slate-500";

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,32}$/;

export type AdminUserFormData = {
  username: string;
  password: string;
  displayName: string;
  familyName: string;
  isAdmin: boolean;
  isActive: boolean;
};

type AdminUserModalProps = {
  open: boolean;
  initial?: AdminUserRow | null;
  selfUsername?: string | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (data: AdminUserFormData) => void | Promise<void>;
};

type FormState = AdminUserFormData;

const emptyForm: FormState = {
  username: "",
  password: "",
  displayName: "",
  familyName: "",
  isAdmin: false,
  isActive: true,
};

export function AdminUserModal({
  open,
  initial = null,
  selfUsername = null,
  saving = false,
  onClose,
  onSave,
}: AdminUserModalProps) {
  const titleId = useId();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const isEdit = Boolean(initial);
  const isSelf =
    Boolean(selfUsername) &&
    Boolean(initial) &&
    initial!.username.toLowerCase() === selfUsername!.toLowerCase();

  useEffect(() => {
    if (!open) return;
    setError("");
    setShowPassword(false);
    setForm(
      initial
        ? {
            username: initial.username,
            password: "",
            displayName: initial.displayName ?? "",
            familyName: initial.familyName ?? "",
            isAdmin: initial.isAdmin,
            isActive: initial.isActive,
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
    const username = form.username.trim();
    if (!isEdit && !USERNAME_PATTERN.test(username)) {
      setError("username ใช้ได้เฉพาะ a-z, 0-9, _ ความยาว 3–32 ตัว");
      return;
    }
    if (!isEdit && form.password.length < 4) {
      setError("รหัสผ่านอย่างน้อย 4 ตัวอักษร");
      return;
    }
    if (isEdit && form.password.length > 0 && form.password.length < 4) {
      setError("รหัสผ่านอย่างน้อย 4 ตัวอักษร หรือเว้นว่างถ้าไม่เปลี่ยน");
      return;
    }
    setError("");
    await onSave({
      ...form,
      username,
      displayName: form.displayName.trim(),
      familyName: form.familyName.trim(),
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
                <UserPlus className="h-4 w-4 text-orange-600" />
              </div>
              <h3 className="text-sm font-bold" id={titleId}>
                {isEdit ? "แก้ไขบัญชี" : "เพิ่มบัญชี"}
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
              <label htmlFor="admin-username" className={labelClass}>
                ชื่อผู้ใช้
              </label>
              <input
                id="admin-username"
                className={`${inputClass} mt-1.5`}
                value={form.username}
                onChange={(e) => setField("username", e.target.value)}
                autoComplete="off"
                disabled={isEdit || saving}
                placeholder="เช่น somchai"
                required
              />
            </div>

            <div>
              <label htmlFor="admin-password" className={labelClass}>
                {isEdit ? "รหัสผ่านใหม่" : "รหัสผ่าน"}
              </label>
              <div className="relative mt-1.5">
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  className={`${inputClass} pr-10`}
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  autoComplete="new-password"
                  disabled={saving}
                  placeholder={isEdit ? "เว้นว่างถ้าไม่เปลี่ยน" : "อย่างน้อย 4 ตัว"}
                  required={!isEdit}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                  aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="admin-display" className={labelClass}>
                ชื่อที่แสดง
              </label>
              <input
                id="admin-display"
                className={`${inputClass} mt-1.5`}
                value={form.displayName}
                onChange={(e) => setField("displayName", e.target.value)}
                disabled={saving}
                placeholder="เช่น คุณสมชาย"
              />
            </div>

            <div>
              <label htmlFor="admin-family" className={labelClass}>
                ครอบครัว
              </label>
              <input
                id="admin-family"
                className={`${inputClass} mt-1.5`}
                value={form.familyName}
                onChange={(e) => setField("familyName", e.target.value)}
                disabled={saving}
                placeholder={
                  form.isAdmin ? "เว้นว่างได้ถ้าเป็นผู้ดูแล" : "เช่น ตระกูลสมชาย"
                }
              />
              <p className="mt-1 text-[11px] text-slate-400">
                บัญชีทั่วไปถ้าไม่กรอก จะตั้งเป็น “ครอบครัว ชื่อผู้ใช้”
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <ToggleOption
                checked={form.isAdmin}
                disabled={saving || isSelf}
                tone="orange"
                icon={Shield}
                title="ผู้ดูแลระบบ"
                hint="เข้าหลังบ้านได้"
                onChange={(value) => setField("isAdmin", value)}
              />
              <ToggleOption
                checked={form.isActive}
                disabled={saving || isSelf}
                tone="mint"
                icon={Power}
                title="เปิดใช้งาน"
                hint="ล็อกอินแอปได้"
                onChange={(value) => setField("isActive", value)}
              />
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
                disabled={saving}
                className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
              >
                {saving ? "กำลังบันทึก..." : isEdit ? "บันทึก" : "สร้างบัญชี"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function ToggleOption({
  checked,
  disabled,
  tone,
  icon: Icon,
  title,
  hint,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  tone: "orange" | "mint";
  icon: typeof Shield;
  title: string;
  hint: string;
  onChange: (value: boolean) => void;
}) {
  const on =
    tone === "orange"
      ? {
          card: "border-orange-200 bg-orange-50/80",
          icon: "bg-white text-orange-600 shadow-sm",
          track: "bg-orange-500",
        }
      : {
          card: "border-mint-200 bg-mint-brandLight",
          icon: "bg-white text-mint-brand shadow-sm",
          track: "bg-mint-brand",
        };

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`flex flex-col gap-3 rounded-2xl border px-3 py-3 text-left transition ${
        checked
          ? on.card
          : "border-slate-200 bg-slate-50/60"
      } ${disabled ? "cursor-not-allowed opacity-60" : "hover:border-slate-300"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-xl ${
            checked ? on.icon : "bg-white text-slate-400 ring-1 ring-slate-100"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span
          className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${
            checked ? on.track : "bg-slate-200"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
              checked ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </span>
      </div>
      <div>
        <div className="text-xs font-semibold text-slate-800">{title}</div>
        <div className="mt-0.5 text-[10px] leading-snug text-slate-400">
          {hint}
        </div>
      </div>
    </button>
  );
}
