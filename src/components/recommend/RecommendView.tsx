"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Coins,
  Gift,
  Handshake,
  Info,
  Landmark,
  Lightbulb,
  Receipt,
  Scale,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trophy,
  Wallet,
} from "lucide-react";
import type { Scenario, ScenarioCriteria } from "@/data/wealth-transfer";
import { money } from "@/lib/format";
import { allScenarios } from "@/lib/scenario-store";
import { MintRange } from "@/components/ui/MintRange";
import { StatusBadge } from "@/components/ui/StatusBadge";

type RecommendViewProps = {
  initialScenarios: Scenario[];
};

type WeightKey = keyof ScenarioCriteria | "complexity";

type WeightDef = {
  key: WeightKey;
  label: string;
  hint: string;
  tone: string;
};

const WEIGHT_DEFS: WeightDef[] = [
  {
    key: "taxEfficiency",
    label: "ประสิทธิภาพภาษี",
    hint: "ลดภาระภาษีและค่าธรรมเนียม",
    tone: "bg-amber-400",
  },
  {
    key: "control",
    label: "รักษาอำนาจควบคุม",
    hint: "คงการตัดสินใจของรุ่นที่ 1",
    tone: "bg-sky-400",
  },
  {
    key: "readiness",
    label: "ความพร้อมการส่งต่อ",
    hint: "ดำเนินการได้ในระยะใกล้",
    tone: "bg-mint-brand",
  },
  {
    key: "liquidity",
    label: "สภาพคล่อง",
    hint: "ผลกระทบต่อเงินสดในมือ",
    tone: "bg-violet-400",
  },
  {
    key: "complexity",
    label: "ความซับซ้อน",
    hint: "โครงสร้างและขั้นตอนที่จัดการได้",
    tone: "bg-slate-400",
  },
];

const DEFAULT_WEIGHTS: Record<WeightKey, number> = {
  taxEfficiency: 35,
  control: 25,
  readiness: 20,
  liquidity: 10,
  complexity: 10,
};

const METHOD_COMPLEXITY: Record<string, number> = {
  ให้: 4,
  มรดก: 5,
  ทยอยให้: 3,
  ซื้อขาย: 2,
  โอนเข้าบริษัท: 2,
  วิธีผสม: 2,
};

function methodComplexity(method: string) {
  return METHOD_COMPLEXITY[method] ?? 3;
}

function criterionValue(s: Scenario, key: WeightKey) {
  if (key === "complexity") return methodComplexity(s.method);
  return s.criteria[key];
}

function weightedScore(s: Scenario, weights: Record<WeightKey, number>) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const raw = WEIGHT_DEFS.reduce(
    (sum, w) => sum + criterionValue(s, w.key) * (weights[w.key] / total),
    0,
  );
  return Math.round(raw * 10) / 10;
}

function rankLabel(score: number) {
  if (score >= 4.2) return "เหมาะสมสูง";
  if (score >= 3.5) return "เหมาะสม";
  return "พิจารณา";
}

function reasonFor(s: Scenario, weights: Record<WeightKey, number>) {
  const ranked = WEIGHT_DEFS.map((w) => ({
    ...w,
    value: criterionValue(s, w.key),
    weight: weights[w.key],
  })).sort((a, b) => b.value * b.weight - a.value * a.weight);

  const top = ranked[0];
  const weak = [...ranked].sort((a, b) => a.value - b.value)[0];

  if (s.method === "ให้" || s.method === "ทยอยให้") {
    return `ลดภาระรายปีและทำให้ผู้รับได้รับกรรมสิทธิ์ตามช่วงเวลา — จุดแข็งด้าน${top.label}`;
  }
  if (s.method === "มรดก") {
    return `รักษาการควบคุมและสภาพคล่อง แต่การส่งต่อเกิดช้ากว่า — จุดอ่อนด้าน${weak.label}`;
  }
  if (s.method === "ซื้อขาย") {
    return `โครงสร้างชัด แต่ใช้สภาพคล่องและต้นทุนธุรกรรมสูงกว่า — ควรทบทวน${weak.label}`;
  }
  return `สมดุลหลายมิติ โดยเด่นที่${top.label} และควรระวัง${weak.label}`;
}

function MethodIcon({
  method,
  className = "h-4 w-4",
}: {
  method: string;
  className?: string;
}) {
  if (method === "ให้" || method === "ทยอยให้") return <Gift className={className} />;
  if (method === "ซื้อขาย") return <Handshake className={className} />;
  if (method === "มรดก") return <Landmark className={className} />;
  return <Scale className={className} />;
}

