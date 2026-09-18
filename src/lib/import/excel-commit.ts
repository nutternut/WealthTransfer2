import type { Asset, Member } from "@/data/wealth-transfer";
import { createAsset } from "@/lib/assets-db";
import { fetchMembers, nextMemberId, persistMembers } from "@/lib/members-db";
import { getSupabase } from "@/lib/supabase/client";
import { requireOwnerId } from "@/lib/auth";
import type { ImportPreview, StagedAsset, StagedPriorTxn } from "@/lib/import/excel-parse";
import { IMPORT_TEMPLATE_VERSION } from "@/lib/import/excel-template";
import { upsertTaxLedgers, taxClassFromBucket } from "@/lib/tax-ledgers-db";
import type { PriorLedgerSeed } from "@/lib/plan-tax";

export type ImportCommitResult = {
  createdAssets: Asset[];
  createdMembers: number;
  skipped: number;
  priorsImported: number;
  auditRecorded: boolean;
};

async function recordImportBatch(input: {
  filename: string;
  fileHash: string;
  rowCount: number;
  importedCount: number;
}): Promise<string | null> {
  try {
    const supabase = getSupabase();
    const ownerId = await requireOwnerId();
    const id = crypto.randomUUID();
    const { error } = await supabase.from("wealth_import_batches").insert({
      id,
      owner_id: ownerId,
      filename: input.filename,
      file_hash: input.fileHash,
      template_version: IMPORT_TEMPLATE_VERSION,
      row_count: input.rowCount,
      imported_count: input.importedCount,
    });
    return error ? null : id;
  } catch {
    return null;
  }
}

async function recordValuation(assetId: string, amount: number, source: string) {
  try {
    const supabase = getSupabase();
    const ownerId = await requireOwnerId();
    await supabase.from("wealth_valuations").insert({
      id: crypto.randomUUID(),
      owner_id: ownerId,
      asset_id: assetId,
      valuation_method: "engine",
      value_amount: amount,
      valuation_date: new Date().toISOString().slice(0, 10),
      source,
    });
  } catch {
    /* optional table */
  }
}

function priorToSeed(
  row: StagedPriorTxn,
  personToName: Map<string, string>,
): PriorLedgerSeed | null {
  const recipient =
    personToName.get(row.recipientId) || row.recipientId;
  const transferor =
    personToName.get(row.transferorId) || row.transferorId;
  const year = /(\d{4})/.exec(row.taxYear)?.[1] ?? row.taxYear;
  const bucket = row.bucket.toLowerCase();
  const isInherit = /มรดก|inherit/.test(row.txnType) || /inherit/.test(bucket);
  const isImmovable = /immovable|42.?26|อสังหา/.test(bucket);
  const isCustomary = /customary|42.?28|ประเพณี|ธรรมจรรยา/.test(bucket);
  if (isInherit) {
    return {
      kind: "inheritance",
      party: recipient,
      counterparty: transferor,
      taxYear: year,
      currentTotal: row.amount,
      taxClass: taxClassFromBucket(row.bucket),
    };
  }
  if (isImmovable) {
    return {
      kind: "immovable",
      party: transferor,
      counterparty: recipient,
      taxYear: year,
      currentTotal: row.amount,
    };
  }
  return {
    kind: isCustomary ? "customary" : "related",
    party: recipient,
    counterparty: transferor,
    taxYear: year,
    currentTotal: row.amount,
  };
}

function yearFromDate(raw: string): string {
  const m = /(\d{4})/.exec(raw);
  return m?.[1] ?? "";
}

async function recordImportAudit(input: {
  filename: string;
  fileHash: string;
  rowCount: number;
  created: number;
}): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const ownerId = await requireOwnerId();
    const { error } = await supabase.from("wealth_audit_logs").insert({
      owner_id: ownerId,
      at: new Date().toISOString(),
      user_label: "import",
      item: input.filename,
      change: `นำเข้า ${input.created} รายการ จาก ${input.rowCount} แถว · ${IMPORT_TEMPLATE_VERSION} · ${input.fileHash.slice(0, 12)}`,
      category: "ข้อมูลทรัพย์สิน",
    });
    return !error;
  } catch {
    return false;
  }
}

