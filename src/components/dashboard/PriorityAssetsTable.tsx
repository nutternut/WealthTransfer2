import Link from "next/link";
import type { Asset } from "@/data/wealth-transfer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { assetEffectiveDisplayValue, money } from "@/lib/format";

type PriorityAssetsTableProps = {
  assets: Asset[];
};

export function PriorityAssetsTable({ assets }: PriorityAssetsTableProps) {
  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-slate-100 bg-white">
      <div className="border-b border-slate-50 p-6">
        <h2 className="text-lg font-bold text-slate-900">
          ทรัพย์สินที่ควรเริ่มวางแผน
        </h2>
        <p className="mt-0.5 text-xs text-slate-400">
          รายการที่ยังไม่ได้วางแผนหรืออยู่ระหว่างดำเนินการ
        </p>
      </div>

      {assets.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-slate-400">
          ไม่มีรายการที่ต้องวางแผนเพิ่ม — หรือยังไม่มีทรัพย์สินในระบบ
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                <th className="px-6 py-3">ลำดับ</th>
                <th className="px-6 py-3">ทรัพย์สิน</th>
                <th className="px-6 py-3">ผู้ถือกรรมสิทธิ์</th>
                <th className="px-6 py-3">ประเภท</th>
                <th className="px-6 py-3 text-right">มูลค่า</th>
                <th className="px-6 py-3 text-center">สถานะ</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs">
              {assets.map((a, index) => (
                <tr
                  key={a.id}
                  className="transition-colors duration-150 hover:bg-slate-50/50"
                >
                  <td className="px-6 py-4 text-slate-500">{index + 1}</td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-800">{a.name}</div>
                    <div className="text-[10px] text-slate-400">{a.role}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {a.owners && a.owners.length > 1
                      ? a.owners.map((o) => o.owner).join(", ")
                      : a.owner}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{a.type}</td>
                  <td className="px-6 py-4 text-right font-medium text-slate-800 tabular-nums">
                    {money(assetEffectiveDisplayValue(a))}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/assets?asset=${a.id}`}
                      className="rounded-lg bg-mint-brandLight px-2.5 py-1.5 text-[11px] font-semibold text-mint-brand transition hover:bg-mint-100"
                    >
                      วางแผน
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
