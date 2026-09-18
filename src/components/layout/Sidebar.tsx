"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, LogOut, X } from "lucide-react";
import { getStoredDisplayName, getStoredFamilyName, getStoredUsername, logout } from "@/lib/auth";
import { navGroups } from "@/lib/nav";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [displayName, setDisplayName] = useState("ผู้ใช้");
  const [familyLabel, setFamilyLabel] = useState("");
  const [initials, setInitials] = useState("U");
  const logoutTitleId = useId();

  useEffect(() => {
    const name = getStoredDisplayName() || getStoredUsername() || "ผู้ใช้";
    const family = getStoredFamilyName() || "";
    setDisplayName(name);
    setFamilyLabel(family);
    const parts = name.replace(/^คุณ/, "").trim().split(/\s+/);
    const letters = parts
      .slice(0, 2)
      .map((p) => p[0] ?? "")
      .join("");
    setInitials(letters || (getStoredUsername()?.slice(0, 2).toUpperCase() ?? "U"));
  }, []);

  useEffect(() => {
    if (!logoutOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [logoutOpen]);

  async function confirmLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutOpen(false);
    try {
      await logout();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-100 bg-white transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-50 px-6">
          <Link href="/dashboard" className="flex items-center space-x-3" onClick={onClose}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint-brandLight text-mint-brand">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-mint-neutralDark">
                WEALTH
              </span>
              <span className="ml-1.5 rounded-md bg-mint-brandLight px-1.5 py-0.5 text-[10px] font-medium text-mint-brand">
                TRANSFER
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600 md:hidden"
            aria-label="ปิดเมนู"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-grow space-y-6 overflow-y-auto px-4 py-6">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1.5">
              <h4 className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {group.title}
              </h4>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center space-x-3 rounded-xl px-3 py-2.5 text-xs transition-all duration-150 ${
                        active
                          ? "bg-mint-brandLight font-semibold text-mint-brand"
                          : "font-medium text-slate-500 hover:bg-slate-50/80 hover:text-slate-900"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-shrink-0 items-center space-x-3 border-t border-slate-50 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint-brand text-xs font-semibold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-grow">
            <div className="truncate text-xs font-semibold text-slate-700">
              {displayName}
            </div>
            <div className="truncate text-[10px] text-slate-400">
              {familyLabel || "Wealth Transfer"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
            aria-label="ออกจากระบบ"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {logoutOpen ? (
        <div
          className="fixed inset-0 z-60 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby={logoutTitleId}
        >
          <div className="flex min-h-screen items-center justify-center px-4 py-8 text-center">
            <button
              type="button"
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
              aria-label="ปิด"
              onClick={() => setLogoutOpen(false)}
            />

            <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-xl">
              <div className="flex items-center justify-between border-b border-rose-100 bg-rose-50 px-5 py-4">
                <div className="flex items-center space-x-2.5 text-rose-700">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm">
                    <LogOut className="h-4 w-4 text-rose-500" />
                  </div>
                  <h3 className="text-sm font-bold" id={logoutTitleId}>
                    ออกจากระบบ
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setLogoutOpen(false)}
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-white hover:text-slate-600"
                  aria-label="ปิดหน้าต่าง"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-5 p-5">
                <p className="text-xs leading-relaxed text-slate-600">
                  คุณต้องการออกจากระบบหรือไม่? จะต้องเข้าสู่ระบบอีกครั้งเพื่อใช้งานต่อ
                </p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setLogoutOpen(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={confirmLogout}
                    className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-600"
                  >
                    ออกจากระบบ
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
