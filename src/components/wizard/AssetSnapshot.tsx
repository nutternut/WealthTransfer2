"use client";

import type { LucideIcon } from "lucide-react";
import { Building2, Layers, Tag, TrendingUp, UserRound, Wallet } from "lucide-react";
import type { Asset } from "@/data/wealth-transfer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { money } from "@/lib/format";

function typeIcon(type: string): LucideIcon {
  if (type.includes("อสังหา")) return Building2;
  if (type.includes("หุ้น")) return Layers;
  if (type.includes("ทางการเงิน")) return TrendingUp;
  if (type.includes("อื่น")) return Wallet;
  return Tag;
}

type SnapshotItem = {
  icon: LucideIcon;
  label: string;
  value: string;
  accent: string;
  iconBg: string;
  highlight?: boolean;
};

type AssetSnapshotProps = {
  asset: Asset;
  /** โหมดกะทัดรัดสำหรับแสดงบนหัว wizard */
  compact?: boolean;
};

function ownershipSharePct(asset: Asset): number {
  if (asset.owners && asset.owners.length > 0) {
    const total = asset.owners.reduce((s, o) => s + (Number(o.share) || 0), 0);
    if (Math.abs(100 - total) < 0.05) return 100;
    return Math.round(total * 1000) / 1000;
  }
  return asset.share;
}

function buildItems(asset: Asset): SnapshotItem[] {
  const TypeIcon = typeIcon(asset.type);
  const typeLabel = [asset.type, asset.subtype].filter((p) => p?.trim()).join(" · ");
  const sharePct = ownershipSharePct(asset);

  const items: Array<SnapshotItem | null> = [
    typeLabel
      ? {
          icon: TypeIcon,
          label: "ประเภท",
          value: typeLabel,
          accent: "from-sky-50 to-white text-sky-600",
          iconBg: "bg-sky-100 text-sky-600",
        }
      : null,
    asset.owner?.trim() && asset.owner !== "—"
      ? {
          icon: UserRound,
          label: "ผู้ถือ",
          value:
            asset.owners && asset.owners.length > 1
              ? asset.owners.map((o) => o.owner).join(", ")
              : asset.owner,
          accent: "from-violet-50 to-white text-violet-600",
          iconBg: "bg-violet-100 text-violet-600",
        }
      : null,
    asset.value != null
      ? {
          icon: Wallet,
          label: "มูลค่า",
          value: money(asset.value),
          accent: "from-mint-brandLight to-white text-mint-brandDark",
          iconBg: "bg-mint-brandLight text-mint-brand",
          highlight: true,
        }
      : asset.assessed != null
        ? {
            icon: Wallet,
            label: "ราคาประเมิน",
            value: money(asset.assessed),
            accent: "from-mint-brandLight to-white text-mint-brandDark",
            iconBg: "bg-mint-brandLight text-mint-brand",
            highlight: true,
          }
        : null,
    sharePct > 0
      ? {
          icon: Layers,
          label: "สัดส่วนถือครอง",
          value: `${sharePct}%`,
          accent: "from-amber-50 to-white text-amber-700",
          iconBg: "bg-amber-100 text-amber-600",
        }
      : null,
  ];

  return items.filter(Boolean) as SnapshotItem[];
}

export function AssetSnapshot({ asset, compact = false }: AssetSnapshotProps) {
  const items = buildItems(asset);

  return (
    <div className="overflow-hidden rounded-2xl border border-mint-100 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-mint-100/80 bg-linear-to-r from-mint-brandLight/60 to-white px-4 py-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            ทรัพย์สินที่เลือก
          </div>
          <div className="truncate text-sm font-bold text-slate-800">
            {asset.name}
          </div>
          {asset.detail?.trim() ? (
            <div className="mt-0.5 truncate text-[11px] text-slate-500">
              {asset.detail}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={asset.status} />
          <span className="rounded-lg bg-white/80 px-2 py-1 text-[10px] font-bold text-slate-400 ring-1 ring-slate-100">
            {asset.id}
          </span>
        </div>
      </div>

      {items.length > 0 ? (
        <div
          className={`grid grid-cols-1 divide-y divide-mint-100/80 sm:divide-x sm:divide-y-0 ${
            compact
              ? "sm:grid-cols-2 lg:grid-cols-4"
              : items.length === 1
                ? "sm:grid-cols-1"
                : "sm:grid-cols-2"
          }`}
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className={`bg-linear-to-br ${item.accent} ${compact ? "p-3" : "p-4"}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`grid shrink-0 place-items-center rounded-xl ${item.iconBg} ${
                      compact ? "h-8 w-8" : "h-9 w-9"
                    }`}
                  >
                    <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                      {item.label}
                    </div>
                    <div
                      className={`mt-1 font-bold leading-snug ${
                        compact ? "text-xs" : "text-sm"
                      } ${
                        item.highlight
                          ? "text-mint-brandDark"
                          : "text-slate-800"
                      }`}
                    >
                      {item.value}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {!compact && asset.role?.trim() ? (
        <div className="flex items-center gap-2.5 border-t border-mint-100/80 bg-slate-50/50 px-4 py-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-white text-slate-400 ring-1 ring-slate-100">
            <Tag className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase">
              บทบาท
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">{asset.role}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
