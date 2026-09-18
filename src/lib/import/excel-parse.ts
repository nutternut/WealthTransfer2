import * as XLSX from "xlsx";
import {
  buildingAssessedValue,
  condoAssessedValue,
  depositValue,
  fundValue,
  landAssessedValue,
  listedSharesValue,
  quantityValue,
  sharesValueOrThrow,
} from "@/lib/tax-engine/valuation";
import { IMPORT_TEMPLATE_VERSION } from "@/lib/import/excel-template";
import {
  isAssetCategory,
  type AssetCategory,
  type OwnerKind,
} from "@/data/asset-taxonomy";

export type ImportSeverity =
  | "Blocking Error"
  | "Warning"
  | "Review Required"
  | "Information";

export type ImportIssue = {
  sheet: string;
  row: number;
  asset_code: string;
  field: string;
  error_code: string;
  message: string;
  severity: ImportSeverity;
};

export type StagedAsset = {
  sheet: string;
  row: number;
  assetCode: string;
  assetType: string;
  name: string;
  ownerId: string;
  ownerKind: OwnerKind;
  ownershipPercent: number;
  ownershipStatus: string;
  category: AssetCategory;
  subtype: string;
  computedValue: number;
  computedAssessed: number;
  cost: number;
  acquired: string;
  method: string;
  area?: string;
  assessedPerSqWa?: number;
  parValue?: number;
  bookValue?: number;
  registeredCapital?: number;
  sharesHeld?: number;
  detail?: string;
  issues: ImportIssue[];
  canImport: boolean;
};

export type StagedPerson = {
  personId: string;
  name: string;
  relation: string;
  gen: string;
  age: number;
  status: string;
  partnerId?: string;
  parentIds: string[];
};

export type StagedPriorTxn = {
  sheet: string;
  row: number;
  txnId: string;
  txnType: string;
  taxYear: string;
  transferorId: string;
  recipientId: string;
  assetCode: string;
  amount: number;
  bucket: string;
  issues: ImportIssue[];
  canImport: boolean;
};

export type ImportPreview = {
  templateVersion: string;
  people: StagedPerson[];
  assets: StagedAsset[];
  priors: StagedPriorTxn[];
  issues: ImportIssue[];
  passCount: number;
  warningCount: number;
  blockingCount: number;
  reviewCount: number;
};

const MEMBER_RELATIONS = [
  "เจ้าของหลัก",
  "คู่สมรส",
  "บุตร",
  "หลาน",
  "พี่น้อง",
  "อื่น ๆ",
] as const;

const SKIP_SHEETS = new Set([
  "Instructions",
  "วิธีใช้",
  "DataDictionary",
  "พจนานุกรม",
  "คำอธิบาย",
]);

const DETAIL_ASSET_SHEETS = [
  "RealEstate",
  "Shares",
  "FinancialAssets",
  "Vehicles",
  "Valuables",
  "DigitalAssets",
  "InsuranceOther",
] as const;

const SIMPLE_ASSET_SHEETS = ["ทรัพย์สิน", "Assets"];

