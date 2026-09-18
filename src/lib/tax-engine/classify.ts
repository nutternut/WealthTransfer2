/**
 * จำแนกทรัพย์ ความสัมพันธ์ และฐานภาษี
 * อ้างอิง คู่มือระยะที่ 1 ข้อ 4–6, 10.2
 */

export type ReceiverTaxClass =
  | "คู่สมรส"
  | "บุตรชอบด้วยกฎหมาย"
  | "บุตรบุญธรรม"
  | "ผู้สืบสันดาน"
  | "บุพการี"
  | "นิติบุคคล"
  | "คนอื่น";

export type GiftBucket = "related" | "customary" | "none";

export type OwnershipStatus =
  | "สินส่วนตัว"
  | "สินสมรส"
  | "กรรมสิทธิ์ร่วม"
  | "นิติบุคคล";

export type CalcStatus =
  | "Estimated"
  | "Missing Data"
  | "Rule Conflict"
  | "Review Required"
  | "Advisor Reviewed"
  | "Confirmed at Filing";

export type MovableSecurityKind =
  | "หุ้นในตลาด"
  | "หุ้นนอกตลาด"
  | "กองทุน"
  | "ตราสารหนี้"
  | "สินทรัพย์ดิจิทัล"
  | "เงินฝาก"
  | "ทรัพย์สะสม"
  | "อื่น";

const STATUS_RANK: Record<CalcStatus, number> = {
  "Confirmed at Filing": 0,
  "Advisor Reviewed": 1,
  Estimated: 2,
  "Review Required": 3,
  "Missing Data": 4,
  "Rule Conflict": 5,
};

export function worseStatus(a: CalcStatus, b: CalcStatus): CalcStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

export function classifyReceiverRelation(
  relation?: string | null,
): ReceiverTaxClass {
  const r = (relation ?? "").trim();
  if (!r) return "คนอื่น";
  if (/นิติ|บริษัท|หจก|หสน/.test(r)) return "นิติบุคคล";
  if (/คู่สมรส|ภรรยา|สามี/.test(r)) return "คู่สมรส";
  if (/บุตรบุญธรรม/.test(r)) return "บุตรบุญธรรม";
  if (/บุตรชอบด้วยกฎหมาย/.test(r)) return "บุตรชอบด้วยกฎหมาย";
  if (/หลาน|เหลน/.test(r)) return "ผู้สืบสันดาน";
  if (/บุตร|ลูก/.test(r)) return "บุตรชอบด้วยกฎหมาย";
  if (/ผู้สืบสันดาน/.test(r)) return "ผู้สืบสันดาน";
  if (/บิดา|มารดา|พ่อ|แม่|บุพการี/.test(r)) return "บุพการี";
  return "คนอื่น";
}

/** ค่าใน dropdown ผู้รับ — แปลงจากความสัมพันธ์ในแผนผัง เช่น บุตร → บุตรชอบด้วยกฎหมาย */
export type ReceiverRelationOption =
  | "คู่สมรส"
  | "บุตรชอบด้วยกฎหมาย"
  | "บุตรบุญธรรม"
  | "ผู้สืบสันดาน"
  | "บุพการี"
  | "อื่น ๆ";

export function toReceiverRelation(
  relation?: string | null,
): ReceiverRelationOption {
  const classified = classifyReceiverRelation(relation);
  switch (classified) {
    case "คู่สมรส":
    case "บุตรชอบด้วยกฎหมาย":
    case "บุตรบุญธรรม":
    case "ผู้สืบสันดาน":
    case "บุพการี":
      return classified;
    default:
      return "อื่น ๆ";
  }
}

/** ม.42(27) สังหาริมทรัพย์ — บุพการี ผู้สืบสันดาน คู่สมรส */
export function isRelatedMovableGiftClass(c: ReceiverTaxClass): boolean {
  return (
    c === "คู่สมรส" ||
    c === "บุตรชอบด้วยกฎหมาย" ||
    c === "บุตรบุญธรรม" ||
    c === "ผู้สืบสันดาน" ||
    c === "บุพการี"
  );
}

/** ม.42(26) อสังหา — บิดามารดาให้บุตรชอบด้วยกฎหมาย ยกเว้น 20 ลบ./คน/ปี */
export function isParentToLegitimateChild(c: ReceiverTaxClass): boolean {
  return c === "บุตรชอบด้วยกฎหมาย";
}

