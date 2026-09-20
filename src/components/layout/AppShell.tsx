"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { PlanChatWidget } from "@/components/chat/PlanChatWidget";
import { clearSessionCookie, getOwnerId, getStoredFamilyName } from "@/lib/auth";
import { pageTitles } from "@/lib/nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [familyName, setFamilyName] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const title =
    pathname === "/members" && familyName
      ? familyName
      : (pageTitles[pathname] ?? "Wealth Transfer");

  useEffect(() => {
    setFamilyName(getStoredFamilyName());
  }, []);

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
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mint-neutralLight text-sm text-slate-400">
        กำลังตรวจสอบเซสชัน...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col text-slate-800 antialiased md:flex-row">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-h-screen min-w-0 flex-grow flex-col md:pl-64">
        <Navbar title={title} onMenuClick={() => setSidebarOpen(true)} />
        <main className="mx-auto flex w-full max-w-7xl min-h-0 flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
        <footer className="shrink-0 border-t border-slate-100 bg-white py-6">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-xs text-slate-400 sm:flex-row sm:px-6 lg:px-8">
            <div>© 2026 Wealth Transfer Planning · Mint UI</div>
            <div className="flex space-x-4">
              <span>ข้อมูลผูกกับบัญชีที่เข้าสู่ระบบ</span>
            </div>
          </div>
        </footer>
      </div>
      <PlanChatWidget />
    </div>
  );
}