const FIELD_ALIASES: Record<string, string[]> = {
  asset_code: ["asset_code", "รหัส", "รหัสทรัพย์สิน"],
  asset_type: ["asset_type", "ประเภททรัพย์สิน", "ประเภท", "ชนิด", "หมวด"],
  subtype: ["subtype", "ประเภทย่อย"],
  owner_kind: ["owner_kind", "ประเภทผู้ถือ", "ประเภทผู้ถือกรรมสิทธิ์"],
  asset_name: ["asset_name", "ชื่อทรัพย์สิน", "ชื่อรายการ", "รายการ", "name"],
  owner_id: [
    "owner_id",
    "ชื่อเจ้าของ",
    "เจ้าของ",
    "ผู้ถือกรรมสิทธิ์",
    "ผู้ถือครอง",
    "owner",
  ],
  ownership_percent: [
    "ownership_percent",
    "สัดส่วน (%)",
    "สัดส่วน",
    "สัดส่วนถือครอง_เปอร์เซ็นต์",
    "สัดส่วนถือครอง",
  ],
  ownership_status: ["ownership_status", "สถานะกรรมสิทธิ์"],
  valuation_date: ["valuation_date"],
  currency: ["currency"],
  value_source: ["value_source"],
  acquisition_date: ["acquisition_date", "ปีที่ได้มา", "acquired"],
  acquisition_method: ["acquisition_method", "วิธีได้มา", "method"],
  acquisition_cost: ["acquisition_cost", "ต้นทุน (บาท)", "ต้นทุน", "ต้นทุน_บาท", "cost"],
  evidence_reference: ["evidence_reference", "รายละเอียด", "detail"],
  value: [
    "value",
    "มูลค่า (บาท)",
    "มูลค่า",
    "มูลค่าตลาด_บาท",
    "มูลค่าตลาด",
    "sale_price",
  ],
  appraisal_value: [
    "appraisal_value",
    "ราคาประเมิน (บาท)",
    "ราคาประเมิน",
    "ราคาประเมิน_บาท",
  ],
  title_deed_no: ["title_deed_no"],
  province: ["province"],
  district: ["district"],
  area_rai: ["area_rai"],
  area_ngan: ["area_ngan"],
  area_sqwah: ["area_sqwah"],
  assessed_rate_per_sqwah: ["assessed_rate_per_sqwah"],
  area_sqm: ["area_sqm"],
  usable_area_sqm: ["usable_area_sqm"],
  assessed_rate_per_sqm: ["assessed_rate_per_sqm"],
  depreciation_factor: ["depreciation_factor"],
  land_asset_code: ["land_asset_code"],
  condo_unit_no: ["condo_unit_no"],
  project_name: ["project_name"],
  company_id: ["company_id"],
  shares_held: ["shares_held"],
  par_value_per_share: ["par_value_per_share"],
  paid_up_per_share: ["paid_up_per_share"],
  book_value_per_share: ["book_value_per_share"],
  total_paid_shares: ["total_paid_shares"],
  ticker: ["ticker"],
  exchange: ["exchange"],
  closing_price_per_share: ["closing_price_per_share"],
  price_date: ["price_date"],
  financial_institution: ["financial_institution"],
  account_reference: ["account_reference"],
  principal_balance: ["principal_balance"],
  balance_date: ["balance_date"],
  accrued_interest: ["accrued_interest"],
  fund_code: ["fund_code"],
  units_held: ["units_held"],
  nav_per_unit: ["nav_per_unit"],
  units_or_face_amount: ["units_or_face_amount"],
  valuation_per_unit: ["valuation_per_unit"],
  registration_no: ["registration_no"],
  vehicle_type: ["vehicle_type"],
  item_description: ["item_description"],
  quantity_or_weight: ["quantity_or_weight"],
  unit: ["unit"],
  price_per_unit: ["price_per_unit"],
  token_code: ["token_code"],
  reference_price: ["reference_price"],
  platform: ["platform"],
  policy_or_right_no: ["policy_or_right_no"],
  right_type: ["right_type"],
  valuation_method: ["valuation_method"],
  person_id: ["person_id"],
  name: ["name", "ชื่อ"],
  relation: ["relation"],
  gen: ["gen"],
  age: ["age"],
  status: ["status"],
  partner_id: ["partner_id"],
  parent_ids: ["parent_ids"],
  txn_id: ["txn_id"],
  txn_type: ["txn_type"],
  tax_year: ["tax_year"],
  transferor_id: ["transferor_id"],
  recipient_id: ["recipient_id"],
  amount: ["amount"],
  bucket: ["bucket"],
};

const HEADER_LIKE = new Set(
  Object.values(FIELD_ALIASES)
    .flat()
    .map((s) => normKey(s))
    .concat([
      "ชื่อทรัพย์สิน",
      "ชื่อ",
      "ประเภท",
      "ประเภททรัพย์สิน",
      "ประเภทย่อย",
      "ประเภทผู้ถือ",
      "เจ้าของ",
      "ผู้ถือกรรมสิทธิ์",
      "สัดส่วน",
      "มูลค่า",
      "รายละเอียด",
    ]),
);

function normKey(k: string): string {
  return k.replace(/\*/g, "").replace(/\s+/g, "").replace(/_+/g, "").toLowerCase();
}

