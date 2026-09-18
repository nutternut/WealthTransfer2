"use client";

import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import type { ShareSlice } from "@/lib/dashboard-metrics";

ChartJS.register(ArcElement, Tooltip, Legend);

type AssetTypeChartProps = {
  shares: ShareSlice[];
};

export function AssetTypeChart({ shares }: AssetTypeChartProps) {
  if (shares.length === 0) {
    return (
      <div className="flex flex-col justify-center rounded-2xl border border-slate-100 bg-white p-6">
        <h2 className="mb-1 text-lg font-bold text-slate-900">
          สัดส่วนประเภททรัพย์สิน
        </h2>
        <p className="text-xs text-slate-400">ยังไม่มีข้อมูลมูลค่าทรัพย์สิน</p>
      </div>
    );
  }

  const data = {
    labels: shares.map((s) => s.label),
    datasets: [
      {
        data: shares.map((s) => s.percent),
        backgroundColor: shares.map((s) => s.color ?? "#94A3B8"),
        borderWidth: 0,
        hoverOffset: 6,
      },
    ],
  };

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6">
      <div>
        <h2 className="mb-1 text-lg font-bold text-slate-900">
          สัดส่วนประเภททรัพย์สิน
        </h2>
        <p className="mb-6 text-xs text-slate-400">แบ่งตามประเภทมูลค่าครอบครัว</p>
        <div className="relative flex h-56 items-center justify-center">
          <Doughnut
            data={data}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              cutout: "68%",
              plugins: {
                legend: { display: false },
                tooltip: {
                  backgroundColor: "#1E293B",
                  padding: 10,
                  cornerRadius: 8,
                  callbacks: {
                    label: (ctx) => ` ${ctx.label}: ${ctx.parsed}%`,
                  },
                },
              },
            }}
          />
        </div>
      </div>

      <div
        className={`mt-4 grid gap-3 border-t border-slate-50 pt-4 ${
          shares.length <= 2
            ? "grid-cols-2"
            : shares.length === 3
              ? "grid-cols-3"
              : "grid-cols-2 sm:grid-cols-4"
        }`}
      >
        {shares.map((s) => (
          <div key={s.label} className="text-center">
            <div className="mb-1 flex items-center justify-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color ?? "#94A3B8" }}
              />
              <span className="text-[10px] font-medium text-slate-400">
                {s.label}
              </span>
            </div>
            <div className="text-sm font-semibold text-slate-800">
              {s.percent}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
