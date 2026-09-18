"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { Asset, Member, PlanItem, Scenario } from "@/data/wealth-transfer";
import { ReceiverList } from "@/components/wizard/ReceiverList";
import { addPlanItem, createScenario } from "@/lib/plans-db";
import {
  calculateScenario,
  type TransferMethod,
  type WizardReceiver,
} from "@/lib/scenario-store";
import { classifyReceiverRelation } from "@/lib/transfer-cost";
import { applyAggregatedPlanTaxes, type PlanTaxResult } from "@/lib/plan-tax";
import { assetEffectiveValue, money } from "@/lib/format";

type GroupPlanModalProps = {
  open: boolean;
  assets: Asset[];
  members: Member[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

const METHODS: TransferMethod[] = ["ให้", "ซื้อขาย", "มรดก"];

export function GroupPlanModal({
  open,
  assets,
  members,
  onClose,
  onSaved,
}: GroupPlanModalProps) {
  const [method, setMethod] = useState<TransferMethod>("ให้");
  const [year, setYear] = useState("2569");
  const [contractPrice, setContractPrice] = useState("");
  const [receivers, setReceivers] = useState<WizardReceiver[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PlanTaxResult | null>(null);

  const assessedTotal = useMemo(
    () =>
      assets.reduce(
        (s, a) => s + (assetEffectiveValue(a.assessed ?? a.value, a.share) ?? 0),
        0,
      ),
    [assets],
  );

  const options = members.map((m) => ({
    value: m.name,
    label: m.name,
    hint: [m.gen, m.relation].filter(Boolean).join(" · "),
  }));

  if (!open) return null;

  function namedReceivers() {
    return receivers.filter((r) => r.name.trim() && r.share > 0);
  }

  function buildDraft(named: WizardReceiver[]) {
    const contract = Number(contractPrice) || 0;
    const plan: PlanItem[] = [];
    const scenarios: Scenario[] = [];
    for (const [index, asset] of assets.entries()) {
      const assessed = assetEffectiveValue(asset.assessed ?? asset.value, asset.share) ?? 0;
      const allocated =
        method === "ซื้อขาย" && contract > 0 && assessedTotal > 0
          ? (contract * assessed) / assessedTotal
          : asset.value ?? assessed;
      const id = `draft-${asset.id}-${index}`;
      plan.push({
        id,
        asset: asset.name,
        assetId: asset.id,
        scenarioId: id,
        owner: asset.owner,
        receiver: named.map((r) => r.name).join(" + "),
        method,
        share: "100%",
        year,
        cost: 0,
        status: "ตัวอย่าง",
      });
      scenarios.push({
        id,
        asset: asset.name,
        assetId: asset.id,
        method,
        year,
        receiver: named.map((r) => r.name).join(" + "),
        tax: 0,
        fees: 0,
        total: 0,
        score: 0,
        status: "ตัวอย่าง",
        criteria: { taxEfficiency: 0, control: 0, liquidity: 0, readiness: 0 },
        transferShare: 100,
        marketValue: allocated,
        receivers: named.map((r) => ({
          name: r.name,
          share: r.share,
          taxClass: r.taxClass ?? classifyReceiverRelation(r.relation),
          relation: r.relation,
          occasion: r.occasion,
        })),
      } as Scenario);
    }
    return applyAggregatedPlanTaxes({ plan, assets, members, scenarios });
  }

  function handlePreview() {
    const named = namedReceivers();
    if (named.length === 0) {
      setError("เพิ่มผู้รับอย่างน้อย 1 คน");
      return;
    }
    setError(null);
    setPreview(buildDraft(named));
  }

  async function handleSave() {
    const named = namedReceivers();
    if (named.length === 0) {
      setError("เพิ่มผู้รับอย่างน้อย 1 คน");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const contract = Number(contractPrice) || 0;
      for (const asset of assets) {
        const assessed = assetEffectiveValue(asset.assessed ?? asset.value, asset.share) ?? 0;
        const allocated =
          method === "ซื้อขาย" && contract > 0 && assessedTotal > 0
            ? (contract * assessed) / assessedTotal
            : asset.value ?? assessed;
        const draft = calculateScenario({
          assetName: asset.name,
          assetId: asset.id,
          method,
          year,
          receivers: named.map((r) => ({
            ...r,
            taxClass: r.taxClass ?? classifyReceiverRelation(r.relation),
          })),
          transferShare: 100,
          marketValue: allocated,
          assessedValue: assessed,
          costBasis: asset.cost ?? 0,
          acquiredYear: asset.acquired,
          acquisitionMethod: asset.method,
          assetCategory: asset.type,
          assetSubtype: asset.subtype,
          ownerIsJuristic: asset.ownerKind === "นิติบุคคล",
        });
        const saved = await createScenario({
          assetId: asset.id,
          assetName: asset.name,
          method: draft.method,
          year: draft.year,
          transferShare: 100,
          marketValue: allocated,
          tax: draft.tax,
          fees: draft.fees,
          total: draft.total,
          score: draft.score,
          criteria: draft.criteria,
          receivers: named,
        });
        await addPlanItem({
          assetId: asset.id,
          assetName: asset.name,
          scenarioId: saved.id,
          owner: asset.owner,
          receiver: saved.receiver,
          method: saved.method,
          share: "100%",
          year: saved.year,
          cost: saved.total,
        });
      }
      await onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกกลุ่มไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="flex min-h-screen items-start justify-center px-3 py-8">
        <button type="button" className="fixed inset-0 bg-slate-900/40" aria-label="ปิด" onClick={onClose} />
        <div className="relative w-full max-w-3xl rounded-2xl border border-slate-100 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <h3 className="text-sm font-bold text-slate-800">
              เพิ่มเข้าแผนหลายรายการ ({assets.length})
            </h3>
            <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400" aria-label="ปิด">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-4 p-5">
            <p className="text-xs text-slate-500">
              คำนวณรายทรัพย์ก่อนรวมกลุ่ม อสังหาหลายโฉนดคิดค่าโอน WHT SBT แยกแปลง หากมีราคาสัญญารวม จะจัดสรรตามสัดส่วนราคาประเมิน
            </p>
            <ul className="max-h-28 overflow-auto rounded-xl border border-slate-100 px-3 py-2 text-xs text-slate-600">
              {assets.map((a) => (
                <li key={a.id} className="flex justify-between py-1">
                  <span>{a.name}</span>
                  <span className="tabular-nums">{money(assetEffectiveValue(a.assessed ?? a.value, a.share))}</span>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-xs font-semibold text-slate-500">
                วิธี
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as TransferMethod)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                >
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-500">
                ปี
                <input
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </label>
              <label className="text-xs font-semibold text-slate-500">
                ราคาสัญญารวม (ถ้ามี)
                <input
                  value={contractPrice}
                  onChange={(e) => setContractPrice(e.target.value)}
                  inputMode="numeric"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </label>
            </div>
            <ReceiverList
              receivers={receivers}
              members={members}
              options={options}
              transferShare={100}
              total={receivers.reduce((s, r) => s + r.share, 0)}
              onChange={(index, patch) =>
                setReceivers((rows) =>
                  rows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
                )
              }
              onAdd={() =>
                setReceivers((rows) => [
                  ...rows,
                  {
                    name: members[0]?.name ?? "",
                    share: rows.length === 0 ? 100 : 0,
                    relation: members[0]?.relation,
                    taxClass: classifyReceiverRelation(members[0]?.relation),
                  },
                ])
              }
              onRemove={(index) =>
                setReceivers((rows) => rows.filter((_, i) => i !== index))
              }
              onEqualize={() => {
                const n = receivers.length;
                if (!n) return;
                const each = +(100 / n).toFixed(3);
                setReceivers((rows) => rows.map((r) => ({ ...r, share: each })));
              }}
            />
            {preview ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                <p className="mb-2 font-semibold text-slate-700">
                  ตัวอย่างรายทรัพย์ · รวม {money(preview.breakdown.cashNeeded)} · สถานะ {preview.status}
                </p>
                <ul className="max-h-36 space-y-1 overflow-auto">
                  {preview.plan.map((item) => (
                    <li key={item.id ?? item.asset} className="flex justify-between gap-2">
                      <span>{item.asset}</span>
                      <span className="tabular-nums">{money(item.cost)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-slate-500">
                  ภาษีการให้ {money(preview.breakdown.giftTax)} · มรดก {money(preview.breakdown.inheritanceTax)} ·
                  ค่าโอน {money(preview.breakdown.transferFees)} · อากร {money(preview.breakdown.stampDuty)}
                </p>
              </div>
            ) : null}
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold">
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handlePreview}
                className="rounded-xl border border-mint-200 bg-white px-3.5 py-2 text-xs font-semibold text-mint-brandDark"
              >
                คำนวณตัวอย่าง
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSave()}
                className="rounded-xl bg-mint-brand px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {busy ? "กำลังบันทึก..." : "ยืนยันบันทึกเข้าแผน"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