function cell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const direct = row[key];
    if (direct != null && String(direct).trim() !== "") return String(direct).trim();
  }
  const aliases = keys.flatMap((k) => FIELD_ALIASES[k] ?? [k]);
  for (const alias of aliases) {
    const target = normKey(alias);
    for (const [k, v] of Object.entries(row)) {
      if (normKey(k) === target && v != null && String(v).trim() !== "") {
        return String(v).trim();
      }
    }
  }
  return "";
}

function matchHeader(
  headers: string[],
  aliases: string[],
  used: Set<number>,
  exactOnly = false,
): number {
  const cleaned = headers.map((h) => normKey(h));
  const sorted = [...aliases].sort(
    (a, b) => normKey(b).length - normKey(a).length,
  );
  for (const alias of sorted) {
    const a = normKey(alias);
    if (!a) continue;
    const idx = cleaned.findIndex((h, i) => !used.has(i) && h === a);
    if (idx >= 0) return idx;
  }
  if (exactOnly) return -1;
  for (const alias of sorted) {
    const a = normKey(alias);
    if (a.length < 6) continue;
    const idx = cleaned.findIndex(
      (h, i) => !used.has(i) && h.length > 0 && (h.includes(a) || a.includes(h)),
    );
    if (idx >= 0) return idx;
  }
  return -1;
}

function applyCanonicalKeys(row: Record<string, unknown>) {
  const headers = Object.keys(row);
  const used = new Set<number>();
  const order = [
    "asset_code",
    "asset_name",
    "subtype",
    "owner_kind",
    "asset_type",
    "owner_id",
    "ownership_percent",
    "value",
    "appraisal_value",
    "acquisition_cost",
    "acquisition_date",
    "acquisition_method",
    "ownership_status",
    "evidence_reference",
  ];
  const exactFields = new Set(["owner_kind", "subtype"]);
  for (const field of order) {
    const aliases = FIELD_ALIASES[field];
    if (!aliases) continue;
    const idx = matchHeader(headers, aliases, used, exactFields.has(field));
    if (idx < 0) continue;
    const header = headers[idx]!;
    if (row[field] == null || String(row[field]).trim() === "") {
      row[field] = row[header];
    }
    used.add(idx);
  }
}

function sheetAoa(wb: XLSX.WorkBook, name: string): string[][] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  const aoa = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(
    ws,
    { header: 1, defval: "", raw: false },
  );
  return aoa.map((row) =>
    (row ?? []).map((c) => (c == null ? "" : String(c).trim())),
  );
}

function isInstructionRow(cells: string[]): boolean {
  const first = cells[0] ?? "";
  return /^(version|บังคับ|ช่องอื่น|ประเภทที่|ลบแถว|ไม่ต้องมี|นำเข้าทรัพย์|กรอกแค่)/i.test(
    first,
  );
}

function assetRowsFromSheet(
  wb: XLSX.WorkBook,
  name: string,
): { row: Record<string, unknown>; excelRow: number }[] {
  const aoa = sheetAoa(wb, name);
  const nonempty = aoa
    .map((cells, i) => ({ cells, excelRow: i + 1 }))
    .filter((r) => r.cells.some((c) => c !== "") && !isInstructionRow(r.cells));

  let headerExcelRow = 0;
  let headers: string[] = [];
  for (const candidate of nonempty.slice(0, 12)) {
    const used = new Set<number>();
    const nameIdx = matchHeader(
      candidate.cells,
      FIELD_ALIASES.asset_name ?? ["ชื่อทรัพย์สิน"],
      used,
      true,
    );
    const typeIdx = matchHeader(
      candidate.cells,
      FIELD_ALIASES.asset_type ?? ["ประเภท"],
      used,
      true,
    );
    const ownerIdx = matchHeader(
      candidate.cells,
      FIELD_ALIASES.owner_id ?? ["เจ้าของ"],
      used,
      true,
    );
    const headerish = candidate.cells.filter((c) =>
      HEADER_LIKE.has(normKey(c)),
    ).length;
    if (nameIdx >= 0 || typeIdx >= 0 || ownerIdx >= 0 || headerish >= 2) {
      headerExcelRow = candidate.excelRow;
      headers = candidate.cells;
      break;
    }
  }

  const data = nonempty.filter((r) => r.excelRow !== headerExcelRow);
  return data.map(({ cells, excelRow }) => {
    const row: Record<string, unknown> = {};
    if (headers.length > 0) {
      headers.forEach((h, col) => {
        if (h) row[h] = cells[col] ?? "";
      });
      applyCanonicalKeys(row);
      if (!String(row.asset_name ?? "").trim()) {
        const fallback = cells.find(
          (c) => c && !HEADER_LIKE.has(normKey(c)) && Number.isNaN(Number(c.replace(/,/g, ""))),
        );
        if (fallback) row.asset_name = fallback;
      }
    } else {
      row.asset_name = cells[0] ?? "";
      row.asset_type = cells[1] ?? "";
      row.owner_id = cells[2] ?? "";
      row.value = cells[3] ?? "";
      row.ownership_percent = cells[4] ?? "";
    }
    return { row, excelRow };
  });
}

