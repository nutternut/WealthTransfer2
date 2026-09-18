import type { ShareSlice } from "@/lib/dashboard-metrics";

type OwnerConcentrationProps = {
  shares: ShareSlice[];
};

export function OwnerConcentration({ shares }: OwnerConcentrationProps) {
  const ranked = [...shares].sort((a, b) => b.percent - a.percent);

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 lg:col-span-2">
      <div>
        <h2 className="mb-1 text-lg font-bold text-slate-900">
          ผู้ถือกรรมสิทธิ์
        </h2>
        <p className="mb-8 text-xs text-slate-400">
          สัดส่วนมูลค่าตามผู้ถือกรรมสิทธิ์ของครอบครัว
        </p>
        {ranked.length === 0 ? (
          <p className="text-sm text-slate-400">ยังไม่มีข้อมูล</p>
        ) : (
          <div className="space-y-8">
            {ranked.map((g, i) => (
              <div key={g.label}>
                <div className="mb-2 flex justify-between text-xs text-slate-600">
                  <span>{g.label}</span>
                  <b className="text-slate-900">{g.percent}%</b>
                </div>
                <div className="h-2.5 overflow-hidden rounded-lg bg-slate-100">
                  <div
                    className="h-full rounded-lg"
                    style={{
                      width: `${Math.min(100, g.percent)}%`,
                      backgroundColor: i === 0 ? "#1B3A5C" : "#3A5F8A",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
