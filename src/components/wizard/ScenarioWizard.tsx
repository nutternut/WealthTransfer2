"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  Sparkles,
  UserRound,
  Wallet,
} from "lucide-react";
import type { Asset, Member, Scenario } from "@/data/wealth-transfer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Autocomplete } from "@/components/ui/Autocomplete";
import { WizardStepper } from "@/components/wizard/WizardStepper";
import { AssetSnapshot } from "@/components/wizard/AssetSnapshot";
import { MethodPicker, formatMethodYear } from "@/components/wizard/MethodPicker";
import { ReceiverList } from "@/components/wizard/ReceiverList";
import { SharePicker } from "@/components/wizard/SharePicker";
import { money } from "@/lib/format";
import { addPlanItem, createScenario, fetchLatestScenarioForAsset } from "@/lib/plans-db";
import { fetchAssets, patchAssetTaxFacts } from "@/lib/assets-db";
import { fetchMembers } from "@/lib/members-db";
import {
  calculateScenario,
  type TransferMethod,
  type WizardAssumptions,
  type WizardReceiver,
} from "@/lib/scenario-store";
import {
  calculateTransferCosts,
  classifyReceiverRelation,
  parseGiftDurationYears,
  toReceiverRelation,
} from "@/lib/transfer-cost";

const inputClass =
  "w-full rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-xs text-slate-700 shadow-sm transition-all focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none";

const labelClass = "mb-1.5 block text-xs font-semibold text-slate-500";

const TRANSFER_METHODS: TransferMethod[] = [
  "ให้",
  "ซื้อขาย",
  "มรดก",
  "โอนเข้าบริษัท",
  "ทยอยให้",
  "วิธีผสม",
];

function parseStoredYearLabel(label: string): {
  year: string;
  durationYears?: number;
} {
  const durationMatch = /^(\d{4})\s*\((\d+)\s*ปี\)/.exec(label.trim());
  if (durationMatch) {
    return {
      year: durationMatch[1]!,
      durationYears: Number(durationMatch[2]),
    };
  }
  const yearMatch = /(\d{4})/.exec(label);
  if (yearMatch) return { year: yearMatch[1]! };
  return { year: "2569" };
}

function assumptionsFromAsset(a: Asset): WizardAssumptions {
  const assessed = a.assessed ?? 0;
  return {
    // ถ้าไม่มีราคาตลาด ใช้ราคาประเมินเป็นฐานแสดงมูลค่าที่ส่งต่อ
    market: a.value ?? assessed,
    assessed,
    cost: a.cost ?? 0,
    acquired: a.acquired && a.acquired !== "-" ? a.acquired : "",
    method: a.method,
  };
}

function defaultReceivers(): WizardReceiver[] {
  return [];
}

