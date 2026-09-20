"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Asset, Member, PlanItem, Scenario } from "@/data/wealth-transfer";
import { TimelineView } from "@/components/timeline/TimelineView";
import { fetchAssets } from "@/lib/assets-db";
import { fetchMembers } from "@/lib/members-db";
import { fetchPlanItems, fetchScenarios } from "@/lib/plans-db";
import { applyAggregatedPlanTaxes, type PriorLedgerSeed } from "@/lib/plan-tax";
import { fetchTaxLedgers } from "@/lib/tax-ledgers-db";
import { buildPlanRecommendations } from "@/lib/plan-recommendations";
import { buildTimelineSchedule } from "@/lib/timeline-from-plan";

export default function TimelinePage() {
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
            fetchMembers().catch(() => [] as Member[]),
            fetchScenarios(),
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

  const schedule = useMemo(
    () =>
      buildTimelineSchedule(
        planTax.plan,
        assets,
        planTax.yearEstimates.map((y) => ({ year: y.year, amount: y.total })),
      ),
    [planTax.plan, planTax.yearEstimates, assets],
  );
  const recommendations = useMemo(
    () =>
      buildPlanRecommendations(
        planTax.plan,
        assets,
        schedule,
        scenarios,
      ),
    [planTax.plan, assets, schedule, scenarios],
  );

  let body;
  if (loading) {
    body = (
      <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center text-sm text-slate-400">
        กำลังโหลดลำดับการดำเนินการ...
      </div>
    );
  } else if (error) {
    body = (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-sm text-red-700">
        <p className="font-semibold">โหลด timeline ไม่สำเร็จ</p>
        <p className="mt-1 text-xs">{error}</p>
        <p className="mt-3 text-xs text-red-600/80">
          ตรวจว่าได้รัน <code>supabase/sql/wealth_plans.sql</code> ใน Supabase แล้ว
        </p>
      </div>
    );
  } else if (schedule.length === 0) {
    body = (
      <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center">
        <p className="text-sm font-semibold text-slate-800">ยังไม่มีรายการในแผน</p>
        <p className="mt-2 text-xs text-slate-500">
          สร้างสถานการณ์จากหน้าทรัพย์สินแล้วเลือกเข้าสู่แผน เพื่อแสดงลำดับปีที่นี่
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/assets"
            className="rounded-xl bg-mint-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-mint-brandDark"
          >
            ไปหน้าทรัพย์สิน
          </Link>
          <Link
            href="/plan"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            ดูหน้าแผน
          </Link>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="pb-20">
        <TimelineView
          schedule={schedule}
          recommendations={recommendations}
          yearEstimates={planTax.yearEstimates}
        />
      </div>
    );
  }

  return body;
}