function readWorkbook(file: ArrayBuffer, filename = ""): XLSX.WorkBook {
  if (/\.csv$/i.test(filename)) {
    const text = new TextDecoder().decode(file).replace(/^\uFEFF/, "");
    return XLSX.read(text, { type: "string" });
  }
  return XLSX.read(file, { type: "array" });
}

function num(row: Record<string, unknown>, ...keys: string[]): number | null {
  const raw = cell(row, ...keys).replace(/,/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function sheetRows(wb: XLSX.WorkBook, name: string): Record<string, unknown>[] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
    raw: false,
  });
  return rows.filter((row) =>
    Object.values(row).some((v) => String(v ?? "").trim() !== ""),
  );
}

function mapOwnerKind(raw: string): OwnerKind {
  const r = raw.trim();
  if (/นิติ/.test(r)) return "นิติบุคคล";
  if (/คนนอก|ภายนอก/.test(r)) return "คนนอก";
  return "บุคคลธรรมดา";
}

function mapRelation(raw: string): string {
  const r = raw.trim();
  if ((MEMBER_RELATIONS as readonly string[]).includes(r)) return r;
  if (/คู่สมรส|ภรรยา|สามี/.test(r)) return "คู่สมรส";
  if (/หลาน/.test(r)) return "หลาน";
  if (/บุตร/.test(r)) return "บุตร";
  if (/พี่น้อง/.test(r)) return "พี่น้อง";
  if (/เจ้าของ/.test(r)) return "เจ้าของหลัก";
  return "อื่น ๆ";
}

function mapGen(raw: string): string {
  if (/1/.test(raw)) return "รุ่นที่ 1";
  if (/2/.test(raw)) return "รุ่นที่ 2";
  if (/3/.test(raw)) return "รุ่นที่ 3";
  if (/4/.test(raw)) return "รุ่นที่ 4";
  return "รุ่นที่ 1";
}

function categoryOf(assetType: string): { category: AssetCategory; subtype: string } {
  const t = assetType.trim();
  if (isAssetCategory(t)) return { category: t, subtype: t };
  if (/ที่ดิน|บ้าน|อาคาร|ห้องชุด|โรงงาน|คอนโด/.test(t)) {
    return { category: "อสังหาริมทรัพย์", subtype: t };
  }
  if (/หุ้น/.test(t)) {
    return { category: "หุ้นส่วนบริษัท", subtype: t };
  }
  if (/เงินฝาก|กองทุน|พันธบัตร|หุ้นกู้|ดิจิทัล|เงินสด/.test(t)) {
    return { category: "ทรัพย์สินทางการเงิน", subtype: t };
  }
  return { category: "ทรัพย์สินอื่น", subtype: t || "อื่น ๆ" };
}

function resolveType(row: Record<string, unknown>): {
  category: AssetCategory;
  subtype: string;
  assetType: string;
} {
  const typeCol = cell(row, "asset_type");
  const subtypeCol = cell(row, "subtype");
  if (isAssetCategory(typeCol) && subtypeCol) {
    return { category: typeCol, subtype: subtypeCol, assetType: subtypeCol };
  }
  const mapped = categoryOf(typeCol || subtypeCol);
  return { ...mapped, assetType: typeCol || subtypeCol || mapped.subtype };
}

