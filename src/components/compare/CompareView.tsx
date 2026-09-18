"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Gift,
  Handshake,
  Landmark,
  Plus,
  Scale,
  Sparkles,
  Trophy,
  Wallet,
} from "lucide-react";
import type { Scenario } from "@/data/wealth-transfer";
import { money } from "@/lib/format";
import { allScenarios } from "@/lib/scenario-store";

type CompareViewProps = {
  initialScenarios: Scenario[];
};

type CriterionKey = keyof Scenario["criteria"];

const CRITERIA: { key: CriterionKey; label: string; hint: string }[] = [
  { key: "taxEfficiency", label: "ภาษี", hint: "ประสิทธิภาพภาษี" },
  { key: "control", label: "ควบคุม", hint: "รักษาการควบคุม" },
  { key: "liquidity", label: "สภาพคล่อง", hint: "ผลกระทบต่อสภาพคล่อง" },
  { key: "readiness", label: "พร้อมส่งต่อ", hint: "ความพร้อมดำเนินการ" },
];

const METHOD_TONE: Record<
  string,
  { bg: string; text: string; ring: string; soft: string }
> = {
  ให้: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    ring: "ring-amber-200",
    soft: "from-amber-50/80 to-white",
  },
  ซื้อขาย: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    ring: "ring-sky-200",
    soft: "from-sky-50/80 to-white",
  },
  มรดก: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    ring: "ring-violet-200",
    soft: "from-violet-50/80 to-white",
  },
  โอนเข้าบริษัท: {
    bg: "bg-mint-brandLight",
    text: "text-mint-brandDark",
    ring: "ring-mint-200",
    soft: "from-mint-50/80 to-white",
  },
  ทยอยให้: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    ring: "ring-orange-200",
    soft: "from-orange-50/80 to-white",
  },
  วิธีผสม: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    ring: "ring-slate-200",
    soft: "from-slate-50 to-white",
  },
};

function methodTone(method: string) {
  return (
    METHOD_TONE[method] ?? {
      bg: "bg-mint-brandLight",
      text: "text-mint-brandDark",
      ring: "ring-mint-200",
      soft: "from-mint-brandLight/80 to-white",
    }
  );
}

function MethodIcon({ method }: { method: string }) {
  const cls = "h-4 w-4";
  if (method === "ให้" || method === "ทยอยให้") return <Gift className={cls} />;
  if (method === "ซื้อขาย") return <Handshake className={cls} />;
  if (method === "มรดก") return <Landmark className={cls} />;
  return <Scale className={cls} />;
}

