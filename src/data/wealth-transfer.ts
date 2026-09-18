import type { AssetCategory, OwnerKind } from "@/data/asset-taxonomy";

export type AssetStatus =
  | "ยังไม่ได้วางแผน"
  | "มีแผนแล้ว"
  | "อยู่ระหว่างวางแผน";

/** ผู้ถือกรรมสิทธิ์หนึ่งรายการ (รองรับถือร่วม) */
export type AssetOwnerEntry = {
  ownerKind: OwnerKind;
  /** ชื่อแสดง (สมาชิก / คนนอก / นิติบุคคล) */
  owner: string;
  share: number;
};

/**
 * โครงสร้างข้อมูลทรัพย์สิน — สอดคล้อง sheet INPUT ใน ASSET MAPPING.xlsx
 * ฟิลด์เฉพาะประเภทเก็บเป็น optional ตามหมวด
 */
export type Asset = {
  id: string;
  name: string;
  /** ประเภทหลัก: อสังหาริมทรัพย์ | หุ้นส่วนบริษัท | ทรัพย์สินทางการเงิน | ทรัพย์สินอื่น */
  type: AssetCategory | string;
  /** ประเภทย่อย เช่น ที่ดิน, หุ้นบริษัทจำกัด, กองทุน, รถยนต์ */
  subtype?: string;
  /** รายละเอียดเพิ่มเติม */
  detail?: string;
  owner: string;
  ownerKind?: OwnerKind;
  /** ผู้ถือทั้งหมด (ถือร่วม) — ถ้ามีมากกว่า 1 คน */
  owners?: AssetOwnerEntry[];
  /** มูลค่าตลาด (บาท) — ว่างได้ */
  value?: number;
  share: number;
  status: AssetStatus;
  role: string;
  /** ราคาประเมิน (บาท) — ว่างได้ */
  assessed?: number;
  /** ต้นทุน (บาท) — ว่างได้ */
  cost?: number;
  /** ปีที่ถือครอง / ได้มา */
  acquired: string;
  method: string;
  /** ปีที่โอน (ถ้ามี) */
  transferYear?: string;
  /** เนื้อที่ (ไร่, งาน, ตารางวา) — อสังหา */
  area?: string;
  /** ราคาประเมินต่อตารางวา — อสังหา */
  assessedPerSqWa?: number;
  /** ทุนจดทะเบียน — หุ้น */
  registeredCapital?: number;
  /** มูลค่าหุ้น (ราคาพาร์) */
  parValue?: number;
  /** มูลค่าหุ้น (Book Value) */
  bookValue?: number;
  /** หมายเหตุตอนบันทึก */
  note?: string;
  /** ผู้รับโอนที่ตั้งใจ (ถ้าระบุตอนเก็บข้อมูล) */
  intendedReceiver?: string;
  /** สินส่วนตัว / สินสมรส / กรรมสิทธิ์ร่วม / นิติบุคคล */
  ownershipStatus?: string;
  /** รหัสทรัพย์จาก template (ห้ามเปลี่ยนหลังนำเข้า) */
  assetCode?: string;
};

export type Member = {
  id: string;
  name: string;
  gen: string;
  age: number;
  relation: string;
  status: string;
  /** รหัสพ่อ/แม่ (รุ่นก่อนหน้า) */
  parentIds?: string[];
  /** รหัสคู่สมรส (รุ่นเดียวกัน) */
  partnerId?: string;
};

export type Entity = {
  id: string;
  name: string;
  kind: string;
  value: number;
  shareholders: string;
};

export type ScenarioCriteria = {
  /** ประสิทธิภาพภาษี 1–5 */
  taxEfficiency: number;
  /** รักษาการควบคุม 1–5 */
  control: number;
  /** สภาพคล่อง 1–5 */
  liquidity: number;
  /** ความพร้อมส่งต่อ 1–5 */
  readiness: number;
};

