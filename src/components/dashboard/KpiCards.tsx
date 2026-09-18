import { moneyCompact } from "@/lib/format";

type Kpi = {
  label: string;
  value: string;
  sub: string;
  subTone?: "up" | "warn" | "muted";
};

type KpiCardsProps = {
  totalValue: number;
  plannedValue: number;
  plannedCost: number;
  unplannedCount: number;
  assetCount: number;
};

export function KpiCards({
  totalValue,
  plannedValue,
  plannedCost,
  unplannedCount,
  assetCount,
}: KpiCardsProps) {
  const plannedPct = totalValue ? ((plannedValue / totalValue) * 100).toFixed(1) : "0";
  const costPct = plannedValue ? ((plannedCost / plannedValue) * 100).toFixed(1) : "0";

  const items: Kpi[] = [
    {
      label: "มูลค่าทรัพย์สินรวม",
      value: moneyCompact(totalValue),
      sub: `ข้อมูล ${assetCount} รายการ`,
      subTone: "up",
    },
    {
      label: "ทรัพย์สินอยู่ในแผน",
      value: moneyCompact(plannedValue),
      sub: `${plannedPct}% ของมูลค่ารวม`,
      subTone: "muted",
    },
    {
      label: "ค่าใช้จ่ายตามแผน",
      value: moneyCompact(plannedCost),
      sub: `${costPct}% ของมูลค่าที่วางแผน`,
      subTone: "muted",
    },
    {
      label: "ยังไม่ได้วางแผน",
      value: `${unplannedCount} รายการ`,
      sub: "ควรพิจารณาเพิ่มเติม",
      subTone: "warn",
    },
  ];

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-slate-100 bg-white p-5"
        >
          <div className="text-xs text-slate-400">{item.label}</div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {item.value}
          </div>
          <div
            className={`mt-1.5 text-xs ${
              item.subTone === "up"
                ? "text-mint-brand"
                : item.subTone === "warn"
                  ? "text-amber-600"
                  : "text-slate-400"
            }`}
          >
            {item.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
