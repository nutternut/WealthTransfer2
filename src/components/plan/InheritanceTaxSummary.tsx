import { Landmark } from "lucide-react";
import { money } from "@/lib/format";
import {
  INHERIT_EXEMPT,
  type ReceiverInheritanceTaxSummary,
} from "@/lib/transfer-cost";

type InheritanceTaxSummaryProps = {
  rows: ReceiverInheritanceTaxSummary[];
  className?: string;
};

export function InheritanceTaxSummary({
  rows,
  className = "",
}: InheritanceTaxSummaryProps) {
  if (rows.length === 0) return null;

  const totalTax = rows.reduce((s, r) => s + r.tax, 0);
  const hasTaxable = rows.some((r) => r.taxable > 0);

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-violet-100 bg-linear-to-r from-violet-50/80 via-white to-white shadow-sm shadow-violet-100/40 ${className}`}
    >
      <div className="flex gap-3 px-5 py-4 sm:px-6">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
          <Landmark className="h-5 w-5" />
        </div>
        <div className="flex items-center">
          <h2 className="text-sm font-bold text-slate-900">
            ภาษีรับมรดก — รวมต่อผู้รับและเจ้ามรดก
          </h2>
        </div>
      </div>
      <div className="border-t border-violet-100/80 px-5 pb-4 sm:px-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-lg text-left text-xs">
            <thead>
              <tr className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                <th className="py-2 pr-3 font-semibold">ผู้รับ</th>
                <th className="py-2 pr-3 font-semibold">เจ้ามรดก</th>
                <th className="py-2 pr-3 text-right font-semibold">มรดกรวม</th>
                <th className="py-2 pr-3 text-right font-semibold">ส่วนเกิน</th>
                <th className="py-2 text-right font-semibold">ภาษี</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-violet-50">
              {rows.map((row, index) => (
                <tr key={`${row.name}::${row.decedentId ?? ""}::${index}`}>
                  <td className="py-2.5 pr-3 font-semibold text-slate-800">
                    {row.name}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-600">
                    {row.decedentId || "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700">
                    {money(row.totalReceived)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700">
                    {money(row.taxable)}
                  </td>
                  <td
                    className={`py-2.5 text-right font-semibold tabular-nums ${
                      row.tax > 0 ? "text-violet-700" : "text-slate-400"
                    }`}
                  >
                    {money(row.tax)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!hasTaxable ? (
          <p className="mt-2 text-[11px] text-slate-400">
            ยังไม่มีผู้รับที่มรดกรวมเกิน {INHERIT_EXEMPT / 1e6} ลบ. — ไม่มีภาษีรับมรดก
          </p>
        ) : null}
        <div className="mt-3 flex justify-end">
          <div className="rounded-xl bg-white px-3.5 py-2.5 text-right ring-1 ring-violet-100">
            <div className="text-[10px] font-medium text-violet-600/80">
              ภาษีมรดกรวม
            </div>
            <div className="text-lg font-bold tabular-nums text-slate-900">
              {money(totalTax)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
