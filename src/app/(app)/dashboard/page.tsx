"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Asset, Member, PlanItem, Scenario } from "@/data/wealth-transfer";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { AssetTypeChart } from "@/components/dashboard/AssetTypeChart";
import { PriorityAssetsTable } from "@/components/dashboard/PriorityAssetsTable";
import { OwnerConcentration } from "@/components/dashboard/OwnerConcentration";
import { fetchAssets } from "@/lib/assets-db";
import { fetchMembers } from "@/lib/members-db";
import { fetchPlanItems, fetchScenarios } from "@/lib/plans-db";
import { applyAggregatedInheritanceTaxToPlan } from "@/lib/plan-inheritance-tax";
import {
  computeAssetTypeShares,
  computeOwnerShares,
  plannedAssetValue,
  plannedPlanCost,
  priorityAssets,
  totalAssetValue,
} from "@/lib/dashboard-metrics";

export default function DashboardPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [assetList, planItems, memberList, scenarioList] =
          await Promise.all([
            fetchAssets(),
            fetchPlanItems().catch(() => [] as PlanItem[]),
            fetchMembers().catch(() => [] as Member[]),
            fetchScenarios().catch(() => [] as Scenario[]),
          ]);
        if (cancelled) return;
        setAssets(assetList);
        setPlan(planItems);
        setMembers(memberList);
        setScenarios(scenarioList);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "โหลดข้อมูลภาพรวมจากฐานข้อมูลไม่สำเร็จ",
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

  const adjustedPlan = useMemo(
    () =>
      applyAggregatedInheritanceTaxToPlan({
        plan,
        assets,
        members,
        scenarios,
      }).plan,
    [plan, assets, members, scenarios],
  );

  const totalValue = useMemo(() => totalAssetValue(assets), [assets]);
  const plannedValue = useMemo(() => plannedAssetValue(assets), [assets]);
  const plannedCost = useMemo(() => plannedPlanCost(adjustedPlan), [adjustedPlan]);
  const unplannedCount = useMemo(
    () => assets.filter((a) => a.status === "ยังไม่ได้วางแผน").length,
    [assets],
  );
  const typeShares = useMemo(() => computeAssetTypeShares(assets), [assets]);
  const ownerShares = useMemo(() => computeOwnerShares(assets), [assets]);
  const priority = useMemo(() => priorityAssets(assets), [assets]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center text-sm text-slate-400">
        กำลังโหลดภาพรวมทรัพย์สิน...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-sm text-red-700">
        <p className="font-semibold">โหลดภาพรวมไม่สำเร็จ</p>
        <p className="mt-1 text-xs">{error}</p>
        <p className="mt-3 text-xs text-red-600/80">
          ตรวจการเชื่อมต่อ Supabase และว่าได้รัน SQL ของทรัพย์สิน / แผนแล้ว
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            ภาพรวมทรัพย์สินครอบครัว
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            มองภาพรวมความมั่งคั่ง สัดส่วนการถือครอง และความพร้อมในการส่งต่อ
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/assets"
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            ดูทรัพย์สินทั้งหมด
          </Link>
        </div>
      </div>

      <KpiCards
        totalValue={totalValue}
        plannedValue={plannedValue}
        plannedCost={plannedCost}
        unplannedCount={unplannedCount}
        assetCount={assets.length}
      />

      <div className="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <OwnerConcentration shares={ownerShares} />
        <AssetTypeChart shares={typeShares} />
      </div>

      <PriorityAssetsTable assets={priority} />
    </>
  );
}
