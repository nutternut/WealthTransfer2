import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Landmark,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import type { Asset, Entity, Member, PlanItem } from "@/data/wealth-transfer";
import { parseShareholders } from "@/lib/entity-store";
import { money } from "@/lib/format";

type StructureViewProps = {
  plan: PlanItem[];
  assets: Asset[];
  members: Member[];
  entities: Entity[];
};

type OwnershipSlice = {
  name: string;
  percent: number;
  gen?: string;
};

type AssetSnapshot = {
  key: string;
  name: string;
  kind: "asset" | "entity";
  value: number;
  before: OwnershipSlice[];
  after: OwnershipSlice[];
  highlight?: "amber" | "emerald";
  note?: string;
};

function parseSharePercent(share: string) {
  const value = Number.parseFloat(share.replace("%", ""));
  return Number.isNaN(value) ? 0 : value;
}

function memberGen(members: Member[], name: string) {
  return members.find((m) => m.name === name)?.gen;
}

function splitReceivers(receiver: string) {
  return receiver
    .split(/\s*\+\s*|\s*\/\s*|,|&/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function findEntity(entities: Entity[], assetName: string) {
  return entities.find(
    (e) => assetName.includes(e.name) || e.name.includes(assetName.replace(/^หุ้น\s+/, "")),
  );
}

function buildSnapshots(
  plan: PlanItem[],
  assets: Asset[],
  members: Member[],
  entities: Entity[],
): AssetSnapshot[] {
  return plan.map((item) => {
    const asset = assets.find((a) => a.name === item.asset);
    const entity = findEntity(entities, item.asset);
    const transferPct = parseSharePercent(item.share);
    const receivers = splitReceivers(item.receiver);

    if (entity) {
      const holders = parseShareholders(entity.shareholders).filter(
        (h): h is { name: string; percent: number } => h.percent != null,
      );
      const before: OwnershipSlice[] = holders.map((h) => ({
        name: h.name,
        percent: h.percent,
        gen: memberGen(members, h.name),
      }));

      const afterMap = new Map(before.map((h) => [h.name, { ...h }]));
      const ownerSlice = afterMap.get(item.owner);
      if (ownerSlice && transferPct > 0 && receivers.length > 0) {
        const give = Math.min(ownerSlice.percent, transferPct);
        ownerSlice.percent = Math.round((ownerSlice.percent - give) * 10) / 10;
        const each = Math.round((give / receivers.length) * 10) / 10;
        receivers.forEach((name, i) => {
          const existing = afterMap.get(name);
          const add =
            i === receivers.length - 1
              ? Math.round((give - each * (receivers.length - 1)) * 10) / 10
              : each;
          if (existing) {
            existing.percent = Math.round((existing.percent + add) * 10) / 10;
          } else {
            afterMap.set(name, {
              name,
              percent: add,
              gen: memberGen(members, name),
            });
          }
        });
      }

      const after = [...afterMap.values()].filter((h) => h.percent > 0);
      const g2Before = sumGen(before, "รุ่นที่ 2");
      const g2After = sumGen(after, "รุ่นที่ 2");

      return {
        key: item.asset,
        name: entity.name,
        kind: "entity" as const,
        value: entity.value || asset?.value || 0,
        before,
        after,
        highlight: "emerald" as const,
        note:
          g2After > g2Before
            ? `รุ่นที่ 2 เพิ่มขึ้น ${(g2After - g2Before).toFixed(0)}%`
            : undefined,
      };
    }

    const ownerPct = asset?.share ?? 100;
    const before: OwnershipSlice[] = [
      {
        name: item.owner,
        percent: ownerPct,
        gen: memberGen(members, item.owner),
      },
    ];

    const after: OwnershipSlice[] =
      transferPct >= ownerPct && receivers.length === 1
        ? [
            {
              name: receivers[0],
              percent: ownerPct,
              gen: memberGen(members, receivers[0]),
            },
          ]
        : (() => {
            const remain = Math.max(0, ownerPct - transferPct);
            const rows: OwnershipSlice[] = [];
            if (remain > 0) {
              rows.push({
                name: item.owner,
                percent: remain,
                gen: memberGen(members, item.owner),
              });
            }
            const each =
              receivers.length > 0
                ? Math.round((Math.min(transferPct, ownerPct) / receivers.length) * 10) / 10
                : 0;
            receivers.forEach((name, i) => {
              const pct =
                i === receivers.length - 1
                  ? Math.round(
                      (Math.min(transferPct, ownerPct) - each * (receivers.length - 1)) * 10,
                    ) / 10
                  : each;
              rows.push({
                name,
                percent: pct,
                gen: memberGen(members, name),
              });
            });
            return rows;
          })();

    return {
      key: item.asset,
      name: item.asset,
      kind: "asset" as const,
      value: asset?.value ?? 0,
      before,
      after,
      highlight: "amber" as const,
      note:
        receivers.length === 1 && transferPct >= 100
          ? `${receivers[0]} 100%`
          : undefined,
    };
  });
}

function sumGen(slices: OwnershipSlice[], gen: string) {
  return slices
    .filter((s) => s.gen === gen)
    .reduce((sum, s) => sum + s.percent, 0);
}

function ControlMeter({ percent, label }: { percent: number; label: string }) {
  const safe = Math.min(100, Math.max(0, percent));
  const belowMajority = safe < 50;

  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-2">
        <div className="text-[11px] font-medium text-slate-400">{label}</div>
        <div
          className={`text-2xl font-bold tabular-nums ${
            belowMajority ? "text-amber-600" : "text-slate-900"
          }`}
        >
          {safe.toFixed(0)}%
        </div>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            belowMajority
              ? "bg-linear-to-r from-amber-400 to-orange-500"
              : "bg-linear-to-r from-mint-brand to-mint-400"
          }`}
          style={{ width: `${safe}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-slate-400">
        <span>0%</span>
        <span className="font-medium text-slate-500">เส้นควบคุม 50%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function OwnershipBar({ slices }: { slices: OwnershipSlice[] }) {
  const palette = [
    "bg-mint-brand",
    "bg-sky-400",
    "bg-amber-400",
    "bg-violet-400",
    "bg-mint-400",
    "bg-orange-400",
  ];

  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        {slices.map((s, i) => (
          <div
            key={`${s.name}-${i}`}
            className={`${palette[i % palette.length]} transition-all duration-500`}
            style={{ width: `${s.percent}%` }}
            title={`${s.name} ${s.percent}%`}
          />
        ))}
      </div>
      <div className="mt-3 space-y-2">
        {slices.map((s, i) => (
          <div key={`${s.name}-row-${i}`} className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${palette[i % palette.length]}`}
              />
              <span className="truncate text-xs font-medium text-slate-700">{s.name}</span>
              {s.gen ? (
                <span className="shrink-0 rounded-md bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">
                  {s.gen.replace("รุ่นที่ ", "G")}
                </span>
              ) : null}
            </div>
            <span className="shrink-0 text-xs font-bold tabular-nums text-slate-800">
              {s.percent}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DiagramPanel({
  title,
  badge,
  badgeTone,
  people,
  snapshots,
  side,
}: {
  title: string;
  badge: string;
  badgeTone: "slate" | "mint";
  people: { label: string; sub: string }[];
  snapshots: AssetSnapshot[];
  side: "before" | "after";
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white">
      <div
        className={`border-b border-slate-50 px-5 py-4 ${
          side === "after"
            ? "bg-linear-to-r from-mint-brandLight/60 to-white"
            : "bg-slate-50/80"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
              badgeTone === "mint"
                ? "bg-mint-brand text-white"
                : "bg-slate-200/80 text-slate-600"
            }`}
          >
            {badge}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {people.map((p) => (
            <div
              key={p.label}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-100"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-mint-brandLight text-[10px] font-bold text-mint-brandDark">
                {p.label.replace(/^คุณ|^เด็ก(?:ชาย|หญิง)/, "").slice(0, 2)}
              </span>
              <div>
                <div className="text-xs font-semibold text-slate-800">{p.label}</div>
                <div className="text-[10px] text-slate-400">{p.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        {snapshots.map((snap, index) => {
          const slices = side === "before" ? snap.before : snap.after;
          const border =
            side === "after" && snap.highlight === "amber"
              ? "ring-amber-200"
              : side === "after" && snap.highlight === "emerald"
                ? "ring-mint-200"
                : "ring-slate-100";

          return (
            <div
              key={`${side}-${snap.key}`}
              style={{ animationDelay: `${index * 60}ms` }}
              className={`animate-[fadeUp_0.4s_ease-out_both] rounded-2xl bg-slate-50/60 p-4 ring-1 ${border}`}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                      snap.kind === "entity"
                        ? "bg-sky-50 text-sky-600"
                        : "bg-amber-50 text-amber-600"
                    }`}
                  >
                    {snap.kind === "entity" ? (
                      <Building2 className="h-4 w-4" />
                    ) : (
                      <Landmark className="h-4 w-4" />
                    )}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{snap.name}</div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {snap.value > 0 ? money(snap.value) : "มูลค่าอยู่ระหว่างออกแบบ"}
                    </div>
                  </div>
                </div>
                {side === "after" && snap.note ? (
                  <span
                    className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold ${
                      snap.highlight === "amber"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-mint-brandLight text-mint-brandDark"
                    }`}
                  >
                    {snap.note}
                  </span>
                ) : null}
              </div>
              <OwnershipBar slices={slices} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StructureView({
  plan,
  assets,
  members,
  entities,
}: StructureViewProps) {
  const snapshots = buildSnapshots(plan, assets, members, entities);

  const entitySnapshots = snapshots.filter((s) => s.kind === "entity");
  const controlBefore =
    entitySnapshots.length > 0
      ? sumGen(entitySnapshots[0].before, "รุ่นที่ 1")
      : 0;
  const controlAfter =
    entitySnapshots.length > 0
      ? sumGen(entitySnapshots[0].after, "รุ่นที่ 1")
      : 0;
  const controlDrop = controlBefore - controlAfter;
  const needsReview = controlAfter < 50 && controlBefore >= 50;

  const beforePeople = [
    {
      label: "คุณสมชาย",
      sub: members.find((m) => m.name === "คุณสมชาย")?.gen ?? "รุ่นที่ 1",
    },
  ];

  const afterNames = [
    ...new Set(
      plan.flatMap((p) => splitReceivers(p.receiver)),
    ),
  ];
  const afterPeople = afterNames.map((name) => ({
    label: name,
    sub: memberGen(members, name) ?? "ผู้รับ",
  }));

  const focusEntity = entitySnapshots[0];

  return (
    <div className="animate-[fadeUp_0.35s_ease-out]">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold tracking-wide text-mint-brand">
            การวางแผน
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            โครงสร้างก่อนและหลัง
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            แสดงผลของแผนต่อกรรมสิทธิ์และอำนาจควบคุม โดยไม่มองเฉพาะภาษี
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            กลับหน้าภาพรวม
          </Link>
          <Link
            href="/compare"
            className="inline-flex items-center gap-1.5 rounded-xl bg-mint-brand px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-mint-brandDark"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            เปรียบเทียบสถานการณ์
          </Link>
        </div>
      </div>

      {/* Insight strip */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:mb-8 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint-brandLight text-mint-brand">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">รายการในแผน</div>
            <div className="text-lg font-bold text-slate-900">
              {plan.length}{" "}
              <span className="text-sm font-medium text-slate-400">ธุรกรรม</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">ควบคุม G1 (ธุรกิจหลัก)</div>
            <div className="text-lg font-bold tabular-nums text-slate-900">
              {controlBefore.toFixed(0)}%
              <span className="mx-1.5 text-slate-300">→</span>
              <span className={needsReview ? "text-amber-600" : "text-mint-brandDark"}>
                {controlAfter.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${
              needsReview
                ? "bg-amber-50 text-amber-600"
                : "bg-mint-brandLight text-mint-brand"
            }`}
          >
            {needsReview ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <Users className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="text-[11px] text-slate-400">สถานะควบคุม</div>
            <div
              className={`text-lg font-bold ${
                needsReview ? "text-amber-600" : "text-mint-brandDark"
              }`}
            >
              {needsReview ? "ต้องทบทวน" : "ยังครองเสียงข้างมาก"}
            </div>
          </div>
        </div>
      </div>

      {plan.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <p className="text-sm text-slate-500">
            ยังไม่มีรายการในแผน — เพิ่มสถานการณ์เข้าแผนก่อนจึงจะเห็นโครงสร้างหลังโอน
          </p>
          <Link
            href="/assets?wizard=1"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-mint-brand"
          >
            สร้างสถานการณ์ <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <>
          {/* Before / After */}
          <div className="relative mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 lg:block">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-mint-brand shadow-md ring-1 ring-slate-100">
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>

            <DiagramPanel
              title="ก่อนดำเนินการ"
              badge="ปัจจุบัน"
              badgeTone="slate"
              people={beforePeople}
              snapshots={snapshots}
              side="before"
            />
            <DiagramPanel
              title="หลังดำเนินการตามแผน"
              badge="ตามแผน"
              badgeTone="mint"
              people={
                afterPeople.length > 0
                  ? afterPeople
                  : [{ label: "รุ่นที่ 2", sub: "ผู้รับตามแผน" }]
              }
              snapshots={snapshots}
              side="after"
            />
          </div>

          {/* Transition cards */}
          <div className="mb-8">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">เส้นทางการโอนกรรมสิทธิ์</h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  แต่ละรายการในแผนเปลี่ยนโครงสร้างอย่างไร
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {plan.map((item, index) => {
                const snap = snapshots[index];
                return (
                  <div
                    key={item.id ?? `${item.asset}-${item.year}-${item.method}-${index}`}
                    style={{ animationDelay: `${index * 50}ms` }}
                    className="animate-[fadeUp_0.4s_ease-out_both] rounded-2xl border border-slate-100 bg-white p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                        {item.method} · ปี {item.year}
                      </span>
                      <span className="text-[11px] font-semibold text-mint-brand">
                        โอน {item.share}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-slate-800">{item.owner}</span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                      <span className="font-semibold text-slate-800">{item.receiver}</span>
                    </div>
                    <p className="mt-2 truncate text-xs text-slate-500">
                      {snap?.name ?? item.asset}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Control impact */}
          {focusEntity ? (
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
              <div className="border-b border-slate-50 px-5 py-5 sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">ผลต่อการควบคุม</h2>
                    <p className="mt-0.5 text-xs text-slate-400">
                      สัดส่วนรุ่นที่ 1 ใน {focusEntity.name}
                    </p>
                  </div>
                  {needsReview ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      ต่ำกว่าเสียงข้างมาก
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-brandLight px-3 py-1 text-[11px] font-bold text-mint-brandDark">
                      <Sparkles className="h-3.5 w-3.5" />
                      ยังครองเสียงข้างมาก
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-3 sm:p-6">
                <ControlMeter percent={controlBefore} label="สัดส่วนรุ่นที่ 1 ก่อน" />
                <ControlMeter percent={controlAfter} label="หลังโอนตามแผน" />
                <div className="flex flex-col justify-center rounded-2xl bg-slate-50/80 p-4">
                  <div className="text-[11px] font-medium text-slate-400">การเปลี่ยนแปลง</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                    {controlDrop > 0 ? "−" : "+"}
                    {Math.abs(controlDrop).toFixed(0)}%
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    รุ่นที่ 1 ลดลง {controlDrop.toFixed(0)} จุดเปอร์เซ็นต์จากการโอนตามแผน
                  </p>
                </div>
              </div>

              {needsReview ? (
                <div className="mx-5 mb-5 rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3.5 sm:mx-6 sm:mb-6">
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm ring-1 ring-amber-100">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-amber-900">
                        ควรทบทวนกลไกควบคุม
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-amber-800/80">
                        หากต้องการให้รุ่นที่ 1 รักษาอำนาจควบคุมเกิน 50% แผนทยอยให้หุ้นปัจจุบันต้องปรับสัดส่วน
                        หรือใช้กลไกสิทธิออกเสียงประกอบ
                      </p>
                      <Link
                        href="/plan"
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 hover:text-amber-950"
                      >
                        กลับไปปรับแผน <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
