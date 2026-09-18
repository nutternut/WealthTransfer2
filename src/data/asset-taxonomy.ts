/**
 * กลุ่มประเภททรัพย์สิน — ตามตารางกลุ่ม/ตัวอย่างของระบบ
 * (ใช้ร่วมกับฟิลด์เก็บข้อมูลใน ASSET MAPPING.xlsx)
 */

export const ASSET_CATEGORIES = [
  "อสังหาริมทรัพย์",
  "หุ้นส่วนบริษัท",
  "ทรัพย์สินทางการเงิน",
  "ทรัพย์สินอื่น",
] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export const ASSET_SUBTYPES: Record<AssetCategory, readonly string[]> = {
  อสังหาริมทรัพย์: [
    "ที่ดิน",
    "บ้าน",
    "อาคาร",
    "ห้องชุด",
    "โรงงาน",
    "อาคารพาณิชย์",
    "อสังหาริมทรัพย์เพื่อการลงทุน",
  ],
  หุ้นส่วนบริษัท: [
    "หุ้นบริษัทครอบครัว",
    "หุ้นบริษัทจำกัด",
    "หุ้นบริษัทมหาชนจำกัด",
    "หุ้น Holding",
  ],
  ทรัพย์สินทางการเงิน: [
    "เงินสด",
    "เงินฝาก",
    "พันธบัตร",
    "หุ้นกู้",
    "กองทุน",
    "เงินลงทุนอื่น",
    "สินทรัพย์ดิจิทัล",
  ],
  ทรัพย์สินอื่น: [
    "รถยนต์",
    "เรือ",
    "เครื่องบิน",
    "ทองคำ",
    "เครื่องประดับ",
    "พระเครื่อง",
    "งานศิลปะ",
    "ของสะสม",
    "กรมธรรม์",
    "สิทธิเรียกร้อง",
    "ทรัพย์สินทางปัญญา",
    "อื่น ๆ",
  ],
};

export const ASSET_CATEGORY_HINTS: Record<AssetCategory, string> = {
  อสังหาริมทรัพย์:
    "ที่ดิน, บ้าน, อาคาร, ห้องชุด, โรงงาน, อาคารพาณิชย์, อสังหาริมทรัพย์เพื่อการลงทุน",
  หุ้นส่วนบริษัท:
    "ต้องมีข้อมูลผู้ถือหุ้น/ผู้ถือกรรมสิทธิ์และสัดส่วน",
  ทรัพย์สินทางการเงิน:
    "เงินสด, เงินฝาก, พันธบัตร, หุ้นกู้, กองทุน, เงินลงทุนอื่น",
  ทรัพย์สินอื่น:
    "รถยนต์, เรือ, เครื่องบิน, ทองคำ, เครื่องประดับ, งานศิลปะ, ของสะสม, สิทธิเรียกร้อง, ทรัพย์สินทางปัญญา และอื่น ๆ",
};

export const OWNER_KINDS = ["บุคคลธรรมดา", "คนนอก", "นิติบุคคล"] as const;
export type OwnerKind = (typeof OWNER_KINDS)[number];

/** พิมพ์ชื่อเองได้ (ไม่เลือกจากสมาชิก) */
export function isFreeTextOwnerKind(kind: OwnerKind): boolean {
  return kind === "คนนอก" || kind === "นิติบุคคล";
}

/** ความสัมพันธ์ของผู้ถือกรรมสิทธิ์ (บุคคลธรรมดา) */
export const OWNER_RELATIONS = [
  "บุตรชอบด้วยกฎหมาย",
  "บิดา",
  "มารดา",
  "คู่สมรส",
  "อื่น ๆ",
] as const;

/** วิธีได้มา — อสังหาริมทรัพย์ */
export const REAL_ESTATE_METHODS = [
  "มรดก",
  "ได้รับให้โดยเสน่หา",
  "ซื้อหรือได้มาโดยทางอื่น",
] as const;

/** วิธีได้มา — ทั่วไป */
export const GENERAL_METHODS = [
  "ซื้อ",
  "ให้",
  "มรดก",
  "ก่อตั้ง/ได้รับจัดสรร",
  "อื่น ๆ",
] as const;

/** ผู้รับโอน */
export const RECEIVER_RELATIONS = [
  "คู่สมรส",
  "บุตรชอบด้วยกฎหมาย",
  "บุตรบุญธรรม",
  "ผู้สืบสันดาน",
  "บุพการี",
  "อื่น ๆ",
] as const;

export const OWNERSHIP_STATUSES = [
  "สินส่วนตัว",
  "สินสมรส",
  "กรรมสิทธิ์ร่วม",
  "นิติบุคคล",
] as const;

export function isAssetCategory(value: string): value is AssetCategory {
  return (ASSET_CATEGORIES as readonly string[]).includes(value);
}

export function methodsForCategory(category: AssetCategory): readonly string[] {
  if (category === "อสังหาริมทรัพย์") return REAL_ESTATE_METHODS;
  return GENERAL_METHODS;
}

export function displayTypeLabel(type: string, subtype?: string) {
  if (subtype) return `${type} · ${subtype}`;
  return type;
}
