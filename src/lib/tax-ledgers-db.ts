import { getSupabase } from "@/lib/supabase/client";
import { requireOwnerId } from "@/lib/auth";
import type { PriorLedgerSeed } from "@/lib/plan-tax";
import type { ReceiverTaxClass } from "@/lib/transfer-cost";

type LedgerKind =
  | "gift_related"
  | "gift_customary"
  | "gift_immovable_42_26"
  | "inheritance";

const KIND_TO_SEED: Record<LedgerKind, PriorLedgerSeed["kind"]> = {
  gift_related: "related",
  gift_customary: "customary",
  gift_immovable_42_26: "immovable",
  inheritance: "inheritance",
};

const SEED_TO_KIND: Record<PriorLedgerSeed["kind"], LedgerKind> = {
  related: "gift_related",
  customary: "gift_customary",
  immovable: "gift_immovable_42_26",
  inheritance: "inheritance",
};

export function accumulatorKey(seed: PriorLedgerSeed): string {
  return [
    SEED_TO_KIND[seed.kind],
    seed.party,
    seed.counterparty ?? "",
    seed.taxYear,
  ].join("::");
}

export async function fetchTaxLedgers(): Promise<PriorLedgerSeed[]> {
  try {
    const supabase = getSupabase();
    const ownerId = await requireOwnerId();
    const { data, error } = await supabase
      .from("wealth_tax_ledgers")
      .select(
        "ledger_kind, party_id, counterparty_id, tax_year, current_total",
      )
      .eq("owner_id", ownerId);
    if (error || !data) return [];
    return data.flatMap((row) => {
      const kind = KIND_TO_SEED[row.ledger_kind as LedgerKind];
      const party = String(row.party_id ?? "");
      if (!kind || !party) return [];
      const seed: PriorLedgerSeed = {
        kind,
        party,
        taxYear: String(row.tax_year ?? ""),
        currentTotal: Number(row.current_total) || 0,
      };
      if (row.counterparty_id) seed.counterparty = String(row.counterparty_id);
      return [seed];
    });
  } catch {
    return [];
  }
}

export async function upsertTaxLedgers(seeds: PriorLedgerSeed[]): Promise<boolean> {
  if (seeds.length === 0) return true;
  try {
    const supabase = getSupabase();
    const ownerId = await requireOwnerId();
    const rows = seeds.map((seed) => ({
      id: `${ownerId}:${accumulatorKey(seed)}`.slice(0, 180),
      owner_id: ownerId,
      accumulator_key: accumulatorKey(seed),
      ledger_kind: SEED_TO_KIND[seed.kind],
      party_id: seed.party,
      counterparty_id: seed.counterparty ?? null,
      tax_year: seed.taxYear,
      prior_total: 0,
      current_total: seed.currentTotal,
      taxable_excess: 0,
      tax_amount: 0,
      source: "import",
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from("wealth_tax_ledgers")
      .upsert(rows, { onConflict: "owner_id,accumulator_key" });
    return !error;
  } catch {
    return false;
  }
}

export function taxClassFromBucket(bucket: string): ReceiverTaxClass | undefined {
  if (/คู่สมรส/.test(bucket)) return "คู่สมรส";
  if (/บุตรชอบด้วยกฎหมาย/.test(bucket)) return "บุตรชอบด้วยกฎหมาย";
  if (/บุตรบุญธรรม/.test(bucket)) return "บุตรบุญธรรม";
  if (/ผู้สืบสันดาน|บุตร/.test(bucket)) return "ผู้สืบสันดาน";
  if (/บุพการี/.test(bucket)) return "บุพการี";
  return undefined;
}