function issue(
  sheet: string,
  row: number,
  asset_code: string,
  field: string,
  error_code: string,
  message: string,
  severity: ImportSeverity,
): ImportIssue {
  return { sheet, row, asset_code, field, error_code, message, severity };
}

function parseOwner(raw: string): { name: string; percent?: number } {
  const first = raw.split(/[;|/]/)[0]?.trim() ?? raw.trim();
  const wrapped = /^(.+?)\s*\((.+)\)\s*$/.exec(first);
  if (wrapped) {
    const pct = /(\d+(?:\.\d+)?)\s*%/.exec(wrapped[2] ?? "");
    return {
      name: wrapped[1]!.trim(),
      percent: pct ? Number(pct[1]) : undefined,
    };
  }
  return { name: first };
}

function looksLikeHeaderRow(row: Record<string, unknown>): boolean {
  const name = cell(row, "asset_name") || cell(row, "person_id") || cell(row, "txn_id");
  return Boolean(name) && HEADER_LIKE.has(normKey(name));
}

function computeValue(
  sheet: string,
  row: Record<string, unknown>,
  assetType: string,
  issues: ImportIssue[],
  rowNum: number,
  code: string,
): { value: number; assessed: number; extra: Partial<StagedAsset> } {
  const extra: Partial<StagedAsset> = {};
  const explicit =
    num(row, "value") ?? num(row, "appraisal_value") ?? null;

  if (sheet === "RealEstate" || /ที่ดิน|บ้าน|อาคาร|ห้องชุด/.test(assetType)) {
    const rai = num(row, "area_rai") ?? 0;
    const ngan = num(row, "area_ngan") ?? 0;
    const sq = num(row, "area_sqwah") ?? 0;
    const rate = num(row, "assessed_rate_per_sqwah");
    extra.area = rai || ngan || sq ? `${rai}-${ngan}-${sq}` : undefined;
    extra.assessedPerSqWa = rate ?? undefined;
    if (/ที่ดิน/.test(assetType) && rate == null && explicit == null) {
      issues.push(
        issue(
          sheet,
          rowNum,
          code,
          "value",
          "MISSING_VALUE",
          "ยังไม่มีมูลค่าหรือราคาประเมิน — นำเข้าได้ ใส่ตัวเลขภายหลังได้",
          "Warning",
        ),
      );
    }
    let assessed = rate != null ? landAssessedValue(rai, ngan, sq, rate) : 0;
    const sqm = num(row, "area_sqm") ?? num(row, "usable_area_sqm");
    const rateSqm = num(row, "assessed_rate_per_sqm");
    const dep = num(row, "depreciation_factor") ?? 1;
    if (sqm != null && rateSqm != null) {
      assessed += /ห้องชุด/.test(assetType)
        ? condoAssessedValue(sqm, rateSqm)
        : buildingAssessedValue(sqm, rateSqm, dep);
    }
    const sale = explicit ?? (assessed > 0 ? assessed : 0);
    return { value: sale, assessed: assessed || sale, extra };
  }

  if (sheet === "Shares" || /หุ้น/.test(assetType)) {
    try {
      const computed = sharesValueOrThrow({
        sharesHeld: num(row, "shares_held"),
        parValuePerShare: num(row, "par_value_per_share"),
        ownershipPercent: num(row, "ownership_percent"),
        companyPaidUpCapital:
          (num(row, "total_paid_shares") ?? 0) * (num(row, "paid_up_per_share") ?? 0) ||
          null,
        bookValuePerShare: num(row, "book_value_per_share"),
      });
      extra.sharesHeld = num(row, "shares_held") ?? undefined;
      extra.parValue = computed.value;
      extra.bookValue =
        num(row, "book_value_per_share") != null && num(row, "shares_held") != null
          ? (num(row, "book_value_per_share") ?? 0) * (num(row, "shares_held") ?? 0)
          : undefined;
      const listed = num(row, "closing_price_per_share");
      const shares = num(row, "shares_held") ?? 0;
      const market =
        listed != null && shares > 0 ? listedSharesValue(shares, listed) : computed.value;
      if (/Holding|โฮลดิ้ง/.test(assetType)) {
        issues.push(
          issue(sheet, rowNum, code, "asset_type", "HOLDING", "หุ้น Holding ต้องให้ผู้เชี่ยวชาญตรวจมูลค่า", "Review Required"),
        );
      }
      return { value: explicit ?? market, assessed: computed.value, extra };
    } catch {
      if (explicit == null) {
        issues.push(
          issue(
            sheet,
            rowNum,
            code,
            "value",
            "MISSING_VALUE",
            "ยังไม่มีมูลค่าหุ้น — นำเข้าได้ ใส่ตัวเลขภายหลังได้",
            "Warning",
          ),
        );
      }
      return { value: explicit ?? 0, assessed: explicit ?? 0, extra };
    }
  }

  if (sheet === "FinancialAssets" || /เงินฝาก|กองทุน|พันธบัตร/.test(assetType)) {
    if (/เงินฝาก/.test(assetType)) {
      const principal = num(row, "principal_balance") ?? explicit ?? 0;
      const interest = num(row, "accrued_interest") ?? 0;
      const v = depositValue(principal, interest);
      return { value: v, assessed: v, extra };
    }
    const units = num(row, "units_held") ?? num(row, "units_or_face_amount") ?? 0;
    const nav = num(row, "nav_per_unit") ?? num(row, "valuation_per_unit") ?? 0;
    const v = units && nav ? fundValue(units, nav) : (explicit ?? 0);
    return { value: v, assessed: v, extra };
  }

  if (sheet === "Valuables" || /ทอง|พระ|ศิลปะ/.test(assetType)) {
    const qty = num(row, "quantity_or_weight") ?? 0;
    const price = num(row, "price_per_unit") ?? 0;
    const v = qty && price ? quantityValue(qty, price) : (explicit ?? 0);
    return { value: v, assessed: v, extra };
  }

  if (sheet === "DigitalAssets") {
    const units = num(row, "units_held") ?? 0;
    const price = num(row, "reference_price") ?? 0;
    const v = units && price ? quantityValue(units, price) : (explicit ?? 0);
    return { value: v, assessed: v, extra };
  }

  if (sheet === "Vehicles") {
    const v = explicit ?? 0;
    const high = num(row, "transport_assessed_high");
    const low = num(row, "transport_assessed_low");
    const assessed = high != null && low != null ? (high + low) / 2 : v;
    return { value: v, assessed, extra };
  }

  return { value: explicit ?? 0, assessed: explicit ?? 0, extra };
}

