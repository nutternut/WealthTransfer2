"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Home, ScrollText, Users } from "lucide-react";
import { fetchAdminStats, type AdminStats } from "@/lib/admin-db";

export default function AdminHomePage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetchAdminStats()
      .then(setStats)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ"),
      );
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          ภาพรวมระบบ
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          บัญชีผู้ใช้ ครอบครัว และเครื่องมือดูแลระบบ
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          {error}
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="บัญชีทั้งหมด" value={stats?.userCount} />
          <StatCard label="ใช้งานอยู่" value={stats?.activeUserCount} />
          <StatCard label="ผู้ดูแล" value={stats?.adminCount} />
          <StatCard label="ครอบครัว" value={stats?.familyCount} />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <AdminLink
          href="/admin/users"
          icon={Users}
          title="บัญชีผู้ใช้"
          detail="เปิด-ปิดบัญชีที่เข้าแอปได้"
        />
        <AdminLink
          href="/admin/families"
          icon={Home}
          title="ครอบครัว"
          detail="ดูครอบครัวและเจ้าของบัญชี"
        />
        <AdminLink
          href="/admin/tax-rules"
          icon={BookOpen}
          title="กฎภาษี"
          detail="รุ่น วันที่มีผล และแหล่งอ้างอิง"
        />
        <AdminLink
          href="/admin/audit"
          icon={ScrollText}
          title="ประวัติการเปลี่ยนแปลง"
          detail="ตรวจว่าใครแก้ข้อมูลเมื่อใด"
        />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4">
      <div className="text-[11px] font-medium text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
        {value == null ? "—" : value}
      </div>
    </div>
  );
}

function AdminLink({
  href,
  icon: Icon,
  title,
  detail,
}: {
  href: string;
  icon: typeof Users;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-100 bg-white p-4 transition hover:border-orange-200 hover:bg-orange-50/40"
    >
      <div className="flex items-center gap-2 text-orange-700">
        <Icon className="h-4 w-4" />
        <span className="text-sm font-semibold text-slate-900">{title}</span>
      </div>
      <p className="mt-1 text-[12px] text-slate-500">{detail}</p>
    </Link>
  );
}
