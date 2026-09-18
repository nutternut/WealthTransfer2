"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarRange,
  CheckCircle2,
  Coins,
  Gift,
  HandHeart,
  Handshake,
  Landmark,
  Lightbulb,
  Scale,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { InheritanceTaxSummary } from "@/components/plan/InheritanceTaxSummary";
import { PlanTaxBreakdown } from "@/components/plan/PlanTaxBreakdown";
import type { Asset, Member, PlanItem } from "@/data/wealth-transfer";
import { assetEffectiveValue, money } from "@/lib/format";
import type { CostLine, ReceiverInheritanceTaxSummary } from "@/lib/transfer-cost";
import type { CalcStatus } from "@/lib/transfer-cost";
import type { GiftLedgerSummary, PlanCostBreakdown } from "@/lib/plan-tax";

type YearlyCost = { year: string; amount: number; percent: number };

type PlanViewProps = {
  plan: PlanItem[];
  assets: Asset[];
  members: Member[];
  yearlyCosts: YearlyCost[];
  /** สรุปภาษีมรดกรวมต่อผู้รับ (ยกเว้น 100 ลบ./คน ครั้งเดียว) */
  inheritanceByReceiver?: ReceiverInheritanceTaxSummary[];
  giftLedgers?: GiftLedgerSummary[];
  breakdown?: PlanCostBreakdown;
  calcStatus?: CalcStatus;
  missingDataCount?: number;
  reviewRequiredCount?: number;
  warnings?: string[];
  itemLines?: Record<string, CostLine[]>;
};

type PlanRow = PlanItem & {
  assetType: string;
  transferValue: number;
};

const METHOD_TONE: Record<
  string,
  { bg: string; text: string; ring: string; soft: string; dot: string }
> = {
  ให้: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    ring: "ring-amber-200",
    soft: "from-amber-50/90 via-white to-white",
    dot: "bg-amber-400",
  },
  ซื้อขาย: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    ring: "ring-sky-200",
    soft: "from-sky-50/90 via-white to-white",
    dot: "bg-sky-400",
  },
  มรดก: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    ring: "ring-violet-200",
    soft: "from-violet-50/90 via-white to-white",
    dot: "bg-violet-400",
  },
  ทยอยให้: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    ring: "ring-orange-200",
    soft: "from-orange-50/90 via-white to-white",
    dot: "bg-orange-400",
  },
};

function methodTone(method: string) {
  return (
    METHOD_TONE[method] ?? {
      bg: "bg-mint-brandLight",
      text: "text-mint-brandDark",
      ring: "ring-mint-200",
      soft: "from-mint-brandLight/90 via-white to-white",
      dot: "bg-mint-brand",
    }
  );
}

function MethodIcon({ method, className = "h-5 w-5" }: { method: string; className?: string }) {
  if (method === "ให้" || method === "ทยอยให้") return <Gift className={className} />;
  if (method === "ซื้อขาย") return <Handshake className={className} />;
  if (method === "มรดก") return <Landmark className={className} />;
  return <Scale className={className} />;
}

function parseSharePercent(share: string) {
  const value = Number.parseFloat(share.replace("%", ""));
  return Number.isNaN(value) ? 0 : value;
}

function initials(name: string) {
  return name.replace(/^คุณ|^เด็ก(?:ชาย|หญิง)/, "").slice(0, 2);
}

function CoverageRing({ percent }: { percent: number }) {
  const pct = Math.min(100, Math.max(0, percent));
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          className="text-white/40"
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="text-white transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <span className="text-3xl font-bold tabular-nums">{pct.toFixed(0)}%</span>
        <span className="text-[11px] font-medium text-white/80">ครอบคลุมแล้ว</span>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  tone = "mint",
  delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone?: "mint" | "emerald" | "amber" | "sky";
  delay?: number;
}) {
  const tones = {
    mint: "bg-mint-brandLight text-mint-brand",
    emerald: "bg-mint-brandLight text-mint-brand",
    amber: "bg-amber-50 text-amber-600",
    sky: "bg-sky-50 text-sky-600",
  };

  return (
    <div
      style={{ animationDelay: `${delay}ms` }}
      className="animate-[fadeUp_0.45s_ease-out_both] rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100/80 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200/60"
    >
      <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}>
        {icon}
      </div>
      <div className="text-[11px] font-medium text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-slate-900">
        {value}
      </div>
      <div className="mt-1.5 text-xs text-slate-400">{sub}</div>
    </div>
  );
}

