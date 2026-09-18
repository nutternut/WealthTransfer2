import { money } from "@/lib/format";
import type { GiftLedgerSummary, PlanCostBreakdown } from "@/lib/plan-tax";
import type { CalcStatus } from "@/lib/transfer-cost";

type PlanTaxBreakdownProps = {
  breakdown: PlanCostBreakdown;
  giftLedgers: GiftLedgerSummary[];
  status: CalcStatus;
  missingDataCount: number;
  reviewRequiredCount: number;
  warnings: string[];
};

const KIND_LABEL: Record<GiftLedgerSummary["kind"], string> = {
  related: "ให้สังหาริมทรัพย์ญาติ · 20 ลบ./ผู้รับ/ปี",
  customary: "ให้บุคคลอื่นตามเงื่อนไข · 10 ลบ./ผู้รับ/ปี",
  immovable: "ให้อสังหา ม.42(26) · 20 ลบ./บุตร/ปี",
};

export function PlanTaxBreakdown({
  breakdown,
  giftLedgers,
  status,
  missingDataCount,
  reviewRequiredCount,
  warnings,
}: PlanTaxBreakdownProps) {
  const rows = [
    ["ภาษีการให้", breakdown.giftTax],
    ["ภาษีมรดก", breakdown.inheritanceTax],
    ["PIT", breakdown.pit],
    ["CIT", breakdown.cit],
    ["SBT", breakdown.sbt],
    ["ค่าธรรมเนียมโอน", breakdown.transferFees],
    ["อากรแสตมป์", breakdown.stampDuty],
    ["ค่าใช้จ่ายอื่น", breakdown.other],
  ] as const;

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="border-b border-slate-50 px-5 py-4">
        <h2 className="text-sm font-bold text-slate-900">ผลรวมค่าใช้จ่ายตามประเภท</h2>
        <p className="mt-0.5 text-[11px] text-slate-400">
          สถานะ {status} · Missing Data {missingDataCount} · Review Required {reviewRequiredCount}
          · เครดิตภาษี {money(breakdown.taxCredits)} ไม่ถูกบวกซ้ำในยอดสุทธิ
        </p>
      </div>
      <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label} className="bg-white px-4 py-3">
            <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
              {label}
            </div>
            <div className="mt-1 text-sm font-bold tabular-nums text-slate-800">
              {money(value)}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-between gap-3 border-t border-slate-50 px-5 py-3 text-xs">
        <span className="text-slate-500">
          เงินสดที่ต้องเตรียม {money(breakdown.cashNeeded)}
        </span>
        <span className="font-semibold text-mint-brandDark">
          มูลค่าที่ส่งต่อ {money(breakdown.netToRecipients)}
        </span>
      </div>
      {giftLedgers.length > 0 ? (
        <div className="border-t border-slate-50 px-5 py-4">
          <h3 className="mb-2 text-xs font-bold text-slate-800">Tax Ledger การให้</h3>
          <table className="w-full text-left text-[11px]">
            <thead className="text-slate-400">
              <tr>
                <th className="py-1 pr-2">ฐาน</th>
                <th className="py-1 pr-2">ผู้เกี่ยวข้อง</th>
                <th className="py-1 pr-2">ปี</th>
                <th className="py-1 pr-2 text-right">ยอดสะสม</th>
                <th className="py-1 text-right">ภาษีส่วนเพิ่ม</th>
              </tr>
            </thead>
            <tbody>
              {giftLedgers.map((g) => (
                <tr key={g.key} className="border-t border-slate-50">
                  <td className="py-1.5 pr-2">{KIND_LABEL[g.kind]}</td>
                  <td className="py-1.5 pr-2">{g.party}</td>
                  <td className="py-1.5 pr-2">{g.taxYear}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{money(g.total)}</td>
                  <td className="py-1.5 text-right tabular-nums">{money(g.tax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <ul className="space-y-1 border-t border-amber-100 bg-amber-50/60 px-5 py-3 text-[11px] text-amber-800">
          {warnings.slice(0, 8).map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