export function isAscendantOrDescendantOrSpouse(c: ReceiverTaxClass): boolean {
  return (
    c === "คู่สมรส" ||
    c === "บุตรชอบด้วยกฎหมาย" ||
    c === "บุตรบุญธรรม" ||
    c === "ผู้สืบสันดาน" ||
    c === "บุพการี"
  );
}

export function isDescendantOrAscendant(c: ReceiverTaxClass): boolean {
  return (
    c === "บุตรชอบด้วยกฎหมาย" ||
    c === "บุตรบุญธรรม" ||
    c === "ผู้สืบสันดาน" ||
    c === "บุพการี"
  );
}

export function resolveGiftBucket(input: {
  taxClass: ReceiverTaxClass;
  occasion?: GiftBucket | string | null;
}): GiftBucket {
  if (isRelatedMovableGiftClass(input.taxClass)) return "related";
  if (input.occasion === "customary") return "customary";
  return "none";
}

export function isRealEstate(category?: string, subtype?: string): boolean {
  const s = `${category ?? ""} ${subtype ?? ""}`;
  if (/หุ้น|กองทุน|เงินฝาก|พันธบัตร/.test(s)) return false;
  return /อสังหา|ที่ดิน|บ้าน|อาคาร|ห้องชุด|โรงงาน|คอนโด/.test(s);
}

export function classifyMovableSecurity(
  category?: string,
  subtype?: string,
): MovableSecurityKind {
  const s = `${category ?? ""} ${subtype ?? ""}`;
  if (/ดิจิทัล|crypto|token/i.test(s)) return "สินทรัพย์ดิจิทัล";
  if (/พันธบัตร|หุ้นกู้|ตั๋วเงิน/.test(s)) return "ตราสารหนี้";
  if (/กองทุน/.test(s)) return "กองทุน";
  if (/มหาชน|ตลาดหลักทรัพย์|ในตลาด|SET/i.test(s)) return "หุ้นในตลาด";
  if (/หุ้น|หุ้นส่วน|Holding|โฮลดิ้ง/.test(s)) return "หุ้นนอกตลาด";
  if (/เงินฝาก/.test(s)) return "เงินฝาก";
  if (/ทอง|พระ|ศิลปะ|ของสะสม|เครื่องประดับ/.test(s)) return "ทรัพย์สะสม";
  return "อื่น";
}

/**
 * ทรัพย์ห้ากลุ่มตาม พ.ร.บ.ภาษีการรับมรดก พ.ศ. 2558
 * อสังหา / หลักทรัพย์ / เงินฝาก / ยานพาหนะ — ดูชื่อทรัพย์ด้วยถ้าประเภทเป็นค่าทั่วไป
 */
export function isInheritanceTaxableAsset(
  category?: string,
  subtype?: string,
  name?: string,
): boolean {
  const s = `${category ?? ""} ${subtype ?? ""} ${name ?? ""}`;
  if (isRealEstate(category, subtype) || isRealEstate(name, undefined)) return true;
  if (/หุ้น|กองทุน|พันธบัตร|หุ้นกู้|หลักทรัพย์|โฮลดิ้ง|Holding|เงินฝาก/.test(s)) {
    return true;
  }
  if (/รถยนต์|รถจักรยานยนต์|ยานพาหนะ|เรือ|เครื่องบิน/.test(s)) return true;
  if (
    /ทอง|พระ|ศิลปะ|ของสะสม|เครื่องประดับ|เงินสด|ดิจิทัล|กรมธรรม์|ประกันชีวิต/.test(
      s,
    )
  ) {
    return false;
  }
  if (/ทรัพย์สินทางการเงิน/.test(s) && !/เงินสด/.test(s)) return true;
  return false;
}

export function isHoldingCompany(category?: string, subtype?: string): boolean {
  const s = `${category ?? ""} ${subtype ?? ""}`;
  return /Holding|โฮลดิ้ง|ถือหุ้น/.test(s);
}

export function isPersonalCollection(category?: string, subtype?: string): boolean {
  return classifyMovableSecurity(category, subtype) === "ทรัพย์สะสม";
}

export function maritalEstateFactor(status?: OwnershipStatus | string | null): number {
  if (status === "สินสมรส") return 0.5;
  return 1;
}