function Stars({
  score,
  size = "sm",
  tone = "light",
}: {
  score: number;
  size?: "sm" | "md";
  tone?: "light" | "dark";
}) {
  const filled = Math.round(score);
  const icon = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  const empty =
    tone === "light"
      ? "fill-white/35 text-white/35"
      : "fill-slate-100 text-slate-200";
  return (
    <div className="flex items-center gap-0.5" aria-label={`${score} จาก 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`${icon} ${
            i < filled ? "fill-amber-400 text-amber-400" : empty
          }`}
        />
      ))}
    </div>
  );
}

function ScoreHalo({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, (score / 5) * 100));
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="relative h-36 w-36 shrink-0">
      <div className="absolute inset-3 rounded-full bg-white/15 blur-[1px]" />
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-white/25"
        />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="text-white transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <span className="text-4xl font-bold tracking-tight tabular-nums leading-none">
          {score}
        </span>
        <span className="mt-1 text-[11px] font-medium text-white/75">จาก 5</span>
      </div>
    </div>
  );
}

export function RecommendView({ initialScenarios }: RecommendViewProps) {
  const [scenarios, setScenarios] = useState(initialScenarios);
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setScenarios(allScenarios());
  }, []);

  const weightTotal = useMemo(
    () => Object.values(weights).reduce((a, b) => a + b, 0),
    [weights],
  );

  const ranked = useMemo(() => {
    return [...scenarios]
      .map((s) => ({
        scenario: s,
        score: weightedScore(s, weights),
        reason: reasonFor(s, weights),
        label: "",
      }))
      .map((row) => ({ ...row, label: rankLabel(row.score) }))
      .sort((a, b) => b.score - a.score || a.scenario.total - b.scenario.total);
  }, [scenarios, weights]);

  const top = ranked[0] ?? null;
  const active = selectedId
    ? ranked.find((r) => r.scenario.id === selectedId) ?? top
    : top;

  function setWeight(key: WeightKey, value: number) {
    setWeights((prev) => ({ ...prev, [key]: value }));
  }

  function resetWeights() {
    setWeights(DEFAULT_WEIGHTS);
  }

  function redistributeEven() {
    const even = Math.floor(100 / WEIGHT_DEFS.length);
    const rem = 100 - even * WEIGHT_DEFS.length;
    const next = { ...DEFAULT_WEIGHTS };
    WEIGHT_DEFS.forEach((w, i) => {
      next[w.key] = even + (i === 0 ? rem : 0);
    });
    setWeights(next);
  }

  return (
    <div className="animate-[fadeUp_0.35s_ease-out]">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold tracking-wide text-mint-brand">
            การวางแผน
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            คำแนะนำและคะแนน
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            ระบบจัดอันดับทางเลือกจากหลายมิติ
            โดยที่ปรึกษาสามารถปรับน้ำหนักให้ตรงเป้าหมายครอบครัว
          </p>
        </div>
        <Link
          href="/assets?wizard=1"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          กลับไปสร้างสถานการณ์
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {ranked.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 lg:mb-8 lg:grid-cols-2">
            {/* Weights */}
            <section className="flex flex-col rounded-3xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100/80 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint-brandLight text-mint-brand">
                      <SlidersHorizontal className="h-4 w-4" />
                    </div>
                    <h2 className="text-sm font-bold text-slate-900">
                      น้ำหนักการตัดสินใจ
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400">
                    รวม {weightTotal}% · คะแนนจะคำนวณใหม่ทันทีเมื่อปรับ
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing((v) => !v)}
                  className={`rounded-xl px-3 py-2 text-[11px] font-semibold transition ${
                    editing
                      ? "bg-mint-brand text-white shadow-sm shadow-mint-brand/25"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {editing ? "เสร็จสิ้น" : "ปรับน้ำหนัก"}
                </button>
              </div>

              <div className="flex-1 space-y-4">
                {WEIGHT_DEFS.map((w) => {
                  const pct =
                    weightTotal > 0
                      ? Math.round((weights[w.key] / weightTotal) * 100)
                      : 0;
                  return (
                    <div key={w.key}>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold text-slate-700">
                            {w.label}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {w.hint}
                          </div>
                        </div>
                        <b className="tabular-nums text-sm text-slate-900">
                          {pct}%
                        </b>
                      </div>
                      {editing ? (
                        <MintRange
                          min={0}
                          max={60}
                          value={weights[w.key]}
                          onChange={(v) => setWeight(w.key, v)}
                          aria-label={w.label}
                        />
                      ) : (
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-[width] duration-300 ${w.tone}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {editing ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={resetWeights}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    คืนค่าเริ่มต้น
                  </button>
                  <button
                    type="button"
                    onClick={redistributeEven}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    เฉลี่ยเท่ากัน
                  </button>
                </div>
              ) : null}
            </section>

            {/* Top pick */}
            {active ? (
              <section className="relative flex flex-col overflow-hidden rounded-3xl border border-mint-200/80 bg-white shadow-lg shadow-mint-brand/10">
                {/* Hero band */}
                <div className="relative overflow-hidden bg-linear-to-br from-mint-brand via-mint-brand to-mint-brandDark px-5 pt-5 pb-8 text-white sm:px-6 sm:pt-6 sm:pb-10">
                  <div className="pointer-events-none absolute -top-20 -right-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
                  <div className="pointer-events-none absolute -bottom-24 left-8 h-40 w-40 rounded-full bg-slate-950/20 blur-2xl" />
                  <div
                    className="pointer-events-none absolute inset-0 opacity-[0.07]"
                    style={{
                      backgroundImage:
                        "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                      backgroundSize: "18px 18px",
                    }}
                  />

                  <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/18 px-3 py-1 text-[11px] font-semibold backdrop-blur-sm ring-1 ring-white/25">
                          <Trophy className="h-3.5 w-3.5 text-amber-300" />
                          {active === top ? "คำแนะนำอันดับ 1" : "ทางเลือกที่เลือก"}
                        </span>
                        <span className="inline-flex rounded-full bg-slate-950/25 px-2.5 py-1 text-[10px] font-semibold text-white ring-1 ring-white/20">
                          {active.label}
                        </span>
                      </div>

                      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold text-white/95 ring-1 ring-white/15">
                        <MethodIcon method={active.scenario.method} className="h-3.5 w-3.5" />
                        {active.scenario.method}
                      </div>

                      <h2 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">
                        {active.scenario.asset}
                      </h2>
                      <p className="mt-1.5 text-sm text-white/75">
                        ส่งต่อให้{" "}
                        <span className="font-semibold text-white">
                          {active.scenario.receiver}
                        </span>{" "}
                        · ปี {active.scenario.year}
                      </p>

                      <div className="mt-5">
                        <Stars score={active.score} size="md" tone="light" />
                        <div className="mt-1.5 text-[11px] text-white/65">
                          คะแนนถ่วงน้ำหนักตามเป้าหมายครอบครัว
                        </div>
                      </div>
                    </div>

                    <div className="mx-auto sm:mx-0">
                      <ScoreHalo score={active.score} />
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="relative -mt-5 flex flex-1 flex-col px-5 pb-5 sm:px-6 sm:pb-6">
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-md shadow-slate-200/50 sm:p-5">
                    <p className="text-sm leading-relaxed text-slate-600">
                      <span className="mr-1.5 inline-flex h-5 w-5 -translate-y-px items-center justify-center rounded-md bg-mint-brandLight text-mint-brand">
                        <Lightbulb className="h-3 w-3" />
                      </span>
                      {active.reason}
                    </p>

                    <div className="mt-5 grid grid-cols-3 gap-2.5">
                      <MiniStat
                        icon={<Coins className="h-3.5 w-3.5" />}
                        label="ภาษี"
                        value={money(active.scenario.tax)}
                        tone="amber"
                      />
                      <MiniStat
                        icon={<Receipt className="h-3.5 w-3.5" />}
                        label="ค่าธรรมเนียม"
                        value={money(active.scenario.fees)}
                        tone="sky"
                      />
                      <MiniStat
                        icon={<Wallet className="h-3.5 w-3.5" />}
                        label="รวม"
                        value={money(active.scenario.total)}
                        tone="mint"
                        emphasize
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-slate-50 px-3.5 py-3 text-[11px] leading-relaxed text-slate-500">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span>
                      คำแนะนำเป็นผลจากข้อมูลและน้ำหนักที่กำหนด
                      ไม่ใช่ข้อวินิจฉัยทางกฎหมายหรือภาษี
                    </span>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2.5">
                    <Link
                      href="/timeline"
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-mint-brand px-4 py-3 text-xs font-semibold text-white shadow-md shadow-mint-brand/25 transition hover:bg-mint-brandDark hover:shadow-lg hover:shadow-mint-brand/30 sm:flex-none"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      ดู Wealth Transfer Plan
                    </Link>
                    <Link
                      href="/assets?wizard=1"
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600 transition hover:border-mint-200 hover:bg-mint-brandLight/40 hover:text-mint-brandDark sm:flex-none"
                    >
                      สร้างทางเลือกเพิ่ม
                    </Link>
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          {/* Ranked table */}
          <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm shadow-slate-100/80">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Lightbulb className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    อันดับทางเลือกทั้งหมด
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    {ranked.length} สถานการณ์ · เรียงตามคะแนนถ่วงน้ำหนัก
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                    <th className="px-5 py-3 font-semibold">#</th>
                    <th className="px-5 py-3 font-semibold">ทางเลือก</th>
                    <th className="px-5 py-3 font-semibold">คะแนน</th>
                    <th className="px-5 py-3 font-semibold">สถานะ</th>
                    <th className="px-5 py-3 font-semibold">เหตุผลย่อ</th>
                    <th className="px-5 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((row, index) => {
                    const isActive = active?.scenario.id === row.scenario.id;
                    return (
                      <tr
                        key={row.scenario.id}
                        className={`border-b border-slate-50 transition ${
                          isActive ? "bg-mint-brandLight/40" : "hover:bg-slate-50/80"
                        }`}
                      >
                        <td className="px-5 py-4 align-middle">
                          <span
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                              index === 0
                                ? "bg-mint-brand text-white"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-5 py-4 align-middle">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
                              <MethodIcon method={row.scenario.method} />
                            </div>
                            <div>
                              <div className="text-sm font-bold text-slate-900">
                                {row.scenario.method} · {row.scenario.asset}
                              </div>
                              <div className="mt-0.5 text-[11px] text-slate-400">
                                {row.scenario.receiver} · ค่าใช้จ่าย{" "}
                                {money(row.scenario.total)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-middle">
                          <div className="text-sm font-bold tabular-nums text-slate-900">
                            {row.score}
                            <span className="text-[11px] font-medium text-slate-400">
                              /5
                            </span>
                          </div>
                          <div className="mt-1">
                            <Stars score={row.score} tone="dark" />
                          </div>
                        </td>
                        <td className="px-5 py-4 align-middle">
                          <StatusBadge status={row.label} />
                        </td>
                        <td className="max-w-xs px-5 py-4 align-middle text-xs leading-relaxed text-slate-500">
                          {row.reason}
                        </td>
                        <td className="px-5 py-4 align-middle text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedId(row.scenario.id)}
                            className={`rounded-xl px-3 py-2 text-[11px] font-semibold transition ${
                              isActive
                                ? "bg-mint-brand text-white"
                                : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {isActive ? "กำลังดู" : "ดูรายละเอียด"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Criteria breakdown for active */}
          {active ? (
            <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100/80 sm:mt-8 sm:p-6">
              <h2 className="mb-1 text-sm font-bold text-slate-900">
                รายละเอียดคะแนน · {active.scenario.method}
              </h2>
              <p className="mb-5 text-xs text-slate-400">
                คะแนนดิบแต่ละมิติของทางเลือกที่เลือกอยู่
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {WEIGHT_DEFS.map((w) => {
                  const value = criterionValue(active.scenario, w.key);
                  const pct = (value / 5) * 100;
                  return (
                    <div
                      key={w.key}
                      className="rounded-xl border border-slate-100 bg-slate-50/50 p-4"
                    >
                      <div className="text-[11px] font-medium text-slate-400">
                        {w.label}
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-xl font-bold tabular-nums text-slate-900">
                          {value}
                        </span>
                        <span className="text-[11px] text-slate-400">/5</span>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
                        <div
                          className={`h-full rounded-full ${w.tone}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  tone = "mint",
  emphasize = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: "amber" | "sky" | "mint";
  emphasize?: boolean;
}) {
  const tones = {
    amber: "bg-amber-50 text-amber-600",
    sky: "bg-sky-50 text-sky-600",
    mint: "bg-mint-brandLight text-mint-brand",
  };

  return (
    <div
      className={`rounded-xl border px-3 py-3 ${
        emphasize
          ? "border-mint-200 bg-mint-brandLight/50"
          : "border-slate-100 bg-slate-50/70"
      }`}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <span
          className={`inline-flex h-6 w-6 items-center justify-center rounded-lg ${tones[tone]}`}
        >
          {icon}
        </span>
        <span className="text-[10px] font-medium text-slate-400">{label}</span>
      </div>
      <div
        className={`text-sm font-bold tabular-nums tracking-tight ${
          emphasize ? "text-mint-brandDark" : "text-slate-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-brandLight text-mint-brand">
        <Star className="h-5 w-5" />
      </div>
      <h2 className="text-lg font-bold text-slate-900">ยังไม่มีสถานการณ์ให้จัดอันดับ</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        สร้างสถานการณ์ส่งต่ออย่างน้อยหนึ่งรายการ แล้วระบบจะคำนวณคะแนนและแนะนำทางเลือกที่เหมาะสม
      </p>
      <Link
        href="/assets?wizard=1"
        className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-mint-brand px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-mint-brandDark"
      >
        สร้างสถานการณ์
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