export type Scenario = {
  id: string;
  asset: string;
  /** รหัสทรัพย์สินในฐานข้อมูล */
  assetId?: string;
  method: string;
  year: string;
  receiver: string;
  tax: number;
  fees: number;
  total: number;
  score: number;
  status: string;
  criteria: ScenarioCriteria;
  /** สัดส่วนที่โอน (%) — จาก wizard */
  transferShare?: number;
  marketValue?: number;
  receivers?: {
    name: string;
    share: number;
    memberId?: string;
    relation?: string;
    taxClass?: string;
    occasion?: "customary" | "none";
  }[];
};

export type PlanItem = {
  id?: string;
  asset: string;
  assetId?: string;
  scenarioId?: string;
  owner: string;
  receiver: string;
  method: string;
  share: string;
  year: string;
  cost: number;
  status: string;
};

export type AuditLog = {
  at: string;
  user: string;
  item: string;
  change: string;
  category: string;
};

export type TaxRuleStatus = "ใช้งาน" | "ร่าง" | "หมดอายุ";

export type TaxRule = {
  id: string;
  name: string;
  category: string;
  threshold: string;
  rate: string;
  status: TaxRuleStatus;
  version: string;
  effectiveFrom: string;
  source: string;
};

export const assets: Asset[] = [
  {
    id: "A-001",
    name: "ที่ดินสุขุมวิท",
    type: "อสังหาริมทรัพย์",
    subtype: "ที่ดิน",
    detail: "ที่ดินเปล่า ทำเลสุขุมวิท",
    owner: "คุณสมชาย",
    ownerKind: "บุคคลธรรมดา",
    value: 120,
    share: 100,
    status: "ยังไม่ได้วางแผน",
    role: "ทรัพย์สินหลักครอบครัว",
    assessed: 85,
    cost: 22,
    acquired: "2545",
    method: "ซื้อหรือได้มาโดยทางอื่น",
    area: "2-1-20",
    assessedPerSqWa: 0.35,
  },
  {
    id: "A-002",
    name: "หุ้น บริษัท เอ บิสซิเนส จำกัด",
    type: "หุ้นส่วนบริษัท",
    subtype: "หุ้นบริษัทจำกัด",
    detail: "บริษัท เอ บิสซิเนส จำกัด",
    owner: "คุณสมชาย",
    ownerKind: "บุคคลธรรมดา",
    value: 520,
    share: 68,
    status: "มีแผนแล้ว",
    role: "ธุรกิจหลัก",
    assessed: 480,
    cost: 25,
    acquired: "2538",
    method: "ก่อตั้ง/ได้รับจัดสรร",
    registeredCapital: 100,
    parValue: 100,
    bookValue: 420,
    intendedReceiver: "คุณอนันต์ + คุณอร",
  },
  {
    id: "A-003",
    name: "อาคารสำนักงานสีลม",
    type: "อสังหาริมทรัพย์",
    subtype: "อาคารพาณิชย์",
    detail: "อาคารสำนักงานให้เช่า ย่านสีลม",
    owner: "คุณสุดา",
    ownerKind: "บุคคลธรรมดา",
    value: 210,
    share: 100,
    status: "อยู่ระหว่างวางแผน",
    role: "ทรัพย์สินสร้างรายได้",
    assessed: 160,
    cost: 65,
    acquired: "2552",
    method: "ซื้อหรือได้มาโดยทางอื่น",
    area: "0-2-15",
    assessedPerSqWa: 0.85,
  },
  {
    id: "A-004",
    name: "พอร์ตหุ้นจดทะเบียน",
    type: "ทรัพย์สินทางการเงิน",
    subtype: "เงินลงทุนอื่น",
    detail: "พอร์ตหุ้น SET / mai",
    owner: "คุณสุดา",
    ownerKind: "บุคคลธรรมดา",
    value: 180,
    share: 100,
    status: "ยังไม่ได้วางแผน",
    role: "การลงทุน",
    assessed: 180,
    cost: 110,
    acquired: "2564",
    method: "ซื้อ",
  },
  {
    id: "A-005",
    name: "เงินฝากและตราสารหนี้",
    type: "ทรัพย์สินทางการเงิน",
    subtype: "เงินฝาก",
    detail: "เงินฝากออมทรัพย์และตราสารหนี้ระยะสั้น",
    owner: "คุณสมชาย",
    ownerKind: "บุคคลธรรมดา",
    value: 95,
    share: 100,
    status: "ยังไม่ได้วางแผน",
    role: "สภาพคล่อง",
    assessed: 95,
    cost: 95,
    acquired: "-",
    method: "อื่น ๆ",
  },
];