export async function hashFile(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function nextIdAllocator(startId: string) {
  let n = Number(/^M(\d+)$/.exec(startId)?.[1] ?? 1);
  return () => {
    const id = `M${n}`;
    n += 1;
    return id;
  };
}

function resolveName(members: Member[], raw: string): string | undefined {
  const key = raw.trim();
  if (!key) return undefined;
  const hit = members.find(
    (m) => m.name.trim() === key || m.id === key || m.name.trim() === raw,
  );
  return hit?.name;
}

export async function commitImportPreview(
  preview: ImportPreview,
  options: { filename: string; fileHash: string },
): Promise<ImportCommitResult> {
  const importable = preview.assets.filter((a) => a.canImport);
  const importablePriors = preview.priors.filter((p) => p.canImport);
  if (importable.length === 0 && importablePriors.length === 0) {
    throw new Error("ไม่พบชื่อทรัพย์สินในไฟล์ — ใส่ชื่อในคอลัมน์แรกแล้วลองใหม่");
  }

  let members = await fetchMembers();
  let createdMembers = 0;
  const personToName = new Map<string, string>();
  const next = [...members];
  const takeId = nextIdAllocator(await nextMemberId());

  function remember(key: string, name: string) {
    if (!key.trim()) return;
    personToName.set(key, name);
    personToName.set(key.trim(), name);
    personToName.set(name, name);
  }

  function ensureMember(
    name: string,
    extras?: Partial<Pick<Member, "gen" | "age" | "relation" | "status" | "parentIds">>,
  ): string {
    const trimmed = name.trim();
    if (!trimmed) return "";
    const existingName = resolveName(next, trimmed);
    if (existingName) {
      remember(trimmed, existingName);
      return existingName;
    }
    next.push({
      id: takeId(),
      name: trimmed,
      gen: extras?.gen ?? "รุ่นที่ 1",
      age: extras?.age ?? 0,
      relation: extras?.relation ?? "อื่น ๆ",
      status: extras?.status ?? "มีชีวิต",
      parentIds: extras?.parentIds,
    });
    remember(trimmed, trimmed);
    createdMembers += 1;
    return trimmed;
  }

  for (const m of next) {
    remember(m.id, m.name);
    remember(m.name, m.name);
  }

  for (const person of preview.people) {
    const saved = ensureMember(person.name, {
      gen: person.gen,
      age: person.age,
      relation: person.relation,
      status: person.status,
      parentIds: person.parentIds.length > 0 ? person.parentIds : undefined,
    });
    if (person.personId) remember(person.personId, saved || person.name);
  }

  const fallbackOwner =
    next.find((m) => m.relation === "เจ้าของหลัก")?.name ??
    next[0]?.name ??
    "เจ้าของหลัก";
  ensureMember(fallbackOwner, { relation: "เจ้าของหลัก" });

  for (const row of importable) {
    if (row.ownerId.trim()) ensureMember(row.ownerId);
  }

  if (createdMembers > 0) {
    await persistMembers(next);
    members = next;
  }

  const createdAssets: Asset[] = [];
  let skipped = 0;
  const skipReasons: string[] = [];

  for (const row of importable) {
    try {
      const ownerName =
        (row.ownerId.trim()
          ? personToName.get(row.ownerId.trim()) ||
            resolveName(members, row.ownerId)
          : undefined) || fallbackOwner;
      const created = await createAssetFromStage(row, ownerName);
      createdAssets.push(created);
      await recordValuation(
        created.id,
        row.computedAssessed || row.computedValue,
        `${options.filename} · ${row.assetCode}`,
      );
    } catch (e) {
      skipped += 1;
      skipReasons.push(
        `${row.name}: ${e instanceof Error ? e.message : "บันทึกไม่สำเร็จ"}`,
      );
    }
  }

  if (createdAssets.length === 0 && importablePriors.length === 0) {
    throw new Error(
      skipReasons[0] || "บันทึกไม่สำเร็จ — ตรวจชื่อทรัพย์สินแล้วลองใหม่",
    );
  }

  const seeds = importablePriors
    .map((row) => priorToSeed(row, personToName))
    .filter((row): row is PriorLedgerSeed => Boolean(row));
  if (seeds.length > 0) {
    await upsertTaxLedgers(seeds);
  }

  await recordImportBatch({
    filename: options.filename,
    fileHash: options.fileHash,
    rowCount: preview.assets.length + preview.priors.length,
    importedCount: createdAssets.length + seeds.length,
  });

  const auditRecorded = await recordImportAudit({
    filename: options.filename,
    fileHash: options.fileHash,
    rowCount: preview.assets.length + preview.priors.length,
    created: createdAssets.length,
  });

  return {
    createdAssets,
    createdMembers,
    skipped,
    priorsImported: seeds.length,
    auditRecorded,
  };
}

async function createAssetFromStage(row: StagedAsset, ownerName: string) {
  return createAsset({
    name: row.name,
    type: row.category,
    subtype: row.subtype,
    detail: row.detail,
    owner: ownerName,
    ownerKind:
      row.ownerKind === "นิติบุคคล" || row.ownershipStatus === "นิติบุคคล"
        ? "นิติบุคคล"
        : row.ownerKind,
    share: row.ownershipPercent,
    role: "นำเข้าจาก Excel",
    value: row.computedValue,
    assessed: row.computedAssessed,
    cost: row.cost || undefined,
    acquired: yearFromDate(row.acquired),
    method: row.method,
    area: row.area,
    assessedPerSqWa: row.assessedPerSqWa,
    parValue: row.parValue,
    bookValue: row.bookValue,
    registeredCapital: row.registeredCapital,
    ownershipStatus: row.ownershipStatus,
    assetCode: row.assetCode,
    holders: [
      {
        ownerKind:
          row.ownerKind === "นิติบุคคล" || row.ownershipStatus === "นิติบุคคล"
            ? "นิติบุคคล"
            : row.ownerKind,
        owner: ownerName,
        share: row.ownershipPercent,
      },
    ],
  });
}
