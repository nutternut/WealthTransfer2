"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  Clock3,
  Gift,
  Handshake,
  ImageDown,
  Info,
  Landmark,
  Lightbulb,
  Loader2,
  Scale,
  Users,
} from "lucide-react";
import type { TimelineEvent, TimelineYear } from "@/data/wealth-transfer";
import { getStoredFamilyName } from "@/lib/auth";
import { money } from "@/lib/format";
import { captureElementAsPng } from "@/lib/capture-image";
import {
  RECOMMENDATION_LEVEL_LABEL,
  type PlanRecommendation,
  type RecommendationLevel,
} from "@/lib/plan-recommendations";
import type { YearCostBreakdown } from "@/lib/plan-tax";

function yearHeading(year: string) {
  return /^\d{4}$/.test(year) ? `พ.ศ. ${year}` : year;
}

type TimelineViewProps = {
  schedule: TimelineYear[];
  recommendations: PlanRecommendation[];
  yearEstimates?: YearCostBreakdown[];
};

const LEVEL_STYLE: Record<
  RecommendationLevel,
  { wrap: string; badge: string; group: string }
> = {
  high: {
    wrap: "bg-white/80 ring-orange-100/80",
    badge: "bg-orange-500 text-white",
    group: "border-orange-100 bg-orange-50/50",
  },
  medium: {
    wrap: "bg-white/80 ring-amber-100/80",
    badge: "bg-amber-100 text-amber-800",
    group: "border-amber-100 bg-amber-50/40",
  },
  info: {
    wrap: "bg-white/80 ring-mint-200/60",
    badge: "bg-mint-100 text-mint-brandDark",
    group: "border-mint-100 bg-mint-brandLight/40",
  },
};

const LEVEL_ORDER: RecommendationLevel[] = ["high", "medium", "info"];

const METHOD_TONE: Record<
  string,
  { badge: string; icon: string; rail: string; soft: string }
> = {
  ให้: {
    badge: "bg-amber-50 text-amber-800 ring-amber-200/80",
    icon: "bg-amber-100 text-amber-700",
    rail: "bg-amber-400 ring-amber-200",
    soft: "border-amber-100/80 bg-linear-to-br from-amber-50/80 via-white to-white",
  },
  ซื้อขาย: {
    badge: "bg-sky-50 text-sky-800 ring-sky-200/80",
    icon: "bg-sky-100 text-sky-700",
    rail: "bg-sky-400 ring-sky-200",
    soft: "border-sky-100/80 bg-linear-to-br from-sky-50/80 via-white to-white",
  },
  มรดก: {
    badge: "bg-violet-50 text-violet-800 ring-violet-200/80",
    icon: "bg-violet-100 text-violet-700",
    rail: "bg-violet-400 ring-violet-200",
    soft: "border-violet-100/80 bg-linear-to-br from-violet-50/70 via-white to-white",
  },
  ทยอยให้: {
    badge: "bg-orange-50 text-orange-800 ring-orange-200/80",
    icon: "bg-orange-100 text-orange-700",
    rail: "bg-orange-400 ring-orange-200",
    soft: "border-orange-100/80 bg-linear-to-br from-orange-50/80 via-white to-white",
  },
};

function methodTone(method: string) {
  return (
    METHOD_TONE[method] ?? {
      badge: "bg-mint-brandLight text-mint-brandDark ring-mint-200/80",
      icon: "bg-mint-100 text-mint-brandDark",
      rail: "bg-mint-brand ring-mint-200",
      soft: "border-mint-100/80 bg-linear-to-br from-mint-brandLight/80 via-white to-white",
    }
  );
}

function MethodIcon({
  method,
  className = "h-3.5 w-3.5",
}: {
  method: string;
  className?: string;
}) {
  if (method === "ให้" || method === "ทยอยให้")
    return <Gift className={className} />;
  if (method === "ซื้อขาย") return <Handshake className={className} />;
  if (method === "มรดก") return <Landmark className={className} />;
  return <Scale className={className} />;
}

function splitDetail(detail?: string) {
  if (!detail) return { share: undefined as string | undefined, note: undefined as string | undefined };
  const parts = detail.split("·").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { note: parts[0], share: parts.slice(1).join(" · ") };
  }
  if (parts[0]?.includes("%")) return { share: parts[0], note: undefined };
  return { note: parts[0], share: undefined };
}