function ScoreDots({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${value} จาก ${max}`}>
      {Array.from({ length: max }, (_, i) => {
        const filled = i < Math.round(value);
        const partial = !filled && i < value;
        return (
          <span
            key={i}
            className={`h-1.5 w-3 rounded-full transition-colors ${
              filled
                ? "bg-mint-brand"
                : partial
                  ? "bg-mint-300"
                  : "bg-slate-200"
            }`}
          />
        );
      })}
    </div>
  );
}

function RingScore({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, (score / 5) * 100));
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90">
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          className="text-slate-100"
        />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="text-mint-brand transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold tabular-nums text-slate-900">
          {score}
        </span>
        <span className="text-[10px] text-slate-400">/5</span>
      </div>
    </div>
  );
}

export function CompareView({ initialScenarios }: CompareViewProps) {
  const [scenarios, setScenarios] = useState(initialScenarios);
  const [selected, setSelected] = useState<string[]>(() =>
    initialScenarios.slice(0, 3).map((s) => s.id),
  );
  const [assetFilter, setAssetFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"score" | "cost">("score");

  useEffect(() => {
    const all = allScenarios();
    setScenarios(all);
    setSelected((prev) => {
      const ids = new Set(all.map((s) => s.id));
      const kept = prev.filter((id) => ids.has(id));
      if (kept.length > 0) return kept;
      return all.slice(0, 3).map((s) => s.id);
    });
  }, []);

  const assets = useMemo(
    () => [...new Set(scenarios.map((s) => s.asset))],
    [scenarios],
  );

  const filtered = useMemo(() => {
    const list =
      assetFilter === "all"
        ? scenarios
        : scenarios.filter((s) => s.asset === assetFilter);
    return [...list].sort((a, b) =>
      sortBy === "score" ? b.score - a.score : a.total - b.total,
    );
  }, [scenarios, assetFilter, sortBy]);

  const visible = useMemo(
    () =>
      filtered.filter((s) => selected.includes(s.id)).sort((a, b) => {
        const ai = selected.indexOf(a.id);
        const bi = selected.indexOf(b.id);
        return ai - bi;
      }),
    [filtered, selected],
  );

  const lowestCost = visible.length
    ? visible.reduce((a, b) => (a.total <= b.total ? a : b))
    : null;
  const highestScore = visible.length
    ? visible.reduce((a, b) => (a.score >= b.score ? a : b))
    : null;

  const bestByCriterion = useMemo(() => {
    const map = {} as Record<CriterionKey | "total" | "score", string | null>;
    if (visible.length === 0) {
      map.total = null;
      map.score = null;
      for (const c of CRITERIA) map[c.key] = null;
      return map;
    }
    map.total = visible.reduce((a, b) => (a.total <= b.total ? a : b)).id;
    map.score = visible.reduce((a, b) => (a.score >= b.score ? a : b)).id;
    for (const c of CRITERIA) {
      map[c.key] = visible.reduce((a, b) =>
        a.criteria[c.key] >= b.criteria[c.key] ? a : b,
      ).id;
    }
    return map;
  }, [visible]);

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 4) return [...prev.slice(1), id];
      return [...prev, id];
    });
  }

  function selectAllFiltered() {
    setSelected(filtered.slice(0, 4).map((s) => s.id));
  }

  const savingsVsWorst =
    visible.length >= 2 && lowestCost
      ? Math.max(...visible.map((s) => s.total)) - lowestCost.total
      : 0;

  return (
    <div className="animate-[fadeUp_0.35s_ease-out]">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold tracking-wide text-mint-brand">
            การวางแผน
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            เปรียบเทียบสถานการณ์
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            เลือกสูงสุด 4 วิธี แล้วดูภาษี ค่าใช้จ่าย และคะแนนข้างกันในหน้าเดียว
          </p>
        </div>
        <Link
          href="/assets?wizard=1"
          className="inline-flex items-center gap-1.5 rounded-xl bg-mint-brand px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-mint-brandDark"
        >
          <Plus className="h-3.5 w-3.5" />
          สร้างสถานการณ์ใหม่
        </Link>
      </div>

      {/* Insight strip */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:mb-8 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint-brandLight text-mint-brand">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">กำลังเปรียบเทียบ</div>
            <div className="text-lg font-bold text-slate-900">
              {visible.length}{" "}
              <span className="text-sm font-medium text-slate-400">
                จาก {filtered.length} รายการ
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint-brandLight text-mint-brand">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">ประหยัดสุด</div>
            <div className="text-lg font-bold tabular-nums text-slate-900">
              {lowestCost ? money(lowestCost.total) : "—"}
            </div>
            <div className="text-[11px] text-mint-brand">
              {lowestCost
                ? savingsVsWorst > 0
                  ? `${lowestCost.method} · ถูกกว่าสูงสุด ${money(savingsVsWorst)}`
                  : lowestCost.method
                : "—"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">คะแนนสูงสุด</div>
            <div className="text-lg font-bold tabular-nums text-slate-900">
              {highestScore ? `${highestScore.score}/5` : "—"}
            </div>
            <div className="text-[11px] text-amber-700">
              {highestScore ? highestScore.method : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400">ทรัพย์สิน</span>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              active={assetFilter === "all"}
              onClick={() => setAssetFilter("all")}
              label="ทั้งหมด"
            />
            {assets.map((a) => (
              <FilterChip
                key={a}
                active={assetFilter === a}
                onClick={() => setAssetFilter(a)}
                label={a}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400">เรียง</span>
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5">
            <SortBtn
              active={sortBy === "score"}
              onClick={() => setSortBy("score")}
              label="คะแนน"
            />
            <SortBtn
              active={sortBy === "cost"}
              onClick={() => setSortBy("cost")}
              label="ค่าใช้จ่าย"
            />
          </div>
          <button
            type="button"
            onClick={selectAllFiltered}
            className="rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-mint-brand transition hover:bg-mint-brandLight"
          >
            เลือก 4 อันดับแรก
          </button>
        </div>
      </div>

      {/* Scenario picker cards */}
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((s, index) => {
          const checked = selected.includes(s.id);
          const tone = methodTone(s.method);
          const isTop = highestScore?.id === s.id && checked;
          const isCheap = lowestCost?.id === s.id && checked;

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              style={{ animationDelay: `${index * 40}ms` }}
              className={`group relative animate-[fadeUp_0.4s_ease-out_both] rounded-2xl border p-4 text-left transition-all duration-200 ${
                checked
                  ? `border-mint-brand/40 bg-linear-to-b ${tone.soft} ring-2 ring-mint-brand/30 shadow-sm`
                  : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm"
              }`}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone.bg} ${tone.text}`}
                  >
                    <MethodIcon method={s.method} />
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-900">
                        {s.method}
                      </span>
                      {isTop ? (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                          <Sparkles className="h-2.5 w-2.5" />
                          แนะนำ
                        </span>
                      ) : null}
                      {isCheap && !isTop ? (
                        <span className="rounded-md bg-mint-brandLight px-1.5 py-0.5 text-[9px] font-bold text-mint-brandDark">
                          ประหยัด
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {s.id} · ปี {s.year}
                    </div>
                  </div>
                </div>
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full border transition ${
                    checked
                      ? "border-mint-brand bg-mint-brand text-white"
                      : "border-slate-200 bg-white text-transparent group-hover:border-slate-300"
                  }`}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              </div>

              <p className="mb-3 truncate text-xs text-slate-500">
                {s.asset}
                <span className="text-slate-300"> → </span>
                {s.receiver}
              </p>

              <div className="mb-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/80 px-2.5 py-2 ring-1 ring-slate-100">
                  <div className="text-[10px] text-slate-400">ค่าใช้จ่าย</div>
                  <div className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
                    {money(s.total)}
                  </div>
                </div>
                <div className="rounded-xl bg-white/80 px-2.5 py-2 ring-1 ring-slate-100">
                  <div className="text-[10px] text-slate-400">ภาษี</div>
                  <div className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
                    {money(s.tax)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="mb-1 text-[10px] text-slate-400">คะแนนรวม</div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold tabular-nums text-slate-800">
                      {s.score}
                    </span>
                    <ScoreDots value={s.score} />
                  </div>
                </div>
                <Link
                  href="/assets?wizard=1"
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-slate-50 hover:text-mint-brand"
                >
                  ดูรายละเอียด
                </Link>
              </div>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="mb-8 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <p className="text-sm text-slate-500">ไม่พบสถานการณ์ตามตัวกรอง</p>
          <Link
            href="/assets?wizard=1"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-mint-brand"
          >
            สร้างสถานการณ์ใหม่ <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : null}

      {/* Side-by-side comparison */}
      <div className="mb-8 overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <div className="border-b border-slate-50 px-5 py-5 sm:px-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">เทียบข้างกัน</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              ไฮไลต์สีเขียว = ค่าที่ดีที่สุดในเกณฑ์นั้น
            </p>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-400">
            แตะการ์ดด้านบนเพื่อเลือกสถานการณ์เปรียบเทียบ
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="grid min-w-160 gap-0"
              style={{
                gridTemplateColumns: `9.5rem repeat(${visible.length}, minmax(10rem, 1fr))`,
              }}
            >
              {/* Header row */}
              <div className="sticky left-0 z-10 border-b border-slate-100 bg-slate-50/90 px-4 py-4 backdrop-blur" />
              {visible.map((s) => {
                const tone = methodTone(s.method);
                const win = highestScore?.id === s.id;
                return (
                  <div
                    key={`h-${s.id}`}
                    className={`border-b border-l border-slate-100 bg-linear-to-b px-4 py-4 text-center ${tone.soft} ${
                      win ? "ring-inset ring-1 ring-mint-brand/20" : ""
                    }`}
                  >
                    <div
                      className={`mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${tone.bg} ${tone.text}`}
                    >
                      <MethodIcon method={s.method} />
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      {s.method}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400">
                      {s.id} · {s.year}
                    </div>
                    {win ? (
                      <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-mint-brand px-2 py-0.5 text-[9px] font-bold text-white">
                        <Trophy className="h-2.5 w-2.5" />
                        แนะนำ
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {/* Score */}
              <RowLabel>คะแนนรวม</RowLabel>
              {visible.map((s) => (
                <Cell
                  key={`sc-${s.id}`}
                  best={bestByCriterion.score === s.id && visible.length > 1}
                >
                  <div className="flex flex-col items-center gap-2 py-1">
                    <RingScore score={s.score} />
                  </div>
                </Cell>
              ))}

              {/* Cost */}
              <RowLabel>ค่าใช้จ่ายรวม</RowLabel>
              {visible.map((s) => (
                <Cell
                  key={`t-${s.id}`}
                  best={bestByCriterion.total === s.id && visible.length > 1}
                >
                  <div className="text-base font-bold tabular-nums text-slate-900">
                    {money(s.total)}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400">
                    ภาษี {money(s.tax)} · ค่าธรรมเนียม {money(s.fees)}
                  </div>
                </Cell>
              ))}

              {/* Receiver */}
              <RowLabel>ผู้รับ</RowLabel>
              {visible.map((s) => (
                <Cell key={`r-${s.id}`}>
                  <div className="text-sm font-medium text-slate-800">
                    {s.receiver}
                  </div>
                  <div className="mt-1 truncate text-[10px] text-slate-400">
                    {s.asset}
                  </div>
                </Cell>
              ))}

              {/* Criteria */}
              {CRITERIA.map((c) => (
                <CriteriaRow
                  key={c.key}
                  label={c.label}
                  hint={c.hint}
                  scenarios={visible}
                  criterion={c.key}
                  bestId={bestByCriterion[c.key]}
                />
              ))}

              {/* Actions */}
              <div className="sticky left-0 z-10 border-t border-slate-100 bg-white px-4 py-4 text-xs font-semibold text-slate-500">
                การแสดงผล
              </div>
              {visible.map((s) => (
                <div
                  key={`a-${s.id}`}
                  className="flex items-center justify-center border-t border-l border-slate-100 px-4 py-4"
                >
                  <button
                    type="button"
                    onClick={() => toggle(s.id)}
                    className="text-[11px] font-medium text-slate-400 hover:text-slate-600"
                  >
                    นำออกจากการเทียบ
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {highestScore && lowestCost && highestScore.id !== lowestCost.id ? (
        <div className="rounded-2xl border border-slate-100 bg-linear-to-r from-mint-brandLight/50 via-white to-amber-50/40 px-5 py-4 sm:flex sm:items-center sm:justify-between sm:px-6">
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-mint-brand shadow-sm ring-1 ring-slate-100">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">
                ทางเลือกที่สมดุล vs ประหยัดสุด
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                <span className="font-medium text-mint-brandDark">
                  {highestScore.method}
                </span>{" "}
                ได้คะแนนสูงสุด ({highestScore.score}/5) ส่วน{" "}
                <span className="font-medium text-mint-brandDark">
                  {lowestCost.method}
                </span>{" "}
                ถูกที่สุด ({money(lowestCost.total)}) — ต่างกัน{" "}
                {money(Math.abs(highestScore.total - lowestCost.total))}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
        active
          ? "bg-mint-brand text-white shadow-sm"
          : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

function SortBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[10px] px-3 py-1.5 text-[11px] font-semibold transition ${
        active
          ? "bg-slate-900 text-white"
          : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

function RowLabel({ children }: { children: ReactNode }) {
  return (
    <div className="sticky left-0 z-10 flex items-center border-b border-slate-50 bg-white px-4 py-4 text-xs font-semibold text-slate-600">
      {children}
    </div>
  );
}

function Cell({
  children,
  best,
}: {
  children: ReactNode;
  best?: boolean;
}) {
  return (
    <div
      className={`border-b border-l border-slate-50 px-4 py-4 text-center ${
        best ? "bg-mint-brandLight/45" : "bg-white"
      }`}
    >
      {children}
      {best ? (
        <div className="mt-1.5 text-[9px] font-bold tracking-wide text-mint-brandDark uppercase">
          ดีที่สุด
        </div>
      ) : null}
    </div>
  );
}

function CriteriaRow({
  label,
  hint,
  scenarios,
  criterion,
  bestId,
}: {
  label: string;
  hint: string;
  scenarios: Scenario[];
  criterion: CriterionKey;
  bestId: string | null;
}) {
  return (
    <>
      <div className="sticky left-0 z-10 border-b border-slate-50 bg-white px-4 py-4">
        <div className="text-xs font-semibold text-slate-600">{label}</div>
        <div className="mt-0.5 text-[10px] text-slate-400">{hint}</div>
      </div>
      {scenarios.map((s) => {
        const value = s.criteria[criterion];
        const best = bestId === s.id && scenarios.length > 1;
        return (
          <div
            key={`${criterion}-${s.id}`}
            className={`border-b border-l border-slate-50 px-4 py-4 text-center ${
              best ? "bg-mint-brandLight/45" : "bg-white"
            }`}
          >
            <div className="mb-1.5 text-sm font-bold tabular-nums text-slate-800">
              {value}
              <span className="text-[11px] font-medium text-slate-400">/5</span>
            </div>
            <div className="mx-auto flex max-w-28 justify-center">
              <ScoreDots value={value} />
            </div>
            {best ? (
              <div className="mt-1.5 text-[9px] font-bold tracking-wide text-mint-brandDark uppercase">
                ดีที่สุด
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