export const members: Member[] = [
  {
    id: "M1",
    name: "คุณสมชาย",
    gen: "รุ่นที่ 1",
    age: 72,
    relation: "เจ้าของหลัก",
    status: "มีชีวิต",
    partnerId: "M2",
  },
  {
    id: "M2",
    name: "คุณสุดา",
    gen: "รุ่นที่ 1",
    age: 69,
    relation: "คู่สมรส",
    status: "มีชีวิต",
    partnerId: "M1",
  },
  {
    id: "M3",
    name: "คุณอนันต์",
    gen: "รุ่นที่ 2",
    age: 44,
    relation: "บุตร",
    status: "มีชีวิต",
    parentIds: ["M1", "M2"],
  },
  {
    id: "M4",
    name: "คุณอร",
    gen: "รุ่นที่ 2",
    age: 41,
    relation: "บุตร",
    status: "มีชีวิต",
    parentIds: ["M1", "M2"],
  },
  {
    id: "M5",
    name: "เด็กชายธนา",
    gen: "รุ่นที่ 3",
    age: 14,
    relation: "หลาน",
    status: "มีชีวิต",
    parentIds: ["M3"],
  },
];

export const entities: Entity[] = [
  {
    id: "E-001",
    name: "บริษัท เอ บิสซิเนส จำกัด",
    kind: "บริษัทดำเนินธุรกิจ",
    value: 765,
    shareholders: "คุณสมชาย 68% / คุณอนันต์ 16% / คุณอร 16%",
  },
  {
    id: "E-002",
    name: "บริษัท แฟมิลี่ โฮลดิ้ง จำกัด",
    kind: "บริษัทโฮลดิ้ง",
    value: 0,
    shareholders: "อยู่ระหว่างออกแบบ",
  },
  {
    id: "E-003",
    name: "บริษัท พร็อพเพอร์ตี้ พลัส จำกัด",
    kind: "บริษัทดำเนินธุรกิจ",
    value: 320,
    shareholders: "คุณสุดา 55% / คุณสมชาย 45%",
  },
  {
    id: "E-004",
    name: "บริษัท อินเวสต์เมนท์ อาร์ม จำกัด",
    kind: "บริษัทโฮลดิ้ง",
    value: 210,
    shareholders: "คุณสมชาย 40% / คุณสุดา 40% / คุณอนันต์ 20%",
  },
  {
    id: "E-005",
    name: "ห้างหุ้นส่วนจำกัด สยามเทรด",
    kind: "ห้างหุ้นส่วนจำกัด",
    value: 48,
    shareholders: "คุณอนันต์ 60% / คุณอร 40%",
  },
  {
    id: "E-006",
    name: "มูลนิธิครอบครัวสมชาย",
    kind: "มูลนิธิ",
    value: 35,
    shareholders: "อยู่ระหว่างออกแบบ",
  },
  {
    id: "E-007",
    name: "บริษัท กรีนเอนเนอร์จี จำกัด",
    kind: "บริษัทดำเนินธุรกิจ",
    value: 125,
    shareholders: "คุณอนันต์ 51% / คุณสมชาย 49%",
  },
  {
    id: "E-008",
    name: "บริษัท ซีเครท เรสซิเดนซ์ จำกัด",
    kind: "บริษัทดำเนินธุรกิจ",
    value: 180,
    shareholders: "คุณสุดา 70% / คุณอร 30%",
  },
  {
    id: "E-009",
    name: "บริษัท เน็กซ์เจน โฮลดิ้ง จำกัด",
    kind: "บริษัทโฮลดิ้ง",
    value: 0,
    shareholders: "อยู่ระหว่างออกแบบ",
  },
  {
    id: "E-010",
    name: "บริษัท แอสเซท แมเนจเมนต์ จำกัด",
    kind: "บริษัทดำเนินธุรกิจ",
    value: 92,
    shareholders: "คุณสมชาย 34% / คุณสุดา 33% / คุณอนันต์ 33%",
  },
];