export function PlanView({
  plan,
  assets,
  members,
  yearlyCosts,
  inheritanceByReceiver = [],
  giftLedgers = [],
  breakdown,
  calcStatus = "Estimated",
  missingDataCount = 0,
  reviewRequiredCount = 0,
  warnings = [],
  itemLines = {},
}: PlanViewProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const planRows: PlanRow[] = plan.map((item) => {
    const asset = item.assetId
      ? assets.find((candidate) => candidate.id === item.assetId) ??
        assets.find((candidate) => candidate.name === item.asset)
      : assets.find((candidate) => candidate.name === item.asset);
    const sharePercent = parseSharePercent(item.share);
    const assetValue = asset
      ? (assetEffectiveValue(asset.value, asset.share) ?? 0)
      : 0;
    const transferValue = (assetValue * sharePercent) / 100;

    return {
      ...item,
      assetType: asset?.type ?? "-",
      transferValue,
    };
  });

  const totalAssetValue = assets.reduce(
    (sum, item) => sum + (assetEffectiveValue(item.value, item.share) ?? 0),
    0,
  );
  const totalTransferValue = planRows.reduce((sum, item) => sum + item.transferValue, 0);
  const totalPlanCost = planRows.reduce((sum, item) => sum + item.cost, 0);
  const coveragePct = totalAssetValue ? (totalTransferValue / totalAssetValue) * 100 : 0;
  const costRatio = totalTransferValue ? (totalPlanCost / totalTransferValue) * 100 : 0;
  const pendingAssets = assets.filter((item) => item.status !== "มีแผนแล้ว").slice(0, 3);
  const nextMilestone = yearlyCosts[0];
  const maxYearlyCost = Math.max(...yearlyCosts.map((item) => item.amount), 1);
  const totalInheritanceTax = inheritanceByReceiver.reduce((s, r) => s + r.tax, 0);

  const receiverCards = Array.from(
    new Set(planRows.flatMap((item) => item.receiver.split("+").map((name) => name.trim()))),
  )
    .map((name) => {
      const member = members.find((item) => item.name === name);
      const assignedItems = planRows.filter((item) => item.receiver.includes(name));

      return {
        name,
        relation: member?.relation ?? "ผู้รับตามแผน",
        generation: member?.gen ?? "-",
        items: assignedItems.length,
        plannedValue: assignedItems.reduce((sum, item) => sum + item.transferValue, 0),
      };
    })
    .sort((a, b) => b.plannedValue - a.plannedValue);

  return (
    <div className="animate-[fadeUp_0.35s_ease-out]">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <p className="mb-1 text-xs font-semibold tracking-wide text-mint-brand">
          การวางแผน
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          แผนการส่งต่อ
        </h1>
        <p className="mt-1 max-w-xl text-sm text-slate-500">
          สรุปทรัพย์สินที่เลือกเข้าแผน ผู้รับปลายทาง และช่วงเวลาที่ต้องดำเนินการ
        </p>
      </div>

      {/* Hero summary */}
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-linear-to-br from-mint-brand via-mint-brandDark to-slate-900 p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-mint-300/20 blur-3xl" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl text-white">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              แผนปัจจุบัน · พร้อมดำเนินการ
            </div>
            <h2 className="text-xl font-bold sm:text-2xl">
              ส่งต่อ {money(totalTransferValue)} ใน {planRows.length} รายการ
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/80">
              ค่าใช้จ่ายรวมประมาณ {money(totalPlanCost)} ({costRatio.toFixed(1)}% ของมูลค่าส่งต่อ)
              · ครอบคลุมผู้รับ {receiverCards.length} คน
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/timeline"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-mint-brandDark transition hover:bg-white/90"
              >
                <CalendarRange className="h-3.5 w-3.5" />
                ดู Wealth Transfer Plan
              </Link>
              <Link
                href="/timeline"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/15"
              >
                ดู Wealth Transfer Plan
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <CoverageRing percent={coveragePct} />
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          delay={0}
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="รายการในแผน"
          value={`${planRows.length} รายการ`}
          sub="เลือกเข้าสู่แผนแล้ว"
        />
        <KpiCard
          delay={60}
          tone="emerald"
          icon={<HandHeart className="h-5 w-5" />}
          label="มูลค่าที่จะส่งต่อ"
          value={money(totalTransferValue)}
          sub="ตามสัดส่วนที่ระบุ"
        />
        <KpiCard
          delay={120}
          tone="amber"
          icon={<Coins className="h-5 w-5" />}
          label="ค่าใช้จ่ายรวม"
          value={money(totalPlanCost)}
          sub={
            totalInheritanceTax > 0
              ? `รวมภาษีมรดก ${money(totalInheritanceTax)}`
              : "ภาษี + ค่าธรรมเนียม"
          }
        />
        <KpiCard
          delay={180}
          tone="sky"
          icon={<Users className="h-5 w-5" />}
          label="ผู้รับปลายทาง"
          value={`${receiverCards.length} คน`}
          sub="กระจายข้ามรุ่น"
        />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-8 xl:grid-cols-[1.65fr_1fr]">
        {/* Plan items */}
        <div>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">รายการส่งต่อที่เลือกแล้ว</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                แต่ละรายการแสดงเส้นทางจากผู้โอนไปยังผู้รับ
              </p>
            </div>
            <span className="rounded-full bg-mint-brandLight px-3 py-1 text-[11px] font-semibold text-mint-brand">
              {planRows.length} รายการ
            </span>
          </div>

          <div className="space-y-4">
            {planRows.map((item, index) => {
              const tone = methodTone(item.method);
              const costPct = item.transferValue
                ? (item.cost / item.transferValue) * 100
                : 0;
              const receivers = item.receiver
                .split("+")
                .map((name) => name.trim())
                .filter(Boolean);
              const itemKey = item.id ?? `plan-${index}`;
              const lines = itemLines[itemKey] ?? [];
              const open = openKey === itemKey;

              return (
                <article
                  key={item.id ?? `${item.asset}-${item.receiver}-${item.method}-${item.year}-${index}`}
                  style={{ animationDelay: `${index * 70}ms` }}
                  className="group relative animate-[fadeUp_0.45s_ease-out_both] overflow-hidden rounded-3xl border border-slate-100/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(15,23,42,0.06),0_16px_40px_rgba(15,23,42,0.08)]"
                >
                  {/* Accent strip */}
                  <div
                    className={`absolute inset-y-0 left-0 w-1 bg-linear-to-b ${
                      item.method === "ทยอยให้" || item.method === "ให้"
                        ? "from-amber-400 to-orange-500"
                        : item.method === "ซื้อขาย"
                          ? "from-sky-400 to-blue-500"
                          : item.method === "มรดก"
                            ? "from-violet-400 to-purple-500"
                            : "from-mint-brand to-mint-400"
                    }`}
                  />

                  <div className="flex flex-col gap-5 p-5 pl-6 sm:p-6 sm:pl-7 lg:flex-row lg:items-stretch lg:justify-between">
                    {/* Left: identity + flow */}
                    <div className="min-w-0 flex-1">
                      <div className="flex gap-4">
                        <div
                          className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br shadow-sm ${tone.bg} ${tone.text}`}
                        >
                          <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-white/50 to-transparent" />
                          <MethodIcon method={item.method} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase ${tone.bg} ${tone.text}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                              {item.method}
                            </span>
                            <StatusBadge status={item.status} />
                          </div>

                          <h3 className="mt-2 text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                            {item.asset}
                          </h3>

                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            <span className="rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-slate-100">
                              {item.assetType}
                            </span>
                            <span className="rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-slate-100">
                              สัดส่วน {item.share}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-slate-100">
                              <CalendarRange className="h-3 w-3 text-slate-400" />
                              {item.year}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Transfer path */}
                      <div className="mt-5 rounded-2xl bg-linear-to-r from-slate-50 via-white to-mint-brandLight/40 p-3.5 ring-1 ring-slate-100/80">
                        <div className="mb-2.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                          เส้นทางส่งต่อ
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-slate-600 to-slate-800 text-[10px] font-bold text-white">
                              {initials(item.owner)}
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-400">ผู้โอน</div>
                              <div className="text-xs font-semibold text-slate-800">
                                {item.owner}
                              </div>
                            </div>
                          </div>

                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-100">
                            <ArrowRight className="h-3.5 w-3.5 text-mint-brand" />
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {receivers.map((name, i) => (
                              <div
                                key={`${name}-${i}`}
                                className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-mint-200/70"
                              >
                                <div
                                  className={`flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br text-[10px] font-bold text-white ${
                                    i === 0
                                      ? "from-mint-brand to-mint-400"
                                      : "from-sky-500 to-blue-500"
                                  }`}
                                >
                                  {initials(name)}
                                </div>
                                <div>
                                  <div className="text-[10px] text-mint-brandDark/70">ผู้รับ</div>
                                  <div className="text-xs font-semibold text-mint-brandDark">
                                    {name}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: metrics */}
                    <div className="flex shrink-0 flex-col justify-between gap-3 sm:min-w-52 lg:w-56">
                      <div className="rounded-2xl bg-linear-to-br from-mint-brandLight/90 to-white p-4 ring-1 ring-mint-200/50">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium text-mint-brandDark/70">
                            มูลค่าส่งต่อ
                          </span>
                          <HandHeart className="h-3.5 w-3.5 text-mint-brand" />
                        </div>
                        <div className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums text-slate-900">
                          {money(item.transferValue)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setOpenKey(open ? null : itemKey)
                        }
                        className="rounded-2xl bg-linear-to-br from-amber-50/90 to-white p-4 text-left ring-1 ring-amber-200/50 transition hover:ring-amber-300"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium text-amber-700/70">
                            ค่าใช้จ่าย
                          </span>
                          <Coins className="h-3.5 w-3.5 text-amber-600" />
                        </div>
                        <div className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums text-slate-900">
                          {money(item.cost)}
                        </div>
                        <div className="mt-2">
                          <div className="mb-1 flex justify-between text-[10px]">
                            <span className="text-slate-400">คิดเป็น</span>
                            <span className="font-semibold text-amber-700">
                              {costPct.toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-1 overflow-hidden rounded-full bg-amber-100">
                            <div
                              className="h-full rounded-full bg-linear-to-r from-amber-400 to-orange-400"
                              style={{ width: `${Math.min(100, Math.max(4, costPct * 4))}%` }}
                            />
                          </div>
                        </div>
                        {lines.length > 0 ? (
                          <p className="mt-2 text-[10px] font-medium text-amber-700">
                            {open ? "ซ่อนรายละเอียด" : "กดเพื่อดูฐานและสูตร"}
                          </p>
                        ) : null}
                      </button>
                    </div>
                  </div>
                  {open && lines.length > 0 ? (
                    <div className="border-t border-slate-50 px-5 py-3 sm:px-6">
                      <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                        ฐาน · สูตร · อัตรา
                      </div>
                      <ul className="mt-2 space-y-1.5">
                        {lines.map((line) => (
                          <li
                            key={`${line.label}-${line.amount}`}
                            className="flex justify-between gap-3 text-[11px]"
                          >
                            <span className="text-slate-600">
                              {line.label}
                              {line.note ? (
                                <span className="mt-0.5 block text-[10px] text-slate-400">
                                  {line.note}
                                  {line.legalRef ? ` · ${line.legalRef}` : ""}
                                </span>
                              ) : null}
                            </span>
                            <span className="shrink-0 font-semibold tabular-nums text-slate-800">
                              {line.kind === "credit" ? "เครดิต " : ""}
                              {money(line.amount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Timeline */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm shadow-slate-100/80">
            <div className="border-b border-slate-50 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint-brandLight text-mint-brand">
                  <CalendarRange className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">หมุดหมายถัดไป</h2>
                  <p className="text-[11px] text-slate-400">แผนค่าใช้จ่ายรายปี</p>
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className="rounded-2xl bg-linear-to-br from-mint-brandLight/80 to-white p-4 ring-1 ring-mint-200/40">
                <div className="text-[11px] font-medium text-mint-brandDark">ปีที่ควรดำเนินการก่อน</div>
                <div className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                  {nextMilestone?.year ?? "-"}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  เตรียมงบประมาณ{" "}
                  <span className="font-semibold text-slate-800">
                    {money(nextMilestone?.amount ?? 0)}
                  </span>{" "}
                  สำหรับรายการหลัก
                </p>
              </div>

              <div className="relative mt-6 space-y-5 pl-4">
                <div className="absolute bottom-2 left-[7px] top-2 w-px bg-slate-200" />
                {yearlyCosts.map((item, index) => (
                  <div key={item.year} className="relative">
                    <div
                      className={`absolute -left-4 top-1.5 h-3.5 w-3.5 rounded-full ring-4 ring-white ${
                        index === 0 ? "bg-mint-brand" : "bg-slate-300"
                      }`}
                    />
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">{item.year}</span>
                      <span className="font-medium tabular-nums text-slate-500">
                        {money(item.amount)}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          index === 0
                            ? "bg-linear-to-r from-mint-brand to-mint-400"
                            : "bg-slate-300"
                        }`}
                        style={{
                          width: `${Math.max(8, (item.amount / maxYearlyCost) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      {item.percent}% ของค่าใช้จ่ายรวม
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Receivers — compact for many people */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm shadow-slate-100/80">
            <div className="flex items-center justify-between border-b border-slate-50 px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">ผู้รับตามแผน</h2>
                <p className="text-[11px] text-slate-400">มูลค่าและสัดส่วนที่ได้รับ</p>
              </div>
              <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-100">
                {receiverCards.length} คน
              </span>
            </div>
            <div
              className={`divide-y divide-slate-50 ${
                receiverCards.length > 5 ? "max-h-72 overflow-y-auto" : ""
              }`}
            >
              {receiverCards.map((item, index) => {
                const sharePct = totalTransferValue
                  ? (item.plannedValue / totalTransferValue) * 100
                  : 0;
                const avatarGradients = [
                  "from-mint-brand to-mint-400",
                  "from-sky-500 to-blue-500",
                  "from-amber-500 to-orange-500",
                  "from-violet-500 to-purple-500",
                  "from-rose-500 to-pink-500",
                  "from-teal-500 to-cyan-500",
                ];

                return (
                  <div
                    key={item.name}
                    className="px-4 py-2.5 transition hover:bg-slate-50/70"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br ${avatarGradients[index % avatarGradients.length]} text-[10px] font-bold text-white`}
                      >
                        {initials(item.name)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 truncate">
                            <span className="text-xs font-semibold text-slate-800">
                              {item.name}
                            </span>
                            <span className="ml-1.5 text-[10px] text-slate-400">
                              {item.relation}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="rounded-md bg-mint-brandLight px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-mint-brandDark">
                              {sharePct.toFixed(0)}%
                            </span>
                            <span className="text-xs font-bold tabular-nums text-slate-900">
                              {money(item.plannedValue)}
                            </span>
                          </div>
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-linear-to-r from-mint-brand to-mint-400"
                            style={{ width: `${sharePct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom section */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Pending */}
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm shadow-slate-100/80">
          <div className="border-b border-slate-50 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">งานที่ยังค้างในแผน</h2>
                <p className="text-[11px] text-slate-400">ทรัพย์สินที่ควรจัดลำดับถัดไป</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {pendingAssets.map((item) => (
              <div
                key={item.id}
                className="group flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-50/60"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-800">{item.name}</div>
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    {item.owner} · {item.type}
                  </div>
                  <div className="mt-2 text-xs font-medium tabular-nums text-slate-600">
                    {money(assetEffectiveValue(item.value, item.share))}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusBadge status={item.status} />
                  <Link
                    href="/assets?wizard=1"
                    className="inline-flex items-center gap-1 rounded-lg bg-mint-brandLight px-2.5 py-1.5 text-[11px] font-semibold text-mint-brand opacity-0 transition group-hover:opacity-100"
                  >
                    วางแผนต่อ
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Insights */}
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm shadow-slate-100/80">
          <div className="border-b border-slate-50 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                <Lightbulb className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">ข้อสังเกตของแผน</h2>
                <p className="text-[11px] text-slate-400">มุมมองสรุประดับผู้บริหาร</p>
              </div>
            </div>
          </div>
          <div className="space-y-3 p-5">
            <InsightCard
              tone="mint"
              icon={<TrendingUp className="h-4 w-4" />}
              title="จุดแข็ง"
              text="แผนครอบคลุมทรัพย์สินมูลค่าสูงที่สุดของครอบครัวแล้ว และกระจายผู้รับไปยังรุ่นที่ 2"
            />
            <InsightCard
              tone="amber"
              icon={<CalendarRange className="h-4 w-4" />}
              title="ควรติดตาม"
              text="ภาระค่าใช้จ่ายส่วนใหญ่กระจุกในปีแรก จึงควรวางแผนสภาพคล่องและเอกสารประกอบล่วงหน้า"
            />
            <InsightCard
              tone="sky"
              icon={<Sparkles className="h-4 w-4" />}
              title="โอกาสปรับเพิ่ม"
              text="ยังมีสินทรัพย์สภาพคล่องและพอร์ตลงทุนที่ยังไม่อยู่ในแผน ซึ่งสามารถเพิ่มความยืดหยุ่นได้"
            />
          </div>
        </div>
      </div>

      {/* CTA strip */}
      <div className="mt-8 rounded-2xl border border-slate-100 bg-linear-to-r from-mint-brandLight/60 via-white to-sky-50/50 px-5 py-5 sm:px-6">
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-mint-brand shadow-sm ring-1 ring-slate-100">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">
              พร้อมนำเสนอแผนให้ครอบครัวแล้ว
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              ครอบคลุม {coveragePct.toFixed(0)}% ของมูลค่าทรัพย์สินรวม · ค่าใช้จ่ายรวม{" "}
              {money(totalPlanCost)}
            </p>
          </div>
        </div>
      </div>

      {inheritanceByReceiver.length > 0 ? (
        <InheritanceTaxSummary
          rows={inheritanceByReceiver}
          className="mt-8"
        />
      ) : null}

      {breakdown ? (
        <PlanTaxBreakdown
          breakdown={breakdown}
          giftLedgers={giftLedgers}
          status={calcStatus}
          missingDataCount={missingDataCount}
          reviewRequiredCount={reviewRequiredCount}
          warnings={warnings}
        />
      ) : null}
    </div>
  );
}

function InsightCard({
  tone,
  icon,
  title,
  text,
}: {
  tone: "mint" | "amber" | "sky";
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  const styles = {
    mint: {
      wrap: "bg-linear-to-r from-mint-brandLight/70 to-white ring-mint-200/50",
      icon: "bg-mint-brandLight text-mint-brand",
      title: "text-mint-brandDark",
    },
    amber: {
      wrap: "bg-linear-to-r from-amber-50/80 to-white ring-amber-200/50",
      icon: "bg-amber-100 text-amber-700",
      title: "text-amber-700",
    },
    sky: {
      wrap: "bg-linear-to-r from-sky-50/80 to-white ring-sky-200/50",
      icon: "bg-sky-100 text-sky-700",
      title: "text-sky-700",
    },
  }[tone];

  return (
    <div className={`flex gap-3 rounded-2xl p-4 ring-1 ${styles.wrap}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>
        {icon}
      </div>
      <div>
        <div className={`text-xs font-bold ${styles.title}`}>{title}</div>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{text}</p>
      </div>
    </div>
  );
}