function stageAssetRow(
  sheet: string,
  row: Record<string, unknown>,
  rowNum: number,
  personIds: Set<string>,
  peopleCount: number,
  assetCodes: Set<string>,
  ownershipByCode: Map<string, number>,
): StagedAsset | null {
  if (looksLikeHeaderRow(row)) return null;

  const name = cell(row, "asset_name");
  const resolved = resolveType(row);
  const category = resolved.category;
  const subtype = resolved.subtype || "อื่น ๆ";
  const assetType = resolved.assetType || "อื่น ๆ";
  const ownerRaw = cell(row, "owner_id");
  const owner = ownerRaw ? parseOwner(ownerRaw) : { name: "" };
  if (!name && !cell(row, "asset_type") && !owner.name && num(row, "value") == null) {
    return null;
  }

  const rowIssues: ImportIssue[] = [];
  const code =
    cell(row, "asset_code") ||
    `IMP-${sheet}-${rowNum}`;

  if (!name) {
    rowIssues.push(
      issue(sheet, rowNum, code, "asset_name", "REQUIRED", "ขาดชื่อทรัพย์สิน — แถวนี้ข้าม", "Blocking Error"),
    );
  }
  if (!cell(row, "asset_type")) {
    rowIssues.push(
      issue(
        sheet,
        rowNum,
        code,
        "asset_type",
        "DEFAULT_TYPE",
        "ไม่ได้ใส่ประเภท — จะบันทึกเป็น อื่น ๆ",
        "Information",
      ),
    );
  }
  if (!owner.name) {
    rowIssues.push(
      issue(
        sheet,
        rowNum,
        code,
        "owner_id",
        "DEFAULT_OWNER",
        "ไม่ได้ใส่เจ้าของ — จะใช้สมาชิกคนแรกในครอบครัว",
        "Information",
      ),
    );
  }

  if (cell(row, "asset_code") && assetCodes.has(code)) {
    rowIssues.push(
      issue(sheet, rowNum, code, "asset_code", "DUPLICATE", "รหัสทรัพย์ซ้ำ — นำเข้าเป็นรายการแยกได้", "Warning"),
    );
  }
  if (cell(row, "asset_code")) assetCodes.add(code);

  if (owner.name && peopleCount > 0 && !personIds.has(owner.name)) {
    rowIssues.push(
      issue(
        sheet,
        rowNum,
        code,
        "owner_id",
        "NEW_OWNER",
        `เจ้าของ "${owner.name}" ไม่อยู่ในชีต People — จะใช้ชื่อนี้สร้างสมาชิกถ้ายังไม่มี`,
        "Information",
      ),
    );
  }

  const pctRaw = num(row, "ownership_percent");
  let pct = pctRaw ?? owner.percent ?? 100;
  if (pctRaw != null && pctRaw <= 0) {
    pct = 100;
    rowIssues.push(
      issue(sheet, rowNum, code, "ownership_percent", "RANGE", "สัดส่วนว่างหรือไม่ถูกต้อง — ใช้ 100%", "Warning"),
    );
  } else if (pct > 100) {
    pct = 100;
    rowIssues.push(
      issue(sheet, rowNum, code, "ownership_percent", "RANGE", "สัดส่วนเกิน 100% — ปรับเหลือ 100%", "Warning"),
    );
  }
  if (cell(row, "asset_code")) {
    const sum = (ownershipByCode.get(code) ?? 0) + pct;
    ownershipByCode.set(code, sum);
    if (sum > 100.0001) {
      rowIssues.push(
        issue(sheet, rowNum, code, "ownership_percent", "OVER_100", "ผลรวมเจ้าของทรัพย์เดียวกันเกิน 100% — นำเข้าได้", "Warning"),
      );
    }
  }

  if (!cell(row, "acquisition_date") || num(row, "acquisition_cost") == null) {
    rowIssues.push(
      issue(
        sheet,
        rowNum,
        code,
        "acquisition_date",
        "SALE_FACTS",
        "ไม่มีวันที่ได้มาหรือต้นทุน — นำเข้าได้แต่ยังคำนวณการขายไม่ได้",
        "Warning",
      ),
    );
  }

  const computed = computeValue(sheet, row, assetType, rowIssues, rowNum, code);
  const blocking = rowIssues.some((x) => x.severity === "Blocking Error");
  return {
    sheet,
    row: rowNum,
    assetCode: code,
    assetType,
    name,
    ownerId: owner.name,
    ownerKind: mapOwnerKind(cell(row, "owner_kind")),
    ownershipPercent: pct,
    ownershipStatus: cell(row, "ownership_status") || "สินส่วนตัว",
    category,
    subtype,
    computedValue: computed.value,
    computedAssessed: computed.assessed,
    cost: num(row, "acquisition_cost") ?? 0,
    acquired: cell(row, "acquisition_date"),
    method: cell(row, "acquisition_method") || "ซื้อ",
    detail: cell(row, "evidence_reference") || cell(row, "title_deed_no") || undefined,
    issues: rowIssues,
    canImport: !blocking && Boolean(name),
    ...computed.extra,
  };
}