export const scenarios: Scenario[] = [
  {
    id: "S-001",
    asset: "ที่ดินสุขุมวิท",
    method: "ให้",
    year: "2569",
    receiver: "คุณอนันต์",
    tax: 3.1,
    fees: 0.43,
    total: 3.53,
    score: 4.2,
    status: "คำนวณแล้ว",
    criteria: {
      taxEfficiency: 4,
      control: 2,
      liquidity: 4,
      readiness: 5,
    },
  },
  {
    id: "S-002",
    asset: "ที่ดินสุขุมวิท",
    method: "ซื้อขาย",
    year: "2569",
    receiver: "คุณอนันต์",
    tax: 7.8,
    fees: 2.4,
    total: 10.2,
    score: 3.2,
    status: "คำนวณแล้ว",
    criteria: {
      taxEfficiency: 2,
      control: 2,
      liquidity: 1,
      readiness: 5,
    },
  },
  {
    id: "S-003",
    asset: "ที่ดินสุขุมวิท",
    method: "มรดก",
    year: "ภายหลัง",
    receiver: "คุณอนันต์",
    tax: 1.0,
    fees: 0.43,
    total: 1.43,
    score: 3.8,
    status: "คำนวณแล้ว",
    criteria: {
      taxEfficiency: 5,
      control: 5,
      liquidity: 4,
      readiness: 2,
    },
  },
];

export const plan: PlanItem[] = [
  {
    asset: "หุ้น บริษัท เอ บิสซิเนส จำกัด",
    owner: "คุณสมชาย",
    receiver: "คุณอนันต์ + คุณอร",
    method: "ทยอยให้",
    share: "30%",
    year: "2569–2571",
    cost: 4.8,
    status: "เลือกเข้าสู่แผนแล้ว",
  },
  {
    asset: "ที่ดินสุขุมวิท",
    owner: "คุณสมชาย",
    receiver: "คุณอนันต์",
    method: "ให้",
    share: "100%",
    year: "2569",
    cost: 3.53,
    status: "เลือกเข้าสู่แผนแล้ว",
  },
];

export const taxRules: TaxRule[] = [
  {
    id: "TR-GIFT-01",
    name: "การให้ บุพการี/ผู้สืบสันดาน",
    category: "การให้",
    threshold: "20 ล้านบาท/ปี",
    rate: "ตามกฎ",
    status: "ใช้งาน",
    version: "TH-2569.09",
    effectiveFrom: "01/09/2569",
    source: "พ.ร.บ.ภาษีเงินได้ฯ / กรมสรรพากร",
  },
  {
    id: "TR-GIFT-02",
    name: "การให้ บุคคลอื่น",
    category: "การให้",
    threshold: "10 ล้านบาท/ปี",
    rate: "ตามกฎ",
    status: "ใช้งาน",
    version: "TH-2569.09",
    effectiveFrom: "01/09/2569",
    source: "พ.ร.บ.ภาษีเงินได้ฯ / กรมสรรพากร",
  },
  {
    id: "TR-INH-01",
    name: "การรับมรดก ผู้สืบสันดาน",
    category: "มรดก",
    threshold: "เกิน 100 ล้านบาท",
    rate: "5%",
    status: "ใช้งาน",
    version: "TH-2569.09",
    effectiveFrom: "01/09/2569",
    source: "พ.ร.บ.ภาษีการรับมรดก พ.ศ. 2558",
  },
  {
    id: "TR-LAND-01",
    name: "ค่าธรรมเนียมโอนอสังหาริมทรัพย์",
    category: "อสังหาริมทรัพย์",
    threshold: "ตามฐานกฎหมาย",
    rate: "ตามกฎ",
    status: "ใช้งาน",
    version: "TH-2569.09",
    effectiveFrom: "01/09/2569",
    source: "กรมที่ดิน / อากรแสตมป์",
  },
];

