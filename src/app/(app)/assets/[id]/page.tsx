"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Asset } from "@/data/wealth-transfer";
import { scenarios } from "@/data/wealth-transfer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { displayTypeLabel } from "@/data/asset-taxonomy";
import { money } from "@/lib/format";
import { fetchAssetById } from "@/lib/assets-db";

function rowsForAsset(asset: Asset): [string, string][] {
  const base: [string, string][] = [
    ["ประเภท", displayTypeLabel(asset.type, asset.subtype)],
  ];
  if (asset.owners && asset.owners.length > 1) {
    base.push([
      "กรรมสิทธิ์ร่วม",
      asset.owners
        .map((o) => `${o.owner} (${o.share}%)`)
        .join(", "),
    ]);
  } else {
    base.push(["ผู้ถือกรรมสิทธิ์", asset.owner]);
    if (asset.ownerKind) base.push(["ประเภทผู้ถือ", asset.ownerKind]);
    base.push(["สัดส่วนถือครอง", `${asset.share}%`]);
  }
  if (asset.detail) base.push(["รายละเอียด", asset.detail]);
  base.push(["วิธีได้มา", asset.method]);
  if (asset.acquired && asset.acquired !== "-") {
    base.push(["ปีที่ถือครอง", `พ.ศ. ${asset.acquired}`]);
  }
  if (asset.transferYear) base.push(["ปีที่โอน", `พ.ศ. ${asset.transferYear}`]);
  base.push(["บทบาท", asset.role]);
  if (asset.intendedReceiver) {
    base.push(["ผู้รับโอน (ที่ระบุ)", asset.intendedReceiver]);
  }

  if (asset.type === "อสังหาริมทรัพย์") {
    if (asset.area) base.push(["เนื้อที่ (ไร่-งาน-ตร.ว.)", asset.area]);
    if (asset.assessedPerSqWa != null) {
      base.push([
        "ราคาประเมินต่อตร.ว.",
        money(asset.assessedPerSqWa),
      ]);
    }
  }

  if (asset.type === "หุ้นส่วนบริษัท") {
    if (asset.registeredCapital != null) {
      base.push(["ทุนจดทะเบียน", money(asset.registeredCapital)]);
    }
    if (asset.parValue != null) {
      base.push(["มูลค่าหุ้น (พาร์)", money(asset.parValue)]);
    }
    if (asset.bookValue != null) {
      base.push(["มูลค่าหุ้น (Book Value)", money(asset.bookValue)]);
    }
  }

  return base;
}

function kpiForAsset(asset: Asset) {
  if (asset.type === "อสังหาริมทรัพย์") {
    return [
      { label: "ราคาซื้อขาย", value: money(asset.value), sub: "ราคาตลาด" },
      { label: "ราคาประเมิน", value: money(asset.assessed), sub: "ฐานอ้างอิง" },
      {
        label: "ต้นทุนเดิม",
        value: money(asset.cost),
        sub: asset.acquired !== "-" ? `ได้มา พ.ศ. ${asset.acquired}` : "—",
      },
    ];
  }
  if (asset.type === "หุ้นส่วนบริษัท") {
    return [
      { label: "มูลค่าตลาด", value: money(asset.value), sub: "ราคาตลาด" },
      {
        label: "Book Value",
        value: money(asset.bookValue ?? asset.assessed),
        sub: "มูลค่าตามบัญชี",
      },
      {
        label: "ต้นทุน",
        value: money(asset.cost),
        sub: asset.acquired !== "-" ? `ได้มา พ.ศ. ${asset.acquired}` : "—",
      },
    ];
  }
  return [
    { label: "มูลค่า", value: money(asset.value), sub: "มูลค่าปัจจุบัน" },
    { label: "มูลค่าอ้างอิง", value: money(asset.assessed), sub: "ฐานอ้างอิง" },
    {
      label: "ต้นทุน",
      value: money(asset.cost),
      sub: asset.acquired !== "-" ? `ได้มา พ.ศ. ${asset.acquired}` : "—",
    },
  ];
}

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  const [asset, setAsset] = useState<Asset | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const row = await fetchAssetById(params.id);
        if (!cancelled) setAsset(row);
      } catch (e) {
        if (!cancelled) {
          setAsset(null);
          setError(
            e instanceof Error
              ? e.message
              : "โหลดทรัพย์สินจากฐานข้อมูลไม่สำเร็จ",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (asset === undefined) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-400">
        กำลังโหลด...
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center">
        <h1 className="text-xl font-bold text-slate-900">ไม่พบทรัพย์สิน</h1>
        {error ? (
          <p className="mt-2 text-xs text-red-600">{error}</p>
        ) : null}
        <Link
          href="/assets"
          className="mt-6 inline-flex rounded-xl bg-mint-brandLight px-4 py-2 text-xs font-semibold text-mint-brand"
        >
          กลับรายการ
        </Link>
      </div>
    );
  }

  const related = scenarios.filter((s) => s.asset === asset.name);
  const progress = asset.status.includes("มีแผน")
    ? 100
    : asset.status.includes("ระหว่าง")
      ? 55
      : 15;
  const infoRows = rowsForAsset(asset);
  const kpis = kpiForAsset(asset);

  return (
    <>
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {asset.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {asset.id} · {displayTypeLabel(asset.type, asset.subtype)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/assets"
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            กลับรายการ
          </Link>
          <Link
            href={`/assets?asset=${asset.id}`}
            className="rounded-xl bg-mint-brand px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-mint-brandDark"
          >
            วางแผนการส่งต่อ
          </Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-slate-100 bg-white p-5">
            <div className="text-xs text-slate-400">{k.label}</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{k.value}</div>
            <div className="mt-1.5 text-xs text-slate-400">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-6">
          <h2 className="mb-4 text-base font-bold text-slate-900">
            ข้อมูลกรรมสิทธิ์และรายละเอียด
          </h2>
          <div className="space-y-3 text-xs">
            {infoRows.map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between gap-4 border-b border-slate-50 pb-3 last:border-0"
              >
                <span className="shrink-0 text-slate-500">{label}</span>
                <b className="text-right text-slate-800">{value}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-6">
          <h2 className="mb-4 text-base font-bold text-slate-900">สถานะการวางแผน</h2>
          <StatusBadge status={asset.status} />
          <div className="mt-4 h-2 overflow-hidden rounded-lg bg-slate-100">
            <div
              className="h-full rounded-lg bg-mint-brand"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            สามารถสร้างหลายสถานการณ์และเลือกเข้าสู่แผนภายหลังได้
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-6">
        <h2 className="mb-4 text-base font-bold text-slate-900">สถานการณ์ที่เกี่ยวข้อง</h2>
        {related.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-400">ยังไม่มีสถานการณ์</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] text-slate-400 uppercase">
                  <th className="py-2 pr-4">สถานการณ์</th>
                  <th className="py-2 pr-4">วิธี</th>
                  <th className="py-2 pr-4">ปี</th>
                  <th className="py-2 pr-4 text-right">ค่าใช้จ่ายรวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {related.map((s) => (
                  <tr key={s.id}>
                    <td className="py-3 pr-4 font-semibold text-slate-800">{s.id}</td>
                    <td className="py-3 pr-4 text-slate-600">{s.method}</td>
                    <td className="py-3 pr-4 text-slate-600">{s.year}</td>
                    <td className="py-3 text-right font-medium tabular-nums">
                      {money(s.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
