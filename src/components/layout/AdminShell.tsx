"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Navbar } from "@/components/layout/Navbar";
import {
  clearSessionCookie,
  getOwnerId,
  getStoredIsAdmin,
} from "@/lib/auth";
import { adminPageTitles } from "@/lib/admin-nav";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const title = adminPageTitles[pathname] ?? "หลังบ้าน";

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const ownerId = await getOwnerId();
      if (cancelled) return;
      if (!ownerId) {
        clearSessionCookie();
        router.replace("/login");
        return;
      }
      if (!getStoredIsAdmin()) {
        router.replace("/dashboard");
        return;
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mint-neutralLight text-sm text-slate-400">
        กำลังตรวจสอบสิทธิ์ผู้ดูแล...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col text-slate-800 antialiased md:flex-row">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-h-screen min-w-0 flex-grow flex-col md:pl-64">
        <Navbar title={title} onMenuClick={() => setSidebarOpen(true)} />
        <main className="mx-auto flex w-full max-w-7xl min-h-0 flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
        <footer className="shrink-0 border-t border-slate-100 bg-white py-6">
          <div className="mx-auto max-w-7xl px-4 text-xs text-slate-400 sm:px-6 lg:px-8">
            Wealth Transfer · หลังบ้านผู้ดูแลระบบ
          </div>
        </footer>
      </div>
    </div>
  );
}