function memberHint(m: Member | undefined): string | undefined {
  if (!m) return undefined;
  const parts = [m.gen, m.relation].filter((p) => p?.trim());
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

type ScenarioWizardProps = {
  initialAssetId?: string;
  assets?: Asset[];
  members?: Member[];
  /** When set (e.g. modal), cancel / finish closes instead of navigating away */
  onClose?: (reason?: "cancel" | "saved") => void;
};

type Phase = 1 | 2 | 3 | 4 | "result";

export function ScenarioWizard({
  initialAssetId,
  assets: assetsProp,
  members: membersProp,
  onClose,
}: ScenarioWizardProps) {
  const [assets, setAssets] = useState<Asset[]>(assetsProp ?? []);
  const [members, setMembers] = useState<Member[]>(membersProp ?? []);
  const [catalogLoading, setCatalogLoading] = useState(
    !assetsProp || !membersProp,
  );
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const preferred =
    (assetsProp ?? assets).find((a) => a.id === initialAssetId) ??
    (assetsProp ?? assets)[0];

  const [phase, setPhase] = useState<Phase>(initialAssetId ? 2 : 1);
  const [assetId, setAssetId] = useState(initialAssetId ?? preferred?.id ?? "");
  const [owner, setOwner] = useState(preferred?.owner ?? "");
  const [share, setShare] = useState(Math.min(100, preferred?.share ?? 100));
  const [receivers, setReceivers] = useState<WizardReceiver[]>(() =>
    defaultReceivers(),
  );
  const [method, setMethod] = useState<TransferMethod>("ให้");
  const [year, setYear] = useState("2569");
  const [salePrice, setSalePrice] = useState(preferred?.value ?? 0);
  const [durationYears, setDurationYears] = useState(3);
  const [assumptions, setAssumptions] = useState<WizardAssumptions>(() =>
    preferred
      ? assumptionsFromAsset(preferred)
      : {
          market: 0,
          assessed: 0,
          cost: 0,
          acquired: "",
          method: "ซื้อ",
        },
  );
  const [receiverError, setReceiverError] = useState("");
  const [result, setResult] = useState<Scenario | null>(null);
  const [savedToPlan, setSavedToPlan] = useState(false);
  const [syncedQuery, setSyncedQuery] = useState<string | undefined>();
  /** กัน hydrate ซ้ำต่อ asset และไม่ทับเมื่อผู้ใช้แก้เองแล้ว */
  const hydratedAssetRef = useRef<string | null>(null);
  const receiversTouchedRef = useRef(false);

  useEffect(() => {
    if (assetsProp) setAssets(assetsProp);
  }, [assetsProp]);

  useEffect(() => {
    if (membersProp) setMembers(membersProp);
  }, [membersProp]);

  useEffect(() => {
    if (assetsProp && membersProp) {
      setCatalogLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setCatalogLoading(true);
        setCatalogError(null);
        const [assetList, memberList] = await Promise.all([
          assetsProp ? Promise.resolve(assetsProp) : fetchAssets(),
          membersProp ? Promise.resolve(membersProp) : fetchMembers(),
        ]);
        if (cancelled) return;
        if (!assetsProp) setAssets(assetList);
        if (!membersProp) setMembers(memberList);
        if (!initialAssetId && assetList[0]) {
          setAssetId((prev) => prev || assetList[0]!.id);
          setOwner((prev) => prev || assetList[0]!.owner);
          setShare((prev) => prev || Math.min(100, assetList[0]!.share));
          setSalePrice((prev) => prev || (assetList[0]!.value ?? 0));
          setAssumptions((prev) =>
            prev.market || prev.assessed || prev.cost
              ? prev
              : assumptionsFromAsset(assetList[0]!),
          );
        }
      } catch (e) {
        if (!cancelled) {
          setCatalogError(
            e instanceof Error
              ? e.message
              : "โหลดข้อมูลสำหรับวางแผนไม่สำเร็จ",
          );
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assetsProp, membersProp, initialAssetId]);

  // ดึงสถานการณ์เก่าของทรัพย์มาเติมผู้รับ/วิธีโอน (ถ้ามี)
  useEffect(() => {
    if (!assetId || catalogLoading) return;
    if (hydratedAssetRef.current === assetId) return;

    let cancelled = false;
    (async () => {
      try {
        const prior = await fetchLatestScenarioForAsset(assetId);
        if (cancelled) return;
        hydratedAssetRef.current = assetId;
        if (!prior) return;

        if (
          !receiversTouchedRef.current &&
          Array.isArray(prior.receivers) &&
          prior.receivers.length > 0
        ) {
          setReceivers(
            prior.receivers.map((r) => {
              const m =
                members.find((x) => x.name === r.name) ??
                (r.memberId
                  ? members.find((x) => x.id === r.memberId)
                  : undefined);
              const relation = toReceiverRelation(r.relation ?? m?.relation);
              return {
                name: r.name,
                share: Number(r.share) || 0,
                memberId: r.memberId ?? m?.id,
                relation,
                taxClass: classifyReceiverRelation(r.taxClass ?? relation),
                occasion: r.occasion,
              };
            }),
          );
        }

        if (
          prior.method &&
          TRANSFER_METHODS.includes(prior.method as TransferMethod)
        ) {
          setMethod(prior.method as TransferMethod);
        }

        if (prior.year) {
          const parsed = parseStoredYearLabel(prior.year);
          setYear(parsed.year);
          if (parsed.durationYears != null && parsed.durationYears > 0) {
            setDurationYears(parsed.durationYears);
          }
        }

        if (prior.transferShare != null && prior.transferShare > 0) {
          setShare(Math.min(100, prior.transferShare));
        }

        if (
          prior.method === "ซื้อขาย" &&
          prior.marketValue != null &&
          prior.marketValue > 0
        ) {
          setSalePrice(prior.marketValue);
        }
      } catch {
        // ไม่บล็อก wizard ถ้าโหลดสถานการณ์เก่าไม่ได้
        if (!cancelled) hydratedAssetRef.current = assetId;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assetId, catalogLoading, members]);

  const asset = useMemo(
    () => assets.find((a) => a.id === assetId) ?? assets[0],
    [assets, assetId],
  );

  const assetLocked = Boolean(initialAssetId);

  if (initialAssetId && initialAssetId !== syncedQuery && assets.length > 0) {
    const next = assets.find((a) => a.id === initialAssetId);
    if (next) {
      setSyncedQuery(initialAssetId);
      setAssetId(next.id);
      setOwner(next.owner);
      setShare(Math.min(100, next.share));
      setSalePrice(next.value ?? 0);
      setAssumptions(assumptionsFromAsset(next));
    }
  }

  const receiverCandidates = useMemo(() => {
    const others = members.filter((m) => m.name !== owner);
    return others.length > 0 ? others : members;
  }, [members, owner]);

  const ownerOptions = useMemo(() => {
    const names = new Set<string>([
      asset?.owner ?? "",
      ...members.map((m) => m.name),
    ]);
    return [...names]
      .filter(Boolean)
      .map((name) => {
        const m = members.find((x) => x.name === name);
        return {
          value: name,
          label: name,
          hint: memberHint(m),
        };
      });
  }, [asset?.owner, members]);

  const receiverOptions = useMemo(
    () =>
      receiverCandidates.map((m) => ({
        value: m.name,
        label: m.name,
        hint: memberHint(m),
      })),
    [receiverCandidates],
  );

  const receiverTotal = receivers.reduce((s, r) => s + Number(r.share || 0), 0);
  /** รวมที่ปัดทศนิยม — 33.333×3 = 99.999 → ถือเป็น 100 */
  const receiverTotalDisplay =
    Math.abs(100 - receiverTotal) < 0.01
      ? 100
      : Math.round(receiverTotal * 1000) / 1000;
  const transferValue = asset
    ? (((method === "ซื้อขาย"
        ? salePrice || assumptions.market || assumptions.assessed
        : assumptions.market || assumptions.assessed) *
        share) /
      100)
    : 0;

  function selectAsset(id: string) {
    const next = assets.find((a) => a.id === id);
    if (!next) return;
    setAssetId(next.id);
    setOwner(next.owner);
    setShare(Math.min(share, next.share) || next.share);
    setSalePrice(next.value ?? 0);
    setAssumptions(assumptionsFromAsset(next));
    // เปลี่ยนทรัพย์ → โหลดผู้รับของทรัพย์นั้นใหม่
    hydratedAssetRef.current = null;
    receiversTouchedRef.current = false;
    setReceivers(defaultReceivers());
  }

  function updateReceiver(index: number, patch: Partial<WizardReceiver>) {
    receiversTouchedRef.current = true;
    setReceivers((rows) =>
      rows.map((r, i) => {
        if (i !== index) return r;
        const next = { ...r, ...patch };
        if (patch.name != null && patch.name !== r.name && patch.relation == null) {
          const m = members.find((x) => x.name === patch.name);
          next.memberId = m?.id;
          next.relation = toReceiverRelation(m?.relation);
          next.taxClass = classifyReceiverRelation(next.relation);
        }
        return next;
      }),
    );
    setReceiverError("");
  }

  function addReceiver() {
    receiversTouchedRef.current = true;
    const fallback =
      receiverCandidates.find(
        (m) => !receivers.some((r) => r.name === m.name),
      ) ?? null;
    setReceivers((rows) => [
      ...rows,
      {
        name: fallback?.name ?? "",
        share: rows.length === 0 ? 100 : 0,
        memberId: fallback?.id,
        relation: toReceiverRelation(fallback?.relation),
        taxClass: classifyReceiverRelation(
          toReceiverRelation(fallback?.relation),
        ),
      },
    ]);
  }

  function receiversForTax(list: WizardReceiver[]): WizardReceiver[] {
    return list
      .filter((r) => r.name.trim())
      .map((r) => {
        const m = members.find((x) => x.name === r.name);
        const relation = toReceiverRelation(r.relation ?? m?.relation);
        return {
          ...r,
          relation,
          taxClass: r.taxClass ?? classifyReceiverRelation(relation),
        };
      });
  }

  function ownerIsJuristic(): boolean {
    const entry = asset?.owners?.find((o) => o.owner === owner);
    const kind = entry?.ownerKind ?? asset?.ownerKind;
    return kind === "นิติบุคคล";
  }

  function removeReceiver(index?: number) {
    receiversTouchedRef.current = true;
    if (typeof index === "number") {
      setReceivers((rows) => rows.filter((_, i) => i !== index));
      return;
    }
    setReceivers((rows) => rows.slice(0, -1));
  }

  function equalizeReceivers() {
    receiversTouchedRef.current = true;
    const n = receivers.length;
    if (n === 0) return;
    // แบ่งเท่ากัน เช่น 3 คน → คนละ 33.333 (แสดงรวมเป็น 100%)
    const each = +(100 / n).toFixed(3);
    setReceivers((rows) => rows.map((r) => ({ ...r, share: each })));
    setReceiverError("");
  }

  function goReceiversNext() {
    const named = receivers.filter((r) => r.name.trim());
    if (named.length === 0) {
      setReceiverError("เพิ่มผู้รับอย่างน้อย 1 คน");
      return;
    }
    if (receivers.some((r) => !r.name.trim())) {
      setReceiverError("กรอกชื่อผู้รับให้ครบทุกแถว");
      return;
    }
    if (receiverTotalDisplay <= 0) {
      setReceiverError("กำหนดสัดส่วนผู้รับอย่างน้อย 1%");
      return;
    }
    if (receiverTotalDisplay > 100) {
      setReceiverError("สัดส่วนผู้รับรวมต้องไม่เกิน 100%");
      return;
    }
    setReceiverError("");
    setPhase(3);
  }

  function buildDraft(): Scenario | null {
    if (!asset) return null;
    const scenarioYear = formatMethodYear(method, year, durationYears);
    const marketValue =
      method === "ซื้อขาย"
        ? salePrice || assumptions.market || assumptions.assessed
        : assumptions.market || assumptions.assessed;
    const activeReceivers = receiversForTax(receivers);
    return calculateScenario({
      assetName: asset.name,
      assetId: asset.id,
      method,
      year: scenarioYear,
      receivers: activeReceivers,
      transferShare: share,
      marketValue,
      assessedValue: assumptions.assessed,
      costBasis: assumptions.cost,
      acquiredYear: assumptions.acquired,
      acquisitionMethod: assumptions.method,
      assetCategory: asset.type,
      assetSubtype: asset.subtype,
      ownerIsJuristic: ownerIsJuristic(),
      giftDurationYears:
        method === "ให้" || method === "ทยอยให้" ? durationYears : 1,
      id: "preview",
    });
  }

  function runPreview() {
    const draft = buildDraft();
    if (!draft) return;
    setSaveError(null);
    setSavedToPlan(false);
    setResult(draft);
    setPhase("result");
  }

  async function runCalculate() {
    if (!asset) return;
    setSaving(true);
    setSaveError(null);
    try {
      const scenarioYear = formatMethodYear(method, year, durationYears);
      const marketValue =
        method === "ซื้อขาย"
          ? salePrice || assumptions.market || assumptions.assessed
          : assumptions.market || assumptions.assessed;
      const activeReceivers = receiversForTax(receivers);

      // บันทึกสมมติฐานกลับไปที่ทรัพย์สิน (ปีที่ได้มา / วิธีได้มา / ราคา)
      try {
        await patchAssetTaxFacts(asset.id, {
          acquired: assumptions.acquired,
          method: assumptions.method,
          assessed: assumptions.assessed,
          cost: assumptions.cost,
          value: assumptions.market,
        });
        const acquiredSaved =
          assumptions.acquired.trim() && assumptions.acquired !== "-"
            ? assumptions.acquired.trim()
            : "-";
        setAssets((list) =>
          list.map((a) =>
            a.id === asset.id
              ? {
                  ...a,
                  acquired: acquiredSaved,
                  method: assumptions.method || a.method,
                  assessed: assumptions.assessed,
                  cost: assumptions.cost,
                  value: assumptions.market,
                }
              : a,
          ),
        );
      } catch (e) {
        throw e instanceof Error
          ? e
          : new Error("บันทึกปีที่ได้มาไม่สำเร็จ");
      }

      const draft = calculateScenario({
        assetName: asset.name,
        assetId: asset.id,
        method,
        year: scenarioYear,
        receivers: activeReceivers,
        transferShare: share,
        marketValue,
        assessedValue: assumptions.assessed,
        costBasis: assumptions.cost,
        acquiredYear: assumptions.acquired,
        acquisitionMethod: assumptions.method,
        assetCategory: asset.type,
        assetSubtype: asset.subtype,
        ownerIsJuristic: ownerIsJuristic(),
        giftDurationYears:
          method === "ให้" || method === "ทยอยให้" ? durationYears : 1,
        id: "pending",
      });
      const saved = await createScenario({
        assetId: asset.id,
        assetName: asset.name,
        method: draft.method,
        year: draft.year,
        transferShare: share,
        marketValue,
        tax: draft.tax,
        fees: draft.fees,
        total: draft.total,
        score: draft.score,
        status: draft.status,
        criteria: draft.criteria,
        receivers: activeReceivers,
      });
      await addPlanItem({
        assetId: asset.id,
        assetName: asset.name,
        scenarioId: saved.id,
        owner: owner || asset.owner,
        receiver: saved.receiver,
        method: saved.method,
        share: `${share}%`,
        year: saved.year,
        cost: saved.total,
        status: "เลือกเข้าสู่แผนแล้ว",
      });
      setAssets((prev) =>
        prev.map((a) =>
          a.id === asset.id ? { ...a, status: "มีแผนแล้ว" } : a,
        ),
      );
      setResult(saved);
      setSavedToPlan(true);
      setPhase("result");
    } catch (e) {
      setSaveError(
        e instanceof Error ? e.message : "บันทึกสถานการณ์ไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  }

  if (catalogLoading) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center text-sm text-slate-400">
        กำลังโหลดข้อมูลสำหรับวางแผน...
      </div>
    );
  }

  if (catalogError) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center text-sm text-red-700">
        {catalogError}
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
        ไม่พบทรัพย์สินสำหรับวางแผน — เพิ่มทรัพย์สินก่อน
      </div>
    );
  }

  if (phase === "result" && result) {
    const resultMarket =
      result.marketValue ||
      (result.method === "ซื้อขาย"
        ? salePrice || assumptions.market || assumptions.assessed
        : assumptions.market || assumptions.assessed);
    return (
      <ResultView
        scenario={result}
        share={result.transferShare ?? share}
        marketValue={resultMarket}
        assessedValue={assumptions.assessed}
        costBasis={assumptions.cost}
        acquiredYear={assumptions.acquired}
        acquisitionMethod={assumptions.method}
        assetCategory={asset.type}
        assetSubtype={asset.subtype}
        ownerIsJuristic={ownerIsJuristic()}
        receivers={receiversForTax(
          result.receivers?.map((r) => ({
            name: r.name,
            share: r.share,
            relation:
              toReceiverRelation(
                (r as { relation?: string }).relation ??
                  members.find((m) => m.name === r.name)?.relation,
              ),
            occasion: (r as { occasion?: "customary" | "none" }).occasion,
          })) ?? receivers,
        )}
        error={saveError}
        savedToPlan={savedToPlan}
        saving={saving}
        onConfirmSave={() => void runCalculate()}
        onBack={() => setPhase(4)}
      />
    );
  }

  return (
    <div className="relative">
      <WizardStepper
        current={phase as number}
        skipAssetStep={assetLocked}
      />

      {assetLocked && asset ? (
        <div className="mb-5">
          <AssetSnapshot asset={asset} compact />
        </div>
      ) : null}

      <div
        key={phase}
        className="animate-[fadeUp_0.35s_ease]"
      >
        {phase === 1 && (
          <div
            className={
              assetLocked
                ? "grid grid-cols-1 gap-5"
                : "grid grid-cols-1 gap-5 lg:grid-cols-5"
            }
          >
            {!assetLocked && (
              <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-3 sm:p-6">
                <SectionTitle
                  icon={Wallet}
                  title="เลือกทรัพย์สิน"
                  sub="คลิกการ์ดเพื่อเลือกทรัพย์สินที่ต้องการวางแผน"
                />
                <div className="mt-4 grid max-h-[22rem] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                  {assets.map((a) => {
                    const selected = a.id === assetId;
                    const planned = a.status.includes("มีแผน");
                    const planning = a.status.includes("ระหว่าง");
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => selectAsset(a.id)}
                        className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200 ${
                          selected
                            ? "border-mint-brand bg-linear-to-br from-mint-brandLight via-mint-100/80 to-mint-50 shadow-md shadow-mint-brand/15 ring-2 ring-mint-brand/25"
                            : "border-slate-100 bg-white hover:-translate-y-0.5 hover:border-mint-200 hover:shadow-sm"
                        }`}
                      >
                        <span
                          className={`absolute inset-x-0 top-0 h-1 ${
                            selected
                              ? "bg-linear-to-r from-mint-brand to-mint-400"
                              : planned
                                ? "bg-mint-300/80"
                                : planning
                                  ? "bg-amber-300/80"
                                  : "bg-slate-200"
                          }`}
                          aria-hidden
                        />
                        {selected && (
                          <span className="absolute top-3 right-3 grid h-5 w-5 place-items-center rounded-full bg-mint-brand text-white shadow-sm shadow-mint-brand/30">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        )}
                        <div
                          className={`text-[10px] font-semibold tracking-wide uppercase ${
                            selected ? "text-mint-brandDark/70" : "text-slate-400"
                          }`}
                        >
                          {a.id}
                        </div>
                        <div className="mt-1 pr-6 text-sm font-bold text-slate-900">
                          {a.name}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-xs text-slate-500">{a.type}</span>
                          <span
                            className={`text-xs font-bold ${
                              selected ? "text-mint-brandDark" : "text-slate-700"
                            }`}
                          >
                            {money(a.value)}
                          </span>
                        </div>
                        <div className="mt-3">
                          <StatusBadge status={a.status} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            <section
              className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6 ${
                assetLocked ? "max-w-2xl" : "lg:col-span-2"
              }`}
            >
              <SectionTitle
                icon={UserRound}
                title="ส่วนของผู้โอน"
                sub="กำหนดเจ้าของและสัดส่วนที่ส่งต่อ"
              />

              <div className="mt-4">
                <label className={labelClass} htmlFor="wz-owner">
                  เจ้าของ / ผู้โอน
                </label>
                <Autocomplete
                  id="wz-owner"
                  value={owner}
                  options={ownerOptions}
                  onChange={setOwner}
                  placeholder="ค้นหาชื่อผู้โอน..."
                />
              </div>

              <SharePicker
                value={Math.min(share, asset.share)}
                max={asset.share}
                transferValueLabel={money(transferValue)}
                assetValue={assumptions.market}
                onChange={setShare}
              />

              <AssetSnapshot asset={asset} />

              <Notice>
                ระบบจะตรวจไม่ให้สัดส่วนรายการในแผนรวมกันเกินกรรมสิทธิ์ที่เจ้าของมี
              </Notice>
            </section>
          </div>
        )}

        {phase === 2 && (
          <ReceiverList
            receivers={receivers}
            members={members}
            options={receiverOptions}
            transferShare={share}
            total={receiverTotalDisplay}
            error={receiverError}
            onChange={updateReceiver}
            onAdd={addReceiver}
            onRemove={removeReceiver}
            onEqualize={equalizeReceivers}
          />
        )}

        {phase === 3 && (
          <MethodPicker
            method={method}
            year={year}
            durationYears={durationYears}
            salePrice={salePrice}
            onMethodChange={setMethod}
            onYearChange={setYear}
            onDurationYearsChange={setDurationYears}
            onSalePriceChange={setSalePrice}
          />
        )}

        {phase === 4 && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
              <SectionTitle
                icon={Banknote}
                title="สมมติฐานรายการ"
                sub="ปรับฐานราคาและวิธีได้มาก่อนคำนวณ"
              />
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="ราคาตลาด (บาท)" htmlFor="as-market">
                  <input
                    id="as-market"
                    type="number"
                    step="0.1"
                    className={inputClass}
                    value={assumptions.market}
                    onChange={(e) =>
                      setAssumptions((a) => ({
                        ...a,
                        market: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </Field>
                <Field label="ราคาประเมิน/มูลค่าอ้างอิง (บาท)" htmlFor="as-assessed">
                  <input
                    id="as-assessed"
                    type="number"
                    step="0.1"
                    className={inputClass}
                    value={assumptions.assessed}
                    onChange={(e) =>
                      setAssumptions((a) => ({
                        ...a,
                        assessed: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </Field>
                <Field label="ราคาทุน (บาท)" htmlFor="as-cost">
                  <input
                    id="as-cost"
                    type="number"
                    step="0.1"
                    className={inputClass}
                    value={assumptions.cost}
                    onChange={(e) =>
                      setAssumptions((a) => ({
                        ...a,
                        cost: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </Field>
                <Field label="ปีที่ได้มา" htmlFor="as-acquired">
                  <input
                    id="as-acquired"
                    className={inputClass}
                    value={
                      assumptions.acquired === "-"
                        ? ""
                        : assumptions.acquired
                    }
                    placeholder="พ.ศ. เช่น 2545"
                    onChange={(e) =>
                      setAssumptions((a) => ({
                        ...a,
                        acquired: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="วิธีได้มา" htmlFor="as-method">
                  <select
                    id="as-method"
                    className={inputClass}
                    value={assumptions.method}
                    onChange={(e) =>
                      setAssumptions((a) => ({ ...a, method: e.target.value }))
                    }
                  >
                    {[assumptions.method, "ซื้อ", "ให้", "มรดก"]
                      .filter((v, i, arr) => arr.indexOf(v) === i)
                      .map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                  </select>
                </Field>
              </div>
            </section>

            <section className="relative overflow-hidden rounded-2xl border border-mint-100 bg-gradient-to-br from-mint-brandLight via-white to-white p-5 shadow-sm sm:p-6">
              <div
                className="pointer-events-none absolute -top-10 -right-8 h-32 w-32 rounded-full bg-mint-brand/10 blur-2xl"
                aria-hidden
              />
              <SectionTitle
                icon={Sparkles}
                title="สรุปสถานการณ์"
                sub="ตรวจสอบก่อนกดคำนวณ"
              />
              <div className="relative mt-4 space-y-3 text-xs">
                <SummaryRow label="ทรัพย์สิน" value={asset.name} />
                <SummaryRow label="ผู้โอน" value={owner} />
                <SummaryRow label="สัดส่วน" value={`${share}%`} />
                <SummaryRow
                  label="ผู้รับ"
                  value={receivers.map((r) => r.name).join(", ")}
                />
                <SummaryRow label="วิธี" value={method} />
                <SummaryRow
                  label={method === "มรดก" ? "ช่วงเวลา" : method === "ซื้อขาย" ? "ปีที่ขาย" : "ช่วงเวลา"}
                  value={formatMethodYear(method, year, durationYears)}
                />
                {method === "ซื้อขาย" && (
                  <SummaryRow label="ราคาขาย" value={money(salePrice)} />
                )}
                <SummaryRow label="มูลค่าที่ส่งต่อ" value={money(transferValue)} />
              </div>
            </section>
          </div>
        )}
      </div>

      <StickyActions>
        {phase === 1 ? (
          <>
            {onClose ? (
              <button
                type="button"
                onClick={() => onClose("cancel")}
                className={btnSecondary}
              >
                ยกเลิก
              </button>
            ) : (
              <Link href="/assets" className={btnSecondary}>
                ยกเลิก
              </Link>
            )}
            <button type="button" onClick={() => setPhase(2)} className={btnPrimary}>
              ถัดไป: เลือกผู้รับ
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </>
        ) : null}
        {phase === 2 ? (
          <>
            {assetLocked ? (
              onClose ? (
                <button
                  type="button"
                  onClick={() => onClose("cancel")}
                  className={btnSecondary}
                >
                  ยกเลิก
                </button>
              ) : (
                <Link href="/assets" className={btnSecondary}>
                  ยกเลิก
                </Link>
              )
            ) : (
              <button type="button" onClick={() => setPhase(1)} className={btnSecondary}>
                <ArrowLeft className="h-3.5 w-3.5" />
                ย้อนกลับ
              </button>
            )}
            <button type="button" onClick={goReceiversNext} className={btnPrimary}>
              ถัดไป: วิธีและเวลา
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </>
        ) : null}
        {phase === 3 ? (
          <>
            <button type="button" onClick={() => setPhase(2)} className={btnSecondary}>
              <ArrowLeft className="h-3.5 w-3.5" />
              ย้อนกลับ
            </button>
            <button type="button" onClick={() => setPhase(4)} className={btnPrimary}>
              ถัดไป: สมมติฐาน
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </>
        ) : null}
        {phase === 4 ? (
          <>
            <button
              type="button"
              onClick={() => setPhase(3)}
              disabled={saving}
              className={btnSecondary}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              ย้อนกลับ
            </button>
            <button
              type="button"
              onClick={runPreview}
              disabled={saving}
              className={`${btnPrimary} disabled:opacity-60`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              คำนวณตัวอย่าง
            </button>
          </>
        ) : null}
      </StickyActions>
      {saveError ? (
        <p className="mt-3 text-center text-xs font-medium text-red-600">
          {saveError}
        </p>
      ) : null}
    </div>
  );
}

const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-xl bg-mint-brand px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-mint-brand/20 transition hover:bg-mint-brandDark";

const btnSecondary =
  "inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50";

function ResultView({
  scenario,
  share,
  marketValue,
  assessedValue,
  costBasis,
  acquiredYear,
  acquisitionMethod,
  assetCategory,
  assetSubtype,
  ownerIsJuristic,
  receivers,
  error,
  savedToPlan = false,
  saving = false,
  onConfirmSave,
  onBack,
}: {
  scenario: Scenario;
  share: number;
  marketValue: number;
  assessedValue: number;
  costBasis: number;
  acquiredYear: string;
  acquisitionMethod?: string;
  assetCategory?: string;
  assetSubtype?: string;
  ownerIsJuristic?: boolean;
  receivers?: WizardReceiver[];
  error?: string | null;
  savedToPlan?: boolean;
  saving?: boolean;
  onConfirmSave?: () => void;
  onBack?: () => void;
}) {
  const baseValue = marketValue || assessedValue;
  const transferValue = (baseValue * share) / 100;
  const breakdown = calculateTransferCosts({
    method: scenario.method as TransferMethod,
    transferValue,
    assessedValue: ((assessedValue || marketValue) * share) / 100,
    costBasis: (costBasis * share) / 100,
    acquiredYear,
    transactionYear: scenario.year,
    acquisitionMethod,
    assetCategory,
    assetSubtype,
    assetName: scenario.asset,
    ownerIsJuristic,
    giftDurationYears: parseGiftDurationYears(scenario.year) ?? 1,
    receivers: (receivers ?? scenario.receivers ?? []).map((r) => ({
      name: r.name,
      share: r.share,
      taxClass: classifyReceiverRelation(
        ("taxClass" in r && r.taxClass) ||
          ("relation" in r ? r.relation : undefined),
      ),
      occasion: "occasion" in r ? r.occasion : undefined,
    })),
  });
  const comps = breakdown.lines;
  const maxComp = Math.max(...comps.map((l) => l.amount), 0.01);
  const costPct =
    transferValue > 0
      ? ((breakdown.total / transferValue) * 100).toFixed(2)
      : null;

  return (
    <div className="animate-[fadeUp_0.4s_ease]">
      <header className="relative mb-6 overflow-hidden rounded-3xl border border-mint-100 bg-gradient-to-br from-mint-brand via-mint-brandDark to-slate-900 p-6 text-white sm:p-8">
        <div
          className="pointer-events-none absolute -top-10 right-0 h-56 w-56 rounded-full bg-white/10 blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold backdrop-blur">
            <Check className="h-3.5 w-3.5" />
            คำนวณสำเร็จ · {savedToPlan ? `บันทึกเข้าแผนแล้ว · ${scenario.id}` : "ตัวอย่าง — ยังไม่บันทึกเข้าแผน"}
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            ผลคำนวณค่าธรรมเนียมและภาษีอากร
          </h1>
          <p className="mt-2 text-sm text-white/75">
            {scenario.asset} · {scenario.method} · ปี {scenario.year}
          </p>
        </div>
      </header>
      {error ? (
        <p className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "มูลค่าที่ส่งต่อ",
            value: money(transferValue),
            tone: "default" as const,
          },
          {
            label: "ภาษีและอากร",
            value: money(breakdown.tax),
            tone: "default" as const,
          },
          {
            label: "ค่าธรรมเนียม",
            value: money(breakdown.fees),
            tone: "default" as const,
          },
          {
            label: "รวมภาษี+ค่าธรรมเนียม",
            value: money(breakdown.total),
            sub:
              costPct != null
                ? `${costPct}% ของมูลค่าที่ส่งต่อ`
                : "ยังไม่มีฐานมูลค่าที่ส่งต่อ",
            tone: "accent" as const,
          },
        ].map((k) => (
          <div
            key={k.label}
            className={`rounded-2xl border p-5 shadow-sm ${
              k.tone === "accent"
                ? "border-mint-200 bg-gradient-to-br from-mint-brandLight to-white"
                : "border-slate-100 bg-white"
            }`}
          >
            <div className="text-xs text-slate-400">{k.label}</div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {k.value}
            </div>
            {"sub" in k && k.sub ? (
              <div className="mt-1.5 text-xs font-medium text-mint-brandDark">
                {k.sub}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <section className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-4 text-base font-bold text-slate-900">
          รายละเอียดค่าธรรมเนียมและภาษีอากร
        </h2>
        <div className="space-y-4">
          {comps.length === 0 ? (
            <p className="text-xs text-slate-400">
              ไม่มีภาระค่าธรรมเนียมหรือภาษีตามสมมติฐานนี้
            </p>
          ) : (
            comps.map((line) => (
              <div key={line.label}>
                <div className="mb-1.5 flex justify-between gap-3 text-xs">
                  <span className="text-slate-500">
                    {line.label}
                    {line.note ? (
                      <span className="mt-0.5 block text-[10px] text-slate-400">
                        {line.note}
                      </span>
                    ) : null}
                  </span>
                  <b className="shrink-0 tabular-nums text-slate-800">
                    {money(line.amount)}
                  </b>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-mint-brand to-mint-400 transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (line.amount / maxComp) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))
          )}
          <div className="flex justify-between gap-4 border-t border-slate-100 pt-4 text-sm font-bold text-slate-900">
            <span>รวม (ไม่รวมเครดิต)</span>
            <span className="tabular-nums text-mint-brandDark">
              {money(breakdown.total)}
            </span>
          </div>
          {breakdown.credits > 0 ? (
            <p className="text-[11px] text-slate-500">
              เครดิตภาษี {money(breakdown.credits)} — ไม่บวกซ้ำในยอดสุทธิ
            </p>
          ) : null}
          <p className="text-[11px] text-slate-400">สถานะผลคำนวณ: {breakdown.status}</p>
          {breakdown.warnings.length > 0 ? (
            <ul className="space-y-1 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              {breakdown.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-2 text-base font-bold text-slate-900">คำอธิบาย</h2>
        <p className="text-sm leading-relaxed text-slate-600">
          ตัวเลขเป็นประมาณการค่าธรรมเนียม ภาษี และอากรตามวิธีโอนที่เลือก
          เพื่อใช้เปรียบเทียบแผน — ค่าใช้จ่ายจริงขึ้นกับเอกสารและกฎที่มีผล ณ
          วันทำรายการ
        </p>
          <div className="mt-4">
            {!savedToPlan ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={onBack} className={btnSecondary}>
                  ย้อนกลับ
                </button>
                <button
                  type="button"
                  onClick={onConfirmSave}
                  disabled={saving}
                  className={`${btnPrimary} disabled:opacity-60`}
                >
                  {saving ? "กำลังบันทึก..." : "ยืนยันบันทึกเข้าแผน"}
                </button>
              </div>
            ) : (
              <Link href="/timeline" className={btnSecondary}>
                ไป Wealth Transfer Plan
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
      </section>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  sub,
}: {
  icon: typeof Sparkles;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mint-brandLight text-mint-brand">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
      </div>
    </div>
  );
}

function Notice({
  children,
  tone = "warn",
}: {
  children: React.ReactNode;
  tone?: "warn" | "error";
}) {
  return (
    <p
      className={`mt-4 rounded-xl border px-3.5 py-3 text-xs leading-relaxed ${
        tone === "error"
          ? "border-red-100 bg-red-50 text-red-700"
          : "border-amber-100/80 bg-amber-50/90 text-amber-800"
      }`}
    >
      {children}
    </p>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-50 pb-3 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <b className="text-right text-slate-800">{value}</b>
    </div>
  );
}

function StickyActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
        {children}
      </div>
    </div>
  );
}
