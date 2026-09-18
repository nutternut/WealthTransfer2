"use client";

import { useEffect, useMemo, useState } from "react";
import type { Asset, Member, PlanItem, Scenario } from "@/data/wealth-transfer";
import { PlanView } from "@/components/plan/PlanView";
import { fetchAssets } from "@/lib/assets-db";
import { fetchMembers } from "@/lib/members-db";
import { fetchPlanItems, fetchScenarios } from "@/lib/plans-db";
import { applyAggregatedPlanTaxes, type PriorLedgerSeed, type YearCostBreakdown } from "@/lib/plan-tax";
import { fetchTaxLedgers } from "@/lib/tax-ledgers-db";

function yearlyCostsFromEstimates(estimates: YearCostBreakdown[]) {
  const max = Math.max(...estimates.map((item) => item.total), 1);
  return estimates.map((item) => ({
    year: item.year,
    amount: item.total,
    percent: Math.round((item.total / max) * 100),
  }));
}

export default function PlanPage() {
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [priorLedgers, setPriorLedgers] = useState<PriorLedgerSeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [planItems, assetList, memberList, scenarioList, ledgers] =
          await Promise.all([
            fetchPlanItems(),
            fetchAssets(),
            fetchMembers(),
            fetchScenarios().catch(() => [] as Scenario[]),
            fetchTaxLedgers(),
          ]);
        if (cancelled) return;
        setPlan(planItems);
        setAssets(assetList);
        setMembers(memberList);
        setScenarios(scenarioList);
        setPriorLedgers(ledgers);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "โหลดแผนจากฐานข้อมูลไม่สำเร็จ",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const planTax = useMemo(
    () =>
      applyAggregatedPlanTaxes({
        plan,
        assets,
        members,
        scenarios,
        priorLedgers,
      }),
    [plan, assets, members, scenarios, priorLedgers],
  );

  const yearlyCosts = useMemo(
    () => yearlyCostsFromEstimates(planTax.yearEstimates),
    [planTax.yearEstimates],
  );

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center text-sm text-slate-400">
        กำลังโหลดแผนการส่งต่อ...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-sm text-red-700">
        <p className="font-semibold">โหลดแผนไม่สำเร็จ</p>
        <p className="mt-1 text-xs">{error}</p>
        <p className="mt-3 text-xs text-red-600/80">
          ตรวจว่าได้รัน <code>supabase/sql/wealth_plans.sql</code> ใน Supabase แล้ว
        </p>
      </div>
    );
  }

  return (
    <PlanView
      plan={planTax.plan}
      assets={assets}
      members={members}
      yearlyCosts={yearlyCosts}
      inheritanceByReceiver={planTax.inheritanceByReceiver}
      giftLedgers={planTax.giftLedgers}
      breakdown={planTax.breakdown}
      calcStatus={planTax.status}
      missingDataCount={planTax.missingDataCount}
      reviewRequiredCount={planTax.reviewRequiredCount}
      warnings={planTax.warnings}
      itemLines={Object.fromEntries(planTax.itemLines)}
    />
  );
}
