"use client";

import { Equal, Plus, Trash2 } from "lucide-react";
import type { Member } from "@/data/wealth-transfer";
import { Autocomplete, type AutocompleteOption } from "@/components/ui/Autocomplete";
import { RECEIVER_RELATIONS } from "@/data/asset-taxonomy";
import type { WizardReceiver } from "@/lib/scenario-store";
import { classifyReceiverRelation, toReceiverRelation } from "@/lib/transfer-cost";

type ReceiverListProps = {
  receivers: WizardReceiver[];
  members: Member[];
  options: AutocompleteOption[];
  transferShare: number;
  total: number;
  error?: string;
  onChange: (index: number, patch: Partial<WizardReceiver>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onEqualize: () => void;
};

export function ReceiverList({
  receivers,
  members,
  options,
  transferShare,
  total,
  error,
  onChange,
  onAdd,
  onRemove,
  onEqualize,
}: ReceiverListProps) {
  const over = total > 100;
  const remaining = Math.round((100 - total) * 1000) / 1000;

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">รายชื่อผู้รับ</h2>
          <p className="text-[11px] text-slate-400">
            จากส่วนที่ส่งต่อ {transferShare}% · ให้ไม่หมดได้
          </p>
        </div>
        {receivers.length > 0 ? (
          <div
            className={`text-right text-sm font-semibold tabular-nums ${
              over ? "text-red-600" : "text-slate-700"
            }`}
          >
            รวม {total}%
            <div
              className={`text-[10px] font-medium ${
                over ? "text-red-600" : "text-slate-400"
              }`}
            >
              {over
                ? `เกิน ${Number(Math.abs(remaining).toFixed(3))}%`
                : remaining > 0
                  ? `เหลือ ${Number(remaining.toFixed(3))}% (เก็บไว้ได้)`
                  : "ครบ 100%"}
            </div>
          </div>
        ) : null}
      </div>

      {receivers.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-slate-400">
          ยังไม่มีผู้รับ — กดเพิ่มผู้รับเพื่อเลือกจากสมาชิกหรือพิมพ์ชื่อคนนอก
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-400">
                <th className="w-10 px-3 py-2">#</th>
                <th className="px-3 py-2">ผู้รับ</th>
                <th className="px-3 py-2">ความสัมพันธ์</th>
                <th className="w-28 px-3 py-2 text-right">สัดส่วน %</th>
                <th className="w-12 px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {receivers.map((r, i) => {
                const m = members.find((x) => x.name === r.name);
                const relationValue = toReceiverRelation(
                  r.relation ?? m?.relation,
                );
                return (
                  <tr key={`${r.name}-${i}`} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2 tabular-nums text-slate-400">
                      {i + 1}
                    </td>
                    <td className="px-3 py-2">
                      <Autocomplete
                        id={`wz-receiver-${i}`}
                        value={r.name}
                        options={options}
                        onChange={(name) => onChange(i, { name })}
                        placeholder="ค้นหาหรือพิมพ์ชื่อผู้รับ..."
                        allowFreeform
                        freeformHint="คนนอก · พิมพ์เอง"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={relationValue}
                        onChange={(e) => {
                          const relation = e.target.value;
                          onChange(i, {
                            relation,
                            taxClass: classifyReceiverRelation(relation),
                            occasion:
                              classifyReceiverRelation(relation) === "คนอื่น"
                                ? r.occasion
                                : undefined,
                          });
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700"
                      >
                        {RECEIVER_RELATIONS.map((rel) => (
                          <option key={rel} value={rel}>
                            {rel}
                          </option>
                        ))}
                      </select>
                      {classifyReceiverRelation(relationValue) === "คนอื่น" ? (
                        <label className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                          <input
                            type="checkbox"
                            checked={r.occasion === "customary"}
                            onChange={(e) =>
                              onChange(i, {
                                occasion: e.target.checked ? "customary" : "none",
                              })
                            }
                          />
                          ธรรมจรรยา/พิธี/ประเพณี
                        </label>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.001"
                          value={r.share}
                          onChange={(e) =>
                            onChange(i, {
                              share: Math.min(
                                100,
                                Math.max(0, Number(e.target.value) || 0),
                              ),
                            })
                          }
                          aria-label={`สัดส่วนผู้รับ ${r.name || i + 1}`}
                          className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-xs tabular-nums text-slate-700 focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none"
                        />
                        <span className="text-slate-400">%</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => onRemove(i)}
                        aria-label={`ลบผู้รับ ${r.name || i + 1}`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-2.5">
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 rounded-lg bg-mint-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-mint-brandDark"
        >
          <Plus className="h-3.5 w-3.5" />
          เพิ่มผู้รับ
        </button>
        <button
          type="button"
          onClick={onEqualize}
          disabled={receivers.length < 2}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
        >
          <Equal className="h-3.5 w-3.5" />
          แบ่งเท่ากัน
        </button>
        {(over || error) && (
          <p className="w-full text-[11px] text-red-600 sm:ml-auto sm:w-auto">
            {error ?? "สัดส่วนผู้รับรวมต้องไม่เกิน 100%"}
          </p>
        )}
      </div>
    </section>
  );
}
