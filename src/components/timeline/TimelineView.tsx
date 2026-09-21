"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  Check,
  Clock3,
  ChevronDown,
  Gift,
  Handshake,
  ImageDown,
  Info,
  Landmark,
  Lightbulb,
  Loader2,
  Scale,
  Search,
  Users,
  X,
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

function yearFilterLabel(year: string, index: number) {
  return `ปีที่ ${index + 1} · ${yearHeading(year)}`;
}

function yearSearchHaystack(year: string, index: number) {
  return [
    `ปีที่ ${index + 1}`,
    String(index + 1),
    year,
    yearHeading(year),
  ]
    .join(" ")
    .toLowerCase();
}

type YearFilterOption = {
  value: string;
  index: number;
  label: string;
};

function YearFilter({
  options,
  selectedYears,
  onToggle,
  onClear,
}: {
  options: YearFilterOption[];
  selectedYears: string[];
  onToggle: (year: string) => void;
  onClear: () => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [mounted, setMounted] = useState(false);

  const selectedSet = useMemo(() => new Set(selectedYears), [selectedYears]);
  const filtering = selectedYears.length > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) =>
      yearSearchHaystack(item.value, item.index).includes(q),
    );
  }, [options, query]);

  const menuItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const showAll = !q || "ทุกปี".startsWith(q);
    const years = filtered.map((item) => ({
      kind: "year" as const,
      value: item.value,
      label: item.label,
      index: item.index,
    }));
    if (!showAll) return years;
    return [
      { kind: "all" as const, value: "__all__", label: "ทุกปี", index: -1 },
      ...years,
    ];
  }, [filtered, query]);

  const selectedOptions = useMemo(
    () => options.filter((item) => selectedSet.has(item.value)),
    [options, selectedSet],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }

    function updateCoords() {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setCoords({
        top: r.bottom + 6,
        left: r.left,
        width: r.width,
      });
    }

    updateCoords();
    window.addEventListener("resize", updateCoords);
    window.addEventListener("scroll", updateCoords, true);
    return () => {
      window.removeEventListener("resize", updateCoords);
      window.removeEventListener("scroll", updateCoords, true);
    };
  }, [open, menuItems.length]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
      setQuery("");
      setHighlight(0);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function pick(year: string) {
    onToggle(year);
    setQuery("");
    setHighlight(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function pickAll() {
    onClear();
    setQuery("");
    setHighlight(0);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(0, menuItems.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = menuItems[highlight];
      if (!item) return;
      if (item.kind === "all") pickAll();
      else pick(item.value);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      setHighlight(0);
    } else if (e.key === "Backspace" && !query && selectedYears.length > 0) {
      onToggle(selectedYears[selectedYears.length - 1]!);
    }
  }

  const menu =
    open && coords && mounted
      ? createPortal(
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: coords.width,
            }}
            className="z-80 max-h-72 overflow-auto rounded-2xl border border-mint-100/80 bg-white p-1.5 shadow-xl shadow-slate-200/70 ring-1 ring-slate-100 animate-[fadeUp_0.15s_ease]"
          >
            {menuItems.length === 0 ? (
              <div className="px-3.5 py-6 text-center text-xs text-slate-400">
                ไม่พบปีที่ตรงกับคำค้น
              </div>
            ) : (
              <ul className="space-y-0.5">
                {menuItems.map((item, i) => {
                  const active =
                    item.kind === "all"
                      ? !filtering
                      : selectedSet.has(item.value);
                  const focused = i === highlight;
                  const isAll = item.kind === "all";
                  return (
                    <li
                      key={item.value}
                      role="option"
                      aria-selected={active}
                    >
                      <button
                        type="button"
                        className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                          isAll
                            ? active
                              ? "bg-mint-brandLight ring-1 ring-mint-200"
                              : focused
                                ? "bg-mint-brandLight/70"
                                : "bg-slate-50 hover:bg-mint-brandLight/50"
                            : active
                              ? "bg-orange-50 ring-1 ring-orange-200"
                              : focused
                                ? "bg-mint-brandLight/60"
                                : "hover:bg-slate-50"
                        }`}
                        onMouseEnter={() => setHighlight(i)}
                        onClick={() =>
                          isAll ? pickAll() : pick(item.value)
                        }
                      >
                        {isAll ? (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-mint-brand shadow-sm ring-1 ring-mint-100">
                            <CalendarRange className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold tabular-nums ${
                              active
                                ? "bg-orange-500 text-white"
                                : "bg-white text-slate-500 ring-1 ring-slate-200"
                            }`}
                          >
                            {item.index + 1}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-xs font-bold ${
                              active && !isAll
                                ? "text-orange-800"
                                : "text-slate-800"
                            }`}
                          >
                            {isAll ? "ทุกปี" : yearHeading(item.value)}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-slate-400">
                            {isAll
                              ? `แสดงทั้งแผน ${options.length} ปี`
                              : `ปีที่ ${item.index + 1}`}
                          </span>
                        </span>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                            active
                              ? isAll
                                ? "bg-mint-brand text-white"
                                : "bg-orange-500 text-white"
                              : "bg-white ring-1 ring-slate-200"
                          }`}
                        >
                          {active ? (
                            <Check className="h-3 w-3" strokeWidth={3} />
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="space-y-2">
      <div ref={rootRef} className="relative">
        <div
          className={`flex items-center gap-2 rounded-2xl border bg-white px-3 py-1.5 shadow-sm transition ${
            open
              ? "border-mint-brand ring-2 ring-mint-200"
              : "border-slate-200 hover:border-mint-brand"
          }`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-mint-brandLight text-mint-brand">
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-xs text-slate-700 outline-none placeholder:text-slate-400"
            value={query}
            placeholder={
              filtering
                ? "ค้นหาปีเพิ่ม เช่น 2570 หรือ ปีที่ 5"
                : "ทุกปี · ค้นหาหรือเลือกปี"
            }
            onFocus={() => {
              setOpen(true);
              setHighlight(0);
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setHighlight(0);
            }}
            onKeyDown={onKeyDown}
          />
          {filtering ? (
            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700 ring-1 ring-orange-200">
              {selectedYears.length} ปี
            </span>
          ) : (
            <span className="rounded-full bg-mint-brandLight px-2 py-0.5 text-[10px] font-bold text-mint-brand">
              ทุกปี
            </span>
          )}
          {query ? (
            <button
              type="button"
              aria-label="ล้างคำค้น"
              className="rounded-md p-0.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-slate-400 transition ${
                open ? "rotate-180" : ""
              }`}
            />
          )}
        </div>
        {menu}
      </div>

      {filtering ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedOptions.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onToggle(item.value)}
              className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 py-1 pr-2 pl-1 text-[11px] font-semibold text-orange-800 ring-1 ring-orange-200 transition hover:bg-orange-100"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                {item.index + 1}
              </span>
              {yearHeading(item.value)}
              <X className="h-3 w-3 text-orange-500" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
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
      className={`shrink-0 text-right ${
        clickable ? "hover:opacity-70" : ""
      }`}
    >
      <div
        className={`text-[13px] font-semibold tabular-nums leading-none ${
          peak ? "text-orange-600" : "text-slate-900"
        }`}
      >
        {money(amount)}
      </div>
      {clickable ? (
        <div className="mt-0.5 text-[10px] leading-none text-slate-400">
          {open ? "ซ่อนภาษี" : "ดูภาษี"}
        </div>
      ) : null}
    </button>
  );
}

function YearBlock({
  yearItem,
  index,
  peak,
  estimate,
  expanded,
  onToggleExpand,
  isFirst,
  isLast,
}: {
  yearItem: TimelineYear;
  index: number;
  peak: boolean;
  estimate?: YearCostBreakdown;
  expanded: boolean;
  onToggleExpand: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const eventCount = yearItem.events.length;

  return (
    <div
      className="grid grid-cols-[4.75rem_1.75rem_1fr] items-stretch gap-x-2 sm:grid-cols-[5.5rem_2rem_1fr] sm:gap-x-3"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="pt-3.5 text-right">
        <div className="text-[11px] leading-snug font-medium text-slate-400">
          {yearHeading(yearItem.year)}
        </div>
        <div className="mt-0.5 text-[10px] text-slate-300">ปีที่ {index + 1}</div>
      </div>

      <div className="relative">
        {!isFirst ? (
          <span
            className="absolute top-0 left-1/2 h-5 w-px -translate-x-1/2 bg-slate-300"
            aria-hidden
          />
        ) : null}
        {!isLast ? (
          <span
            className="absolute top-5 bottom-0 left-1/2 w-px -translate-x-1/2 bg-slate-300"
            aria-hidden
          />
        ) : null}
        <span
          className={`absolute top-4 left-1/2 z-10 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 ${
            peak
              ? "border-orange-400 bg-orange-400"
              : expanded
                ? "border-mint-brand bg-mint-brand"
                : "border-slate-300 bg-white"
          }`}
          aria-hidden
        />
      </div>

      <div className="mb-4 rounded-lg bg-white p-4 shadow-sm shadow-slate-200/80 ring-1 ring-slate-100">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            className="min-w-0 flex-1 text-left"
          >
            <div className="flex items-center gap-1.5">
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform ${
                  expanded ? "rotate-0" : "-rotate-90"
                }`}
              />
              <span className="text-sm font-semibold text-slate-800">
                {eventCount} รายการ
                {peak ? " · ภาระสูงสุด" : ""}
              </span>
            </div>
            <p className="mt-1 pl-5 text-[12px] leading-relaxed text-slate-400">
              ประมาณการภาษีและค่าใช้จ่าย {money(yearItem.amount)}
            </p>
          </button>
          {expanded ? (
            <YearEstimateButton
              amount={yearItem.amount}
              peak={peak}
              open={detailsOpen}
              clickable={Boolean(estimate)}
              onToggle={() => estimate && setDetailsOpen((value) => !value)}
            />
          ) : (
            <span
              className={`shrink-0 pt-0.5 text-[13px] font-semibold tabular-nums ${
                peak ? "text-orange-600" : "text-slate-700"
              }`}
            >
              {money(yearItem.amount)}
            </span>
          )}
        </div>

        {expanded && detailsOpen && estimate ? (
          <div className="mt-3">
            <YearBreakdownPanel year={yearItem.year} breakdown={estimate} />
          </div>
        ) : null}

        {expanded ? (
          <div className="mt-3 space-y-2">
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
        ) : null}
      </div>
    </div>
  );
}

function RecommendationItem({
  item,
  wrapClass,
  expanded,
  onToggle,
}: {
  item: PlanRecommendation;
  wrapClass: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const assetCount = item.assets.length;

  return (
    <div className={`rounded-xl ring-1 ${wrapClass}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
            expanded ? "rotate-0" : "-rotate-90"
          }`}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">
          {item.title}
        </span>
        <span className="shrink-0 text-[10px] font-medium text-slate-400">
          {assetCount > 0 ? `${assetCount} ทรัพย์สิน` : "รายละเอียด"}
        </span>
      </button>
      {expanded ? (
        <div className="px-3 pb-3">
          <p className="text-[12px] leading-relaxed text-slate-600">
            {item.advice}
          </p>
          {assetCount > 0 ? (
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
      ) : null}
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
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [expandedYears, setExpandedYears] = useState<string[]>([]);
  const [expandedRecs, setExpandedRecs] = useState<string[]>([]);

  const visible = useMemo(() => {
    if (selectedYears.length === 0) return schedule;
    const picked = new Set(selectedYears);
    return schedule.filter((item) => picked.has(item.year));
  }, [schedule, selectedYears]);

  const peakYear = visible.reduce(
    (best, item) => (item.amount > best.amount ? item : best),
    visible[0],
  )?.year;
  const totalCost = schedule.reduce((sum, y) => sum + y.amount, 0);
  const visibleCost = visible.reduce((sum, y) => sum + y.amount, 0);
  const filtering = selectedYears.length > 0;
  const allExpanded =
    visible.length > 0 &&
    visible.every((item) => expandedYears.includes(item.year));
  const allRecsExpanded =
    recommendations.length > 0 &&
    recommendations.every((item) => expandedRecs.includes(item.id));

  useEffect(() => {
    setSelectedYears((current) =>
      current.filter((year) => schedule.some((item) => item.year === year)),
    );
    setExpandedYears((current) => {
      const next = current.filter((year) =>
        schedule.some((item) => item.year === year),
      );
      return next.length === current.length ? current : next;
    });
    setExpandedRecs((current) => {
      const next = current.filter((id) =>
        recommendations.some((item) => item.id === id),
      );
      return next.length === current.length ? current : next;
    });
  }, [schedule, recommendations]);

  useEffect(() => {
    setFamilyName(getStoredFamilyName());
  }, []);

  function selectAllYears() {
    setSelectedYears([]);
  }

  function toggleYear(year: string) {
    setSelectedYears((current) => {
      if (current.length === 0) return [year];
      if (current.includes(year)) {
        const next = current.filter((item) => item !== year);
        return next.length === 0 || next.length === schedule.length ? [] : next;
      }
      const next = [...current, year];
      return next.length === schedule.length ? [] : next;
    });
  }

  function toggleExpanded(year: string) {
    setExpandedYears((current) =>
      current.includes(year)
        ? current.filter((item) => item !== year)
        : [...current, year],
    );
  }

  function expandAllYears() {
    setExpandedYears(visible.map((item) => item.year));
  }

  function collapseAllYears() {
    setExpandedYears([]);
  }

  function toggleExpandedRec(id: string) {
    setExpandedRecs((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function expandAllRecs() {
    setExpandedRecs(recommendations.map((item) => item.id));
  }

  function collapseAllRecs() {
    setExpandedRecs([]);
  }

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
            {filtering
              ? `แสดง ${visible.length} จาก ${schedule.length} ปี · ประมาณการปีที่เลือก ${money(visibleCost)}`
              : `${schedule.length} ปี · ประมาณการภาษีและค่าใช้จ่ายรวม ${money(totalCost)}`}
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
            <div className="flex flex-1 items-center justify-between gap-3">
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
              {visible.length > 1 ? (
                <button
                  type="button"
                  data-capture-ignore
                  onClick={allExpanded ? collapseAllYears : expandAllYears}
                  className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-white"
                >
                  {allExpanded ? "ย่อทั้งหมด" : "ขยายทั้งหมด"}
                </button>
              ) : null}
            </div>
          </div>

          {schedule.length > 0 ? (
            <div
              data-capture-ignore
              className="border-b border-slate-100 px-5 py-3 sm:px-6"
            >
              <div className="mb-2 text-[11px] font-semibold text-slate-500">
                กรองปีที่ต้องการดู
                {filtering ? (
                  <span className="ml-1.5 font-medium text-mint-brand">
                    · เลือก {visible.length} ปี
                  </span>
                ) : (
                  <span className="ml-1.5 font-medium text-slate-400">
                    · ค้นหาแล้วเลือกได้มากกว่า 1 ปี
                  </span>
                )}
              </div>
              <YearFilter
                options={schedule.map((yearItem, index) => ({
                  value: yearItem.year,
                  index,
                  label: yearFilterLabel(yearItem.year, index),
                }))}
                selectedYears={selectedYears}
                onToggle={toggleYear}
                onClear={selectAllYears}
              />
            </div>
          ) : null}

          <div className="px-4 py-6 sm:px-6">
            <div>
              {visible.map((yearItem, visibleIndex) => {
                const index = schedule.findIndex(
                  (item) => item.year === yearItem.year,
                );
                const peak = yearItem.year === peakYear;
                const estimate = yearEstimates.find(
                  (item) => item.year === yearItem.year,
                );

                return (
                  <YearBlock
                    key={yearItem.year}
                    yearItem={yearItem}
                    index={index}
                    peak={peak}
                    estimate={estimate}
                    expanded={expandedYears.includes(yearItem.year)}
                    onToggleExpand={() => toggleExpanded(yearItem.year)}
                    isFirst={visibleIndex === 0}
                    isLast={visibleIndex === visible.length - 1}
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
                  {filtering
                    ? `รวมปีที่เลือก ${visible.length} ปี · ทั้งแผน ${money(totalCost)}`
                    : "รวมจากทุกปีในแผน · ไม่รวมมูลค่าทรัพย์สิน"}
                </p>
              </div>
              <div className="text-right text-xl font-bold tabular-nums text-slate-900">
                {money(filtering ? visibleCost : totalCost)}
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
            <div className="flex items-center gap-2">
              {recommendations.length > 1 ? (
                <button
                  type="button"
                  data-capture-ignore
                  onClick={allRecsExpanded ? collapseAllRecs : expandAllRecs}
                  className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
                >
                  {allRecsExpanded ? "ย่อทั้งหมด" : "ขยายทั้งหมด"}
                </button>
              ) : null}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <Lightbulb className="h-4 w-4" />
              </div>
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
                        <RecommendationItem
                          key={item.id}
                          item={item}
                          wrapClass={style.wrap}
                          expanded={expandedRecs.includes(item.id)}
                          onToggle={() => toggleExpandedRec(item.id)}
                        />
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