export function parseImportWorkbook(file: ArrayBuffer, filename = ""): ImportPreview {
  const wb = readWorkbook(file, filename);
  const issues: ImportIssue[] = [];
  const people: StagedPerson[] = [];
  const assets: StagedAsset[] = [];
  const personIds = new Set<string>();
  const assetCodes = new Set<string>();
  const ownershipByCode = new Map<string, number>();

  for (const [i, row] of sheetRows(wb, "People").entries()) {
    if (looksLikeHeaderRow(row)) continue;
    const personId = cell(row, "person_id");
    const name = cell(row, "name");
    const rowNum = i + 2;
    if (!personId && !name) continue;
    if (!personId || !name) {
      issues.push(
        issue("People", rowNum, personId, "person_id", "REQUIRED", "ขาดรหัสหรือชื่อสมาชิก", "Warning"),
      );
      continue;
    }
    if (personIds.has(personId)) {
      issues.push(
        issue("People", rowNum, personId, "person_id", "DUPLICATE", "person_id ซ้ำ", "Blocking Error"),
      );
    }
    personIds.add(personId);
    people.push({
      personId,
      name,
      relation: mapRelation(cell(row, "relation") || "อื่น ๆ"),
      gen: mapGen(cell(row, "gen")),
      age: Math.min(120, Math.max(0, num(row, "age") ?? 0)),
      status: /ถึงแก่กรรม/.test(cell(row, "status")) ? "ถึงแก่กรรม" : "มีชีวิต",
      partnerId: cell(row, "partner_id") || undefined,
      parentIds: cell(row, "parent_ids")
        ? cell(row, "parent_ids").split(/[,;|]/).map((s) => s.trim()).filter(Boolean)
        : [],
    });
  }

  const assetSheetNames = [
    ...SIMPLE_ASSET_SHEETS.filter((s) => wb.SheetNames.includes(s)),
    ...DETAIL_ASSET_SHEETS.filter((s) => wb.SheetNames.includes(s)),
    ...wb.SheetNames.filter(
      (s) =>
        !SKIP_SHEETS.has(s) &&
        s !== "People" &&
        s !== "PriorTransactions" &&
        !SIMPLE_ASSET_SHEETS.includes(s) &&
        !(DETAIL_ASSET_SHEETS as readonly string[]).includes(s),
    ),
  ];

  for (const sheet of assetSheetNames) {
    for (const { row, excelRow } of assetRowsFromSheet(wb, sheet)) {
      const staged = stageAssetRow(
        sheet,
        row,
        excelRow,
        personIds,
        people.length,
        assetCodes,
        ownershipByCode,
      );
      if (!staged) continue;
      assets.push(staged);
      issues.push(...staged.issues);
    }
  }

  const priors: StagedPriorTxn[] = [];
  for (const [i, row] of sheetRows(wb, "PriorTransactions").entries()) {
    const rowNum = i + 2;
    const txnId = cell(row, "txn_id");
    if (!txnId || looksLikeHeaderRow(row)) continue;
    const rowIssues: ImportIssue[] = [];
    const amount = num(row, "amount") ?? 0;
    const transferorId = cell(row, "transferor_id");
    const recipientId = cell(row, "recipient_id");
    const txnType = cell(row, "txn_type");
    const taxYear = cell(row, "tax_year");
    if (!txnType || !taxYear || !transferorId || !recipientId || amount <= 0) {
      rowIssues.push(
        issue(
          "PriorTransactions",
          rowNum,
          txnId,
          "amount",
          "REQUIRED",
          "ยอดก่อนหน้าไม่ครบ — ข้ามแถวนี้ (ทรัพย์สินอื่นยังนำเข้าได้)",
          "Warning",
        ),
      );
    }
    const blocking = rowIssues.some((x) => x.severity === "Blocking Error");
    priors.push({
      sheet: "PriorTransactions",
      row: rowNum,
      txnId,
      txnType,
      taxYear,
      transferorId,
      recipientId,
      assetCode: cell(row, "asset_code"),
      amount,
      bucket: cell(row, "bucket") || "related",
      issues: rowIssues,
      canImport: !blocking && amount > 0 && Boolean(txnType && transferorId && recipientId),
    });
    issues.push(...rowIssues);
  }

  const blockingCount = issues.filter((i) => i.severity === "Blocking Error").length;
  const warningCount = issues.filter((i) => i.severity === "Warning").length;
  const reviewCount = issues.filter((i) => i.severity === "Review Required").length;
  const passCount = assets.filter((a) => a.canImport).length;

  return {
    templateVersion: IMPORT_TEMPLATE_VERSION,
    people,
    assets,
    priors,
    issues,
    passCount,
    warningCount,
    blockingCount,
    reviewCount,
  };
}

export function errorReportCsv(issues: ImportIssue[]): string {
  const header = "sheet,row,asset_code,field,error_code,severity,message";
  const lines = issues.map((i) =>
    [i.sheet, i.row, i.asset_code, i.field, i.error_code, i.severity, `"${i.message.replace(/"/g, '""')}"`].join(","),
  );
  return [header, ...lines].join("\n");
}

export function downloadErrorReport(issues: ImportIssue[]) {
  const blob = new Blob([errorReportCsv(issues)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "wealth-import-error-report.csv";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