function EventCard({ event }: { event: TimelineEvent }) {
  const tone = methodTone(event.method);
  const { share, note } = splitDetail(event.detail);
  const receivers = event.receiver
    ? event.receiver.split(/\s*\+\s*/).map((n) => n.trim()).filter(Boolean)
    : [];

  return (
    <div
      className={`rounded-xl border p-3.5 shadow-sm shadow-slate-100/60 ${tone.soft}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}
        >
          <MethodIcon method={event.method} className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide ring-1 ${tone.badge}`}
            >
              {event.method}
            </span>
            {note ? (
              <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-100">
                {note}
              </span>
            ) : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <div className="text-sm font-bold text-slate-900">{event.title}</div>
            {event.value != null && event.value > 0 ? (
              <div className="text-sm font-bold tabular-nums text-slate-900">
                {money(event.value)}
              </div>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-slate-500">
            {share ? (
              <span className="font-semibold text-slate-700">สัดส่วน {share}</span>
            ) : null}
            {share && receivers.length > 0 ? (
              <ArrowRight className="h-3 w-3 text-slate-300" />
            ) : null}
            {receivers.length > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3 w-3 text-slate-400" />
                <span className="text-slate-600">
                  {receivers.join(" · ")}
                </span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function YearBreakdownPanel({
  year,
  breakdown,
}: {
  year: string;
  breakdown: YearCostBreakdown;
}) {
  const saleTotal =
    breakdown.salePitWht +
    breakdown.saleSbt +
    breakdown.saleTransferFees +
    breakdown.saleStampDuty;
  const giftTotal =
    breakdown.movableGiftTax +
    breakdown.immovableGiftTax +
    breakdown.giftFeesAndDuty;
  const inheritTotal = breakdown.inheritanceTax + breakdown.inheritanceTransferFees;

  function Row({ label, amount }: { label: string; amount: number }) {
    return (
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-500">{label}</span>
        <span className="font-semibold tabular-nums text-slate-800">
          {money(amount)}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl bg-white px-3.5 py-3 text-[11px] ring-1 ring-slate-200/80">
      {saleTotal > 0 ? (
        <div>
          <div className="mb-1.5 font-bold text-slate-800">ซื้อขาย</div>
          <div className="space-y-1 pl-1">
            <Row label="ภาษีเงินได้ / WHT" amount={breakdown.salePitWht} />
            <Row label="ภาษีธุรกิจเฉพาะ" amount={breakdown.saleSbt} />
            <Row label="ค่าธรรมเนียมโอน" amount={breakdown.saleTransferFees} />
            <Row label="อากรแสตมป์" amount={breakdown.saleStampDuty} />
          </div>
        </div>
      ) : null}
      {giftTotal > 0 ? (
        <div>
          <div className="mb-1.5 font-bold text-slate-800">การให้</div>
          <div className="space-y-1 pl-1">
            <Row label="ภาษีการให้สังหาริมทรัพย์" amount={breakdown.movableGiftTax} />
            <Row label="ภาษีการให้อสังหาริมทรัพย์" amount={breakdown.immovableGiftTax} />
            <Row label="ค่าธรรมเนียม/อากร" amount={breakdown.giftFeesAndDuty} />
          </div>
        </div>
      ) : null}
      {inheritTotal > 0 ? (
        <div>
          <div className="mb-1.5 font-bold text-slate-800">มรดก</div>
          <div className="space-y-1 pl-1">
            <Row label="ภาษีมรดก" amount={breakdown.inheritanceTax} />
            <Row label="ค่าโอนอสังหาริมทรัพย์" amount={breakdown.inheritanceTransferFees} />
          </div>
        </div>
      ) : null}
      {breakdown.other > 0 ? (
        <Row label="ค่าใช้จ่ายอื่น" amount={breakdown.other} />
      ) : null}
      <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-2">
        <span className="font-bold text-slate-800">
          รวมภาษีและค่าใช้จ่ายปี {/^\d{4}$/.test(year) ? year : year}
        </span>
        <span className="font-bold tabular-nums text-slate-900">
          {money(breakdown.total)}
        </span>
      </div>
    </div>
  );
}

function YearEstimateButton({
  amount,
  peak,
  open,
  clickable,
  onToggle,
}: {
  amount: number;
  peak: boolean;
  open: boolean;
  clickable: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!clickable}
      className={`rounded-xl px-2.5 py-1.5 text-right transition ${
        peak
          ? "bg-orange-500 text-white"
          : "bg-white text-slate-800 ring-1 ring-slate-200"
      } ${clickable ? "hover:brightness-95" : ""}`}
    >
      <div
        className={`text-[9px] font-medium ${
          peak ? "text-orange-100" : "text-slate-400"
        }`}
      >
        ประมาณการภาษีและค่าใช้จ่าย
      </div>
      <div className="text-xs font-bold tabular-nums">{money(amount)}</div>
      {clickable ? (
        <div
          className={`mt-0.5 text-[9px] ${
            peak ? "text-orange-100/90" : "text-slate-400"
          }`}
        >
          {open ? "ซ่อนรายละเอียด" : "กดดูรายละเอียด"}
        </div>
      ) : null}
    </button>
  );
}

function YearBlock({
  yearItem,
  index,
  peak,
  barWidth,
  railClass,
  estimate,
}: {
  yearItem: TimelineYear;
  index: number;
  peak: boolean;
  barWidth: number;
  railClass: string;
  estimate?: YearCostBreakdown;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative grid grid-cols-[28px_1fr] gap-3 sm:grid-cols-[32px_1fr] sm:gap-4"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="relative z-10 flex justify-center pt-3">
        <span
          className={`h-3.5 w-3.5 rounded-full ring-4 ring-white ${
            peak
              ? "bg-orange-500 shadow-[0_0_0_3px_rgba(237,125,49,0.25)]"
              : railClass
          }`}
          aria-hidden
        />
      </div>

      <div
        className={`rounded-2xl border p-4 transition ${
          peak
            ? "border-orange-200/80 bg-linear-to-br from-orange-50/90 via-white to-white shadow-md shadow-orange-100/50"
            : "border-slate-100 bg-slate-50/40 hover:border-slate-200 hover:bg-white"
        }`}
      >
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
              ปีที่ {index + 1}
              {peak ? " · ภาระสูงสุด" : ""}
            </div>
            <div className="mt-0.5 text-lg font-extrabold tracking-tight text-slate-900">
              {yearHeading(yearItem.year)}
            </div>
          </div>
          <YearEstimateButton
            amount={yearItem.amount}
            peak={peak}
            open={open}
            clickable={Boolean(estimate)}
            onToggle={() => estimate && setOpen((value) => !value)}
          />
        </div>

        {open && estimate ? (
          <YearBreakdownPanel year={yearItem.year} breakdown={estimate} />
        ) : null}

        <div className="mb-3 mt-3 h-1.5 overflow-hidden rounded-full bg-white/80 ring-1 ring-slate-100">
          <div
            className={`h-full rounded-full transition-all ${
              peak
                ? "bg-linear-to-r from-orange-400 to-orange-500"
                : "bg-linear-to-r from-mint-brand to-mint-400"
            }`}
            style={{ width: `${barWidth}%` }}
          />
        </div>

        <div className="space-y-2">
          {yearItem.events.map((event, eventIndex) => (
            <EventCard
              key={
                event.id ??
                `${yearItem.year}-${eventIndex}-${event.title}-${event.method}`
              }
              event={event}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TimelineView({
  schedule,
  recommendations,
  yearEstimates = [],
}: TimelineViewProps) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);
  const [familyName, setFamilyName] = useState<string | null>(null);
  const peakAmount = Math.max(...schedule.map((y) => y.amount), 1);
  const peakYear = schedule.reduce(
    (best, item) => (item.amount > best.amount ? item : best),
    schedule[0],
  )?.year;
  const totalCost = schedule.reduce((sum, y) => sum + y.amount, 0);

  useEffect(() => {
    setFamilyName(getStoredFamilyName());
  }, []);

  async function handleCapture() {
    if (!captureRef.current || capturing) return;
    setCapturing(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await captureElementAsPng(
        captureRef.current,
        `wealth-transfer-plan-${stamp}.png`,
      );
    } catch (e) {
      console.error(e);
      window.alert("บันทึกรูปไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setCapturing(false);
    }
  }

  return (
    <div ref={captureRef} className="animate-[fadeUp_0.35s_ease-out]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-mint-brandLight px-3 py-1 text-xs font-semibold text-mint-brand">
            <Clock3 className="h-3.5 w-3.5" />
            ลำดับตามปีในแผน
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {familyName
              ? `Wealth Transfer Plan · ${familyName}`
              : "Wealth Transfer Plan"}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {schedule.length} ปี · ประมาณการภาษีและค่าใช้จ่ายรวม {money(totalCost)}
          </p>
        </div>
        <div
          data-capture-ignore
          className="flex flex-wrap items-center gap-2 self-start"
        >
          <button
            type="button"
            onClick={handleCapture}
            disabled={capturing}
            className="inline-flex items-center gap-1.5 rounded-xl bg-mint-brand px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-mint-brandDark disabled:opacity-60"
          >
            {capturing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImageDown className="h-3.5 w-3.5" />
            )}
            {capturing ? "กำลังบันทึก..." : "บันทึกเป็นรูป"}
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            กลับหน้าภาพรวม
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm shadow-slate-100/80">
          <div className="border-b border-slate-100 bg-linear-to-r from-mint-brandLight/40 via-white to-orange-50/30 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-mint-brand shadow-sm ring-1 ring-mint-100">
                <CalendarRange className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  ลำดับการดำเนินการ
                </h2>
                <p className="text-[11px] text-slate-400">
                  จากรายการที่เลือกเข้าสู่แผน
                </p>
              </div>
            </div>
          </div>

          <div className="relative px-5 py-5 sm:px-6">
            <div
              className="absolute top-8 bottom-8 left-[34px] w-px bg-linear-to-b from-mint-brand/50 via-orange-300/60 to-slate-200 sm:left-[38px]"
              aria-hidden
            />

            <div className="space-y-5">
              {schedule.map((yearItem, index) => {
                const peak = yearItem.year === peakYear;
                const primaryMethod = yearItem.events[0]?.method ?? "";
                const railTone = methodTone(primaryMethod);
                const barWidth = Math.max(
                  8,
                  Math.round((yearItem.amount / peakAmount) * 100),
                );
                const estimate = yearEstimates.find(
                  (item) => item.year === yearItem.year,
                );

                return (
                  <YearBlock
                    key={yearItem.year}
                    yearItem={yearItem}
                    index={index}
                    peak={peak}
                    barWidth={barWidth}
                    railClass={railTone.rail}
                    estimate={estimate}
                  />
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-100 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-linear-to-br from-slate-50 to-white px-4 py-4 ring-1 ring-slate-200/80">
              <div>
                <div className="text-[11px] font-semibold text-slate-500">
                  ประมาณการภาษีและค่าใช้จ่ายรวมทั้งแผน
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  รวมจากทุกปีในแผน · ไม่รวมมูลค่าทรัพย์สิน
                </p>
              </div>
              <div className="text-right text-xl font-bold tabular-nums text-slate-900">
                {money(totalCost)}
              </div>
            </div>
          </div>
        </section>

        <section className="h-fit rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100/80 sm:p-6 lg:sticky lg:top-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">คำแนะนำ</h2>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Rule-based จากแผนปัจจุบัน · เรียงตามระดับความสำคัญ
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <Lightbulb className="h-4 w-4" />
            </div>
          </div>

          {recommendations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-[12px] text-slate-500">
              ยังไม่มีเงื่อนไขที่เข้าเกณฑ์คำแนะนำจากแผนนี้
            </div>
          ) : (
            <div className="space-y-4">
              {LEVEL_ORDER.map((level) => {
                const items = recommendations.filter((r) => r.level === level);
                if (items.length === 0) return null;
                const style = LEVEL_STYLE[level];
                return (
                  <div
                    key={level}
                    className={`rounded-xl border px-3 py-3 ${style.group}`}
                  >
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ${style.badge}`}
                      >
                        {RECOMMENDATION_LEVEL_LABEL[level]}
                      </span>
                      <span className="text-[10px] font-medium text-slate-400">
                        {items.length} รายการ
                      </span>
                    </div>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className={`rounded-xl p-3 ring-1 ${style.wrap}`}
                        >
                          <div className="text-sm font-bold text-slate-900">
                            {item.title}
                          </div>
                          <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
                            {item.advice}
                          </p>
                          {item.assets.length > 0 ? (
                            <div className="mt-2.5 flex flex-wrap gap-1">
                              {item.assets.map((name, assetIndex) => (
                                <span
                                  key={`${name}-${assetIndex}`}
                                  className="inline-flex rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200/80"
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex gap-2.5 rounded-xl border border-orange-100 bg-orange-50/80 px-3.5 py-3 text-[12px] leading-relaxed text-orange-900/80">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-600" />
            <p>
              คำแนะนำสร้างจากเงื่อนไขในแผนเท่านั้น ไม่ใช่ข้อวินิจฉัยทางกฎหมายหรือภาษี
              และไม่สรุปข้อเท็จจริงที่ระบบไม่มีข้อมูล
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