export const auditLogs: AuditLog[] = [
  {
    at: "09/09/2569 14:42",
    user: "PM FAMZ",
    item: "Scenario S-004",
    change: "คำนวณใหม่",
    category: "TH-2569.09",
  },
  {
    at: "09/09/2569 14:31",
    user: "PM FAMZ",
    item: "A-001 ราคาตลาด",
    change: "100 → 120 ลบ.",
    category: "ข้อมูลทรัพย์สิน",
  },
  {
    at: "09/09/2569 13:58",
    user: "Admin",
    item: "TR-GIFT-01",
    change: "อนุมัติรุ่นใหม่",
    category: "กฎภาษี",
  },
  {
    at: "08/09/2569 16:20",
    user: "Advisor",
    item: "Transfer Plan v3",
    change: "เพิ่มรายการหุ้น",
    category: "แผน",
  },
];

export type TimelineEvent = {
  /** ใช้เป็น React key — ต้องไม่ซ้ำในปีเดียวกัน */
  id?: string;
  title: string;
  method: string;
  receiver?: string;
  detail?: string;
  /** มูลค่าส่งต่อของรายการ (บาท) — แบ่งตามปีถ้ามีหลายงวด */
  value?: number;
};

export type TimelineYear = {
  year: string;
  amount: number;
  percent: number;
  events: TimelineEvent[];
  /** งานเตรียมก่อนถึงปีดำเนินการ */
  prep: string[];
};

/** แผนตามช่วงเวลาจาก prototype — จัดกลุ่มธุรกรรมและภาระรายปี */
export const timelineSchedule: TimelineYear[] = [
  {
    year: "2569",
    amount: 5.1,
    percent: 62,
    events: [
      {
        title: "ให้ที่ดินสุขุมวิท",
        method: "ให้",
        receiver: "คุณอนันต์",
      },
      {
        title: "ทยอยให้หุ้น บริษัท เอ บิสซิเนส จำกัด",
        method: "ทยอยให้",
        detail: "งวดที่ 1",
        receiver: "คุณอนันต์ + คุณอร",
      },
    ],
    prep: [
      "เตรียมเอกสารโอนที่ดินและประเมินราคา",
      "วางแผนสภาพคล่องสำหรับภาษีและค่าธรรมเนียม",
      "นัดหมายทนาย/ที่ปรึกษาภาษีก่อนไตรมาส 4",
    ],
  },
  {
    year: "2570",
    amount: 1.6,
    percent: 20,
    events: [
      {
        title: "ทยอยให้หุ้น บริษัท เอ บิสซิเนส จำกัด",
        method: "ทยอยให้",
        detail: "งวดที่ 2",
        receiver: "คุณอนันต์ + คุณอร",
      },
    ],
    prep: ["ทบทวนสัดส่วนถือหุ้นหลังงวดที่ 1", "เตรียมงบประมาณภาษีงวดถัดไป"],
  },
  {
    year: "2571",
    amount: 1.6,
    percent: 20,
    events: [
      {
        title: "ทยอยให้หุ้น บริษัท เอ บิสซิเนส จำกัด",
        method: "ทยอยให้",
        detail: "งวดที่ 3",
        receiver: "คุณอนันต์ + คุณอร",
      },
      {
        title: "ทบทวน Ownership และโครงสร้างควบคุม",
        method: "ทบทวน",
        detail: "ปิดรอบการทยอยให้",
      },
    ],
    prep: ["อัปเดตสมุดทะเบียนผู้ถือหุ้น", "สรุปผลแผนและส่งออกรายงานครอบครัว"],
  },
];

/** ค่าใช้จ่ายตามปี — derive จาก timeline เพื่อใช้ร่วมกับหน้าแผน */
export const yearlyCosts = timelineSchedule.map(({ year, amount, percent }) => ({
  year,
  amount,
  percent,
}));

/** สัดส่วนประเภททรัพย์สิน — ตามกลุ่มอสังหา / หุ้นส่วนบริษัท / ทางการเงิน / อื่น */
export const assetTypeShares = [
  { label: "หุ้นส่วนบริษัท", percent: 37, color: "#1B3A5C" },
  { label: "อสังหาริมทรัพย์", percent: 34, color: "#3A5F8A" },
  { label: "ทรัพย์สินทางการเงิน", percent: 29, color: "#6B8BB0" },
];

export const generationShares = [
  { label: "รุ่นที่ 1", percent: 82 },
  { label: "รุ่นที่ 2", percent: 18 },
];

export const plannedValue = 640;
export const plannedCost = 8.33;
