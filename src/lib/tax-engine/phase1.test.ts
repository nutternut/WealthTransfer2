import { describe, expect, it } from "vitest";
import {
  areaToSqWa,
  landAssessedValue,
  sharesAtPar,
  sharesValueOrThrow,
} from "@/lib/tax-engine/valuation";
import {
  calculateTransferCosts,
  incrementalTax,
  inheritanceTaxBaseValue,
  shareStampBaht,
  stampDutyBaht,
  summarizeInheritanceTaxByReceiver,
  CUSTOMARY_GIFT_EXEMPT,
  RELATED_GIFT_EXEMPT,
} from "@/lib/transfer-cost";
import {
  isInheritanceTaxableAsset,
  toReceiverRelation,
} from "@/lib/tax-engine/classify";
import { applyAggregatedPlanTaxes, taxYearOf } from "@/lib/plan-tax";
import type { Asset, Member, PlanItem, Scenario } from "@/data/wealth-transfer";

describe("toReceiverRelation", () => {
  it("บุตรในแผนผัง → บุตรชอบด้วยกฎหมาย ใน dropdown", () => {
    expect(toReceiverRelation("บุตร")).toBe("บุตรชอบด้วยกฎหมาย");
    expect(toReceiverRelation("บุตรชอบด้วยกฎหมาย")).toBe(
      "บุตรชอบด้วยกฎหมาย",
    );
  });

  it("ไม่ใช้ค่าแรกของ select เมื่อความสัมพันธ์ไม่อยู่ในรายการ", () => {
    expect(toReceiverRelation("บุตร")).not.toBe("คู่สมรส");
    expect(toReceiverRelation("หลาน")).toBe("ผู้สืบสันดาน");
    expect(toReceiverRelation("พี่น้อง")).toBe("อื่น ๆ");
  });
});

describe("valuation", () => {
  it("ที่ดิน 2 ไร่ 1 งาน 50 ตารางวา = 950 ตารางวา", () => {
    expect(areaToSqWa(2, 1, 50)).toBe(950);
    expect(landAssessedValue(2, 1, 50, 20_000)).toBe(19_000_000);
  });

  it("หุ้น 10,000 × พาร์ 10 = 100,000", () => {
    expect(sharesAtPar(10_000, 10)).toBe(100_000);
  });

  it("ปฏิเสธสัดส่วน × ราคาพาร์ต่อหุ้น", () => {
    expect(() =>
      sharesValueOrThrow({
        ownershipPercent: 60,
        parValuePerShare: 10,
      }),
    ).toThrow(/สูตรหุ้นไม่ครบ/);
  });
});

describe("gift accumulator", () => {
  it("บิดาให้เงิน 12 ลบ. และมารดาให้ทอง 9 ลบ. = ภาษี 50,000", () => {
    const first = incrementalTax(0, 12_000_000, RELATED_GIFT_EXEMPT, 0.05);
    const second = incrementalTax(first.newTotal, 9_000_000, RELATED_GIFT_EXEMPT, 0.05);
    expect(second.newTotal).toBe(21_000_000);
    expect(second.incremental).toBe(50_000);
  });

  it("บุคคลอื่นตามประเพณี 5+6 ลบ. ใช้วงเงิน 10 ลบ.", () => {
    const first = incrementalTax(0, 5_000_000, CUSTOMARY_GIFT_EXEMPT, 0.05);
    const second = incrementalTax(first.newTotal, 6_000_000, CUSTOMARY_GIFT_EXEMPT, 0.05);
    expect(second.incremental).toBe(50_000);
  });

  it("บิดาให้อสังหาบุตรคนละคน 15 และ 10 ลบ. หัก 20 ล้านแยกกัน", () => {
    const a = calculateTransferCosts({
      method: "ให้",
      transferValue: 15_000_000,
      assessedValue: 15_000_000,
      costBasis: 0,
      assetCategory: "อสังหาริมทรัพย์",
      assetSubtype: "ที่ดิน",
      receivers: [{ name: "ลูก1", share: 100, taxClass: "บุตรชอบด้วยกฎหมาย" }],
    });
    const giftLineA = a.lines.find((l) => l.label.includes("จากการให้"));
    expect(giftLineA?.amount).toBe(0);
    const b = calculateTransferCosts({
      method: "ให้",
      transferValue: 10_000_000,
      assessedValue: 10_000_000,
      costBasis: 0,
      assetCategory: "อสังหาริมทรัพย์",
      assetSubtype: "ที่ดิน",
      receivers: [{ name: "ลูก2", share: 100, taxClass: "บุตรชอบด้วยกฎหมาย" }],
    });
    const giftLineB = b.lines.find((l) => l.label.includes("จากการให้"));
    expect(giftLineB?.amount).toBe(0);
  });

  it("บิดาให้อสังหาบุตรคนเดียวกัน 15 แล้ว 10 ลบ. รวมฐานผู้รับ 25 ลบ.", () => {
    const first = calculateTransferCosts({
      method: "ให้",
      transferValue: 15_000_000,
      assessedValue: 15_000_000,
      costBasis: 0,
      assetCategory: "อสังหาริมทรัพย์",
      assetSubtype: "ที่ดิน",
      receivers: [{ name: "ลูก1", share: 100, taxClass: "บุตรชอบด้วยกฎหมาย" }],
    });
    expect(first.lines.find((l) => l.label.includes("จากการให้"))?.amount).toBe(0);
    const second = calculateTransferCosts({
      method: "ให้",
      transferValue: 10_000_000,
      assessedValue: 10_000_000,
      costBasis: 0,
      assetCategory: "อสังหาริมทรัพย์",
      assetSubtype: "ที่ดิน",
      priorImmovableGiftTotal: 15_000_000,
      receivers: [{ name: "ลูก1", share: 100, taxClass: "บุตรชอบด้วยกฎหมาย" }],
    });
    expect(second.lines.find((l) => l.label.includes("จากการให้"))?.amount).toBe(
      250_000,
    );
  });

  it("ให้อสังหาบุตรชอบด้วยกฎหมาย 2 คน หัก 20 ล้านต่อคน แล้วคูณ 5%", () => {
    const costs = calculateTransferCosts({
      method: "ให้",
      transferValue: 895_000_000,
      assessedValue: 895_000_000,
      costBasis: 0,
      assetCategory: "อสังหาริมทรัพย์",
      assetSubtype: "อาคาร",
      receivers: [
        { name: "ก้องภพ", share: 50, taxClass: "บุตรชอบด้วยกฎหมาย" },
        { name: "ศัทยา", share: 50, taxClass: "บุตรชอบด้วยกฎหมาย" },
      ],
    });
    const giftLine = costs.lines.find((l) => l.label.includes("จากการให้"));
    expect(giftLine?.amount).toBe(42_750_000);
  });

  it("ให้ที่ดิน 180 ลบ. แก่บุตร 2 คน 5 ปี หารคนหารปีก่อนคิดฐาน — ภาษี 0", () => {
    const costs = calculateTransferCosts({
      method: "ให้",
      transferValue: 180_000_000,
      assessedValue: 180_000_000,
      costBasis: 0,
      assetCategory: "อสังหาริมทรัพย์",
      assetSubtype: "ที่ดิน",
      giftDurationYears: 5,
      receivers: [
        { name: "ลูก A", share: 50, taxClass: "บุตรชอบด้วยกฎหมาย" },
        { name: "ลูก B", share: 50, taxClass: "บุตรชอบด้วยกฎหมาย" },
      ],
    });
    const giftLine = costs.lines.find((l) => l.label.includes("จากการให้"));
    expect(giftLine?.amount).toBe(0);
  });

  it("ให้ที่ดิน 180 ลบ. แก่บุตร 1 คน 5 ปี ฐานปีละ 36 ลบ. ภาษี 4 ลบ.", () => {
    const costs = calculateTransferCosts({
      method: "ให้",
      transferValue: 180_000_000,
      assessedValue: 180_000_000,
      costBasis: 0,
      assetCategory: "อสังหาริมทรัพย์",
      assetSubtype: "ที่ดิน",
      giftDurationYears: 5,
      receivers: [
        { name: "ลูก A", share: 100, taxClass: "บุตรชอบด้วยกฎหมาย" },
      ],
    });
    const giftLine = costs.lines.find((l) => l.label.includes("จากการให้"));
    expect(giftLine?.amount).toBe(4_000_000);
  });

  it("วงเงินยกเว้นอสังหาเริ่มใหม่ทุกปี ไม่สะสมข้ามปี", () => {
    const costs = calculateTransferCosts({
      method: "ให้",
      transferValue: 180_000_000,
      assessedValue: 180_000_000,
      costBasis: 0,
      assetCategory: "อสังหาริมทรัพย์",
      assetSubtype: "ที่ดิน",
      giftDurationYears: 5,
      priorImmovableGiftTotal: 10_000_000,
      receivers: [
        { name: "ลูก A", share: 100, taxClass: "บุตรชอบด้วยกฎหมาย" },
      ],
    });
    const giftLine = costs.lines.find((l) => l.label.includes("จากการให้"));
    expect(giftLine?.amount).toBe(4_500_000);
  });
});

describe("inheritance", () => {
  it("รับ 60 และ 70 ลบ. จากเจ้ามรดกคนเดียวกัน รวม 130 ลบ. ภาษี 1.5 ลบ.", () => {
    const rows = summarizeInheritanceTaxByReceiver([
      {
        itemKey: "a",
        name: "ลูก",
        taxClass: "บุตรชอบด้วยกฎหมาย",
        portion: 60_000_000,
        decedentId: "พ่อ",
        inTaxBase: true,
      },
      {
        itemKey: "b",
        name: "ลูก",
        taxClass: "บุตรชอบด้วยกฎหมาย",
        portion: 70_000_000,
        decedentId: "พ่อ",
        inTaxBase: true,
      },
    ]);
    expect(rows[0]?.taxable).toBe(30_000_000);
    expect(rows[0]?.tax).toBe(1_500_000);
  });

  it("มรดกกองทุน+เงินฝาก+หุ้น รวมทั้งก้อน หัก 100 ลบ./คน แล้วคูณ 5%", () => {
    const result = applyAggregatedPlanTaxes({
      assets: [
        asset({
          id: "F1",
          name: "กองทุนรวมผสม",
          type: "ทรัพย์สินอื่น",
          subtype: "อื่น ๆ",
          value: 22_500_000,
        }),
        asset({
          id: "D1",
          name: "เงินฝากประจำธนาคาร",
          type: "ทรัพย์สินอื่น",
          subtype: "อื่น ๆ",
          value: 50_000_000,
        }),
        asset({
          id: "S1",
          name: "หุ้นบริษัทจดทะเบียนในตลาดหลักทรัพย์",
          type: "หุ้นส่วนบริษัท",
          subtype: "หุ้นบริษัทมหาชนจำกัด",
          value: 45_000_000,
        }),
        asset({
          id: "S2",
          name: "หุ้น บริษัท AB ฟู้ดส์ จำกัด",
          type: "หุ้นส่วนบริษัท",
          subtype: "หุ้นบริษัทจำกัด",
          value: 150_000_000,
        }),
      ],
      members: [member("คุณ C", "บุตร")],
      plan: [
        planItem({
          id: "P1",
          asset: "กองทุนรวมผสม",
          assetId: "F1",
          owner: "คุณ A",
          receiver: "คุณ C",
          method: "มรดก",
          year: "เมื่อรับมรดก",
        }),
        planItem({
          id: "P2",
          asset: "เงินฝากประจำธนาคาร",
          assetId: "D1",
          owner: "คุณ A",
          receiver: "คุณ C",
          method: "มรดก",
          year: "เมื่อรับมรดก",
        }),
        planItem({
          id: "P3",
          asset: "หุ้นบริษัทจดทะเบียนในตลาดหลักทรัพย์",
          assetId: "S1",
          owner: "คุณ A",
          receiver: "คุณ C",
          method: "มรดก",
          year: "เมื่อรับมรดก",
        }),
        planItem({
          id: "P4",
          asset: "หุ้น บริษัท AB ฟู้ดส์ จำกัด",
          assetId: "S2",
          owner: "คุณ A",
          receiver: "คุณ C",
          method: "มรดก",
          year: "เมื่อรับมรดก",
        }),
      ],
    });
    expect(result.inheritanceByReceiver[0]?.totalReceived).toBe(267_500_000);
    expect(result.inheritanceByReceiver[0]?.exempt).toBe(100_000_000);
    expect(result.inheritanceByReceiver[0]?.taxable).toBe(167_500_000);
    expect(result.totalInheritanceTax).toBe(8_375_000);
    const inheritYear = result.yearEstimates.find((y) => y.year === "เมื่อรับมรดก");
    expect(inheritYear?.inheritanceTax).toBe(8_375_000);
  });

  it("รับจากเจ้ามรดกต่างคนแยกฐาน", () => {
    const rows = summarizeInheritanceTaxByReceiver([
      {
        itemKey: "a",
        name: "ลูก",
        taxClass: "ผู้สืบสันดาน",
        portion: 80_000_000,
        decedentId: "พ่อ",
        inTaxBase: true,
      },
      {
        itemKey: "b",
        name: "ลูก",
        taxClass: "ผู้สืบสันดาน",
        portion: 80_000_000,
        decedentId: "แม่",
        inTaxBase: true,
      },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.tax === 0)).toBe(true);
  });

  it("คู่สมรสยกเว้นภาษีมรดก แต่ค่าโอนอสังหายัง 0.5%", () => {
    const costs = calculateTransferCosts({
      method: "มรดก",
      transferValue: 20_000_000,
      assessedValue: 20_000_000,
      costBasis: 0,
      assetCategory: "อสังหาริมทรัพย์",
      assetSubtype: "บ้าน",
      receivers: [{ name: "ภรรยา", share: 100, taxClass: "คู่สมรส" }],
    });
    const fee = costs.lines.find((l) => l.kind === "fee");
    const tax = costs.lines.find((l) => l.label.includes("มรดก"));
    expect(fee?.amount).toBe(100_000);
    expect(tax?.amount).toBe(0);
  });

  it("ทองคำไม่เข้าฐานภาษีมรดก", () => {
    expect(isInheritanceTaxableAsset("ทรัพย์สินอื่น", "ทองคำ")).toBe(false);
    expect(
      inheritanceTaxBaseValue({
        transferValue: 9_000_000,
        assessedValue: 9_000_000,
        assetCategory: "ทรัพย์สินอื่น",
        assetSubtype: "ทองคำ",
      }),
    ).toBe(0);
  });

  it("ชื่อกองทุนหรือเงินฝากเข้าฐานมรดกแม้ประเภทเป็นค่าทั่วไป", () => {
    expect(
      isInheritanceTaxableAsset("ทรัพย์สินอื่น", "อื่น ๆ", "กองทุนรวมผสม"),
    ).toBe(true);
    expect(
      isInheritanceTaxableAsset("ทรัพย์สินอื่น", "อื่น ๆ", "เงินฝากประจำธนาคาร"),
    ).toBe(true);
    expect(
      inheritanceTaxBaseValue({
        transferValue: 50_000_000,
        assessedValue: 50_000_000,
        assetCategory: "ทรัพย์สินอื่น",
        assetSubtype: "อื่น ๆ",
        assetName: "เงินฝากประจำธนาคาร",
      }),
    ).toBe(50_000_000);
  });
});

describe("sale duties", () => {
  it("อากรแสตมป์อสังหาเป็น ceil(ฐาน/200)", () => {
    expect(stampDutyBaht(1_000_000)).toBe(5_000);
  });

  it("อากรหุ้น 0.1% เป็น ceil(ฐาน/1000)", () => {
    expect(shareStampBaht(1_000_000)).toBe(1_000);
  });

  it("บริษัทขายอสังหาแสดง WHT เป็นเครดิต ไม่บวกซ้ำกับ CIT", () => {
    const costs = calculateTransferCosts({
      method: "ซื้อขาย",
      transferValue: 10_000_000,
      assessedValue: 10_000_000,
      costBasis: 4_000_000,
      assetCategory: "อสังหาริมทรัพย์",
      assetSubtype: "ที่ดิน",
      ownerIsJuristic: true,
    });
    const credit = costs.lines.find((l) => l.kind === "credit");
    const cit = costs.lines.find((l) => l.label.includes("นิติบุคคล"));
    expect(credit?.amount).toBe(100_000);
    expect(cit?.amount).toBe(1_100_000);
    expect(costs.total).toBe(costs.fees + costs.tax);
    expect(costs.total).not.toBe(costs.fees + costs.tax + costs.credits);
  });

  it("เสีย SBT แล้วไม่คิดอากรแสตมป์ซ้ำ", () => {
    const costs = calculateTransferCosts({
      method: "ซื้อขาย",
      transferValue: 10_000_000,
      assessedValue: 10_000_000,
      costBasis: 2_000_000,
      acquiredYear: "2567",
      transactionYear: "2569",
      assetCategory: "อสังหาริมทรัพย์",
      assetSubtype: "ที่ดิน",
      acquisitionMethod: "ซื้อหรือได้มาโดยทางอื่น",
    });
    const sbt = costs.lines.find((l) => l.label.includes("ธุรกิจเฉพาะ"));
    const stamp = costs.lines.find((l) => l.label.includes("อากรแสตมป์"));
    expect((sbt?.amount ?? 0) > 0).toBe(true);
    expect(stamp?.amount).toBe(0);
  });
});

describe("plan aggregation", () => {
  it("ดึงปีภาษีจากป้าย 2569 (1 ปี)", () => {
    expect(taxYearOf({ year: "2569 (1 ปี)" })).toBe("2569");
    expect(taxYearOf({ year: "2569-2571" })).toBe("2569");
  });

  it("รวมของให้หลายรายการในปีเดียวกันหลังมียอดก่อนหน้า", () => {
    const gold: Asset = {
      id: "G1",
      name: "ทอง",
      type: "ทรัพย์สินอื่น",
      subtype: "ทองคำ",
      owner: "แม่",
      share: 100,
      status: "มีแผนแล้ว",
      role: "เจ้าของ",
      value: 9_000_000,
      assessed: 9_000_000,
      acquired: "2560",
      method: "ซื้อ",
    };
    const result = applyAggregatedPlanTaxes({
      assets: [gold],
      members: [
        {
          id: "C1",
          name: "ลูก",
          gen: "รุ่นที่ 2",
          age: 30,
          relation: "บุตร",
          status: "มีชีวิต",
        },
      ],
      scenarios: [
        {
          id: "S1",
          asset: "ทอง",
          assetId: "G1",
          method: "ให้",
          year: "2569 (1 ปี)",
          receiver: "ลูก",
          tax: 0,
          fees: 0,
          total: 0,
          score: 0,
          status: "ตัวอย่าง",
          criteria: { taxEfficiency: 3, control: 3, liquidity: 3, readiness: 3 },
          receivers: [{ name: "ลูก", share: 100 }],
        } as unknown as Scenario,
      ],
      plan: [
        {
          id: "P1",
          asset: "ทอง",
          assetId: "G1",
          scenarioId: "S1",
          owner: "แม่",
          receiver: "ลูก",
          method: "ให้",
          share: "100%",
          year: "2569 (1 ปี)",
          cost: 0,
          status: "มีแผนแล้ว",
        },
      ],
      priorLedgers: [
        {
          kind: "related",
          party: "ลูก",
          taxYear: "2569",
          currentTotal: 12_000_000,
        },
      ],
    });
    expect(result.giftLedgers[0]?.total).toBe(21_000_000);
    expect(result.totalGiftTax).toBe(50_000);
    expect(result.giftLedgers[0]?.taxYear).toBe("2569");
  });

  it("ขายที่ดิน 5 แปลง รวมเท่ากับรายแปลง", () => {
    const plots: Asset[] = [1, 2, 3, 4, 5].map((i) => ({
      id: `L${i}`,
      name: `ที่ดิน ${i}`,
      type: "อสังหาริมทรัพย์",
      subtype: "ที่ดิน",
      owner: "พ่อ",
      share: 100,
      status: "มีแผนแล้ว",
      role: "เจ้าของ",
      value: i * 2_000_000,
      assessed: i * 2_000_000,
      acquired: "2560",
      method: "ซื้อ",
    }));
    const plan = plots.map((a) => ({
      id: a.id,
      asset: a.name,
      assetId: a.id,
      owner: "พ่อ",
      receiver: "ลูก",
      method: "ซื้อขาย",
      share: "100%",
      year: "2569",
      cost: 0,
      status: "มีแผนแล้ว",
    }));
    const grouped = applyAggregatedPlanTaxes({
      plan,
      assets: plots,
      members: [],
    });
    const separate = plots.map((a) =>
      calculateTransferCosts({
        method: "ซื้อขาย",
        transferValue: a.value ?? 0,
        assessedValue: a.assessed ?? 0,
        costBasis: 0,
        acquiredYear: "2560",
        transactionYear: "2569",
        assetCategory: "อสังหาริมทรัพย์",
        assetSubtype: "ที่ดิน",
        acquisitionMethod: "ซื้อหรือได้มาโดยทางอื่น",
      }),
    );
    const groupedTotal = grouped.plan.reduce((s, p) => s + p.cost, 0);
    const separateTotal = separate.reduce((s, p) => s + p.total, 0);
    expect(groupedTotal).toBe(separateTotal);
  });
});

function member(name: string, relation: string): Member {
  return {
    id: name,
    name,
    gen: "รุ่นที่ 2",
    age: 30,
    relation,
    status: "มีชีวิต",
  };
}

function asset(partial: Partial<Asset> & Pick<Asset, "id" | "name" | "type" | "value">): Asset {
  return {
    subtype: partial.subtype,
    owner: partial.owner ?? "พ่อ",
    share: 100,
    status: "มีแผนแล้ว",
    role: "เจ้าของ",
    assessed: partial.assessed ?? partial.value,
    acquired: "2560",
    method: "ซื้อ",
    ...partial,
  };
}

function planItem(
  partial: Pick<PlanItem, "id" | "asset" | "assetId" | "owner" | "receiver" | "method"> &
    Partial<PlanItem>,
): PlanItem {
  return {
    share: "100%",
    year: "2569",
    cost: 0,
    status: "มีแผนแล้ว",
    ...partial,
  };
}

describe("acceptance 17-9-69", () => {
  it("หุ้นบริษัท 10 ล้านบาท มีอากรแสตมป์ 1/1,000", () => {
    expect(shareStampBaht(10_000_000)).toBe(10_000);
    const costs = calculateTransferCosts({
      method: "ให้",
      transferValue: 10_000_000,
      assessedValue: 10_000_000,
      costBasis: 0,
      assetCategory: "หุ้นส่วนบริษัท",
      assetSubtype: "หุ้นบริษัทจำกัด",
      receivers: [{ name: "ลูก", share: 100, taxClass: "บุตรชอบด้วยกฎหมาย" }],
    });
    const stamp = costs.lines.find((l) => l.label.includes("อากรแสตมป์โอนหุ้น"));
    expect(stamp?.amount).toBe(10_000);
  });

  it("ให้หุ้นลูก A 25 ล้าน และลูก B 25 ล้าน หัก 20 ล้านแยกกัน", () => {
    const sharesA = asset({
      id: "SA",
      name: "หุ้น A",
      type: "หุ้นส่วนบริษัท",
      subtype: "หุ้นบริษัทจำกัด",
      value: 25_000_000,
    });
    const sharesB = asset({
      id: "SB",
      name: "หุ้น B",
      type: "หุ้นส่วนบริษัท",
      subtype: "หุ้นบริษัทจำกัด",
      value: 25_000_000,
    });
    const result = applyAggregatedPlanTaxes({
      assets: [sharesA, sharesB],
      members: [member("ลูก A", "บุตร"), member("ลูก B", "บุตร")],
      plan: [
        planItem({
          id: "P1",
          asset: sharesA.name,
          assetId: sharesA.id,
          owner: "พ่อ",
          receiver: "ลูก A",
          method: "ให้",
        }),
        planItem({
          id: "P2",
          asset: sharesB.name,
          assetId: sharesB.id,
          owner: "พ่อ",
          receiver: "ลูก B",
          method: "ให้",
        }),
      ],
    });
    expect(result.totalGiftTax).toBe(500_000);
    expect(result.giftLedgers).toHaveLength(2);
    expect(result.giftLedgers.every((g) => g.tax === 250_000)).toBe(true);
  });

  it("ให้ลูก A หุ้น 12 ล้าน + เงินฝาก 9 ล้าน รวม 21 ล้าน ภาษี 50,000", () => {
    const shares = asset({
      id: "S1",
      name: "หุ้น",
      type: "หุ้นส่วนบริษัท",
      subtype: "หุ้นบริษัทจำกัด",
      value: 12_000_000,
    });
    const deposit = asset({
      id: "D1",
      name: "เงินฝาก",
      type: "ทรัพย์สินทางการเงิน",
      subtype: "เงินฝาก",
      value: 9_000_000,
    });
    const result = applyAggregatedPlanTaxes({
      assets: [shares, deposit],
      members: [member("ลูก A", "บุตร")],
      plan: [
        planItem({
          id: "P1",
          asset: shares.name,
          assetId: shares.id,
          owner: "พ่อ",
          receiver: "ลูก A",
          method: "ให้",
        }),
        planItem({
          id: "P2",
          asset: deposit.name,
          assetId: deposit.id,
          owner: "พ่อ",
          receiver: "ลูก A",
          method: "ให้",
        }),
      ],
    });
    expect(result.giftLedgers[0]?.total).toBe(21_000_000);
    expect(result.totalGiftTax).toBe(50_000);
  });

  it("พ่อให้ที่ดินลูก A 15 ล้าน + ลูก B 10 ล้าน หัก 20 ล้านต่อคน ภาษี 0", () => {
    const landA = asset({
      id: "L1",
      name: "ที่ดิน A",
      type: "อสังหาริมทรัพย์",
      subtype: "ที่ดิน",
      value: 15_000_000,
    });
    const landB = asset({
      id: "L2",
      name: "ที่ดิน B",
      type: "อสังหาริมทรัพย์",
      subtype: "ที่ดิน",
      value: 10_000_000,
    });
    const result = applyAggregatedPlanTaxes({
      assets: [landA, landB],
      members: [member("ลูก A", "บุตร"), member("ลูก B", "บุตร")],
      plan: [
        planItem({
          id: "P1",
          asset: landA.name,
          assetId: landA.id,
          owner: "พ่อ",
          receiver: "ลูก A",
          method: "ให้",
        }),
        planItem({
          id: "P2",
          asset: landB.name,
          assetId: landB.id,
          owner: "พ่อ",
          receiver: "ลูก B",
          method: "ให้",
        }),
      ],
    });
    expect(result.yearEstimates[0]?.immovableGiftTax).toBe(0);
    expect(result.totalGiftTax).toBe(0);
  });

  it("แผนให้ที่ดิน 180 ลบ. บุตร 2 คน 5 ปี หารคนหารปี ภาษีการให้ 0", () => {
    const land = asset({
      id: "L180",
      name: "ที่ดิน",
      type: "อสังหาริมทรัพย์",
      subtype: "ที่ดิน",
      value: 180_000_000,
      assessed: 180_000_000,
    });
    const result = applyAggregatedPlanTaxes({
      assets: [land],
      members: [member("ลูก A", "บุตร"), member("ลูก B", "บุตร")],
      plan: [
        planItem({
          id: "P1",
          asset: land.name,
          assetId: land.id,
          owner: "พ่อ",
          receiver: "ลูก A + ลูก B",
          method: "ให้",
          year: "2569 (5 ปี)",
        }),
      ],
    });
    expect(result.totalGiftTax).toBe(0);
  });

  it("พ่อให้ที่ดินลูก A 15 ล้าน และแม่ให้ที่ดินลูก A 15 ล้าน แยกฐานผู้โอน", () => {
    const fromDad = asset({
      id: "L1",
      name: "ที่ดินพ่อ",
      type: "อสังหาริมทรัพย์",
      subtype: "ที่ดิน",
      owner: "พ่อ",
      value: 15_000_000,
    });
    const fromMom = asset({
      id: "L2",
      name: "ที่ดินแม่",
      type: "อสังหาริมทรัพย์",
      subtype: "ที่ดิน",
      owner: "แม่",
      value: 15_000_000,
    });
    const result = applyAggregatedPlanTaxes({
      assets: [fromDad, fromMom],
      members: [member("ลูก A", "บุตร")],
      plan: [
        planItem({
          id: "P1",
          asset: fromDad.name,
          assetId: fromDad.id,
          owner: "พ่อ",
          receiver: "ลูก A",
          method: "ให้",
        }),
        planItem({
          id: "P2",
          asset: fromMom.name,
          assetId: fromMom.id,
          owner: "แม่",
          receiver: "ลูก A",
          method: "ให้",
        }),
      ],
    });
    expect(result.totalGiftTax).toBe(0);
    expect(result.giftLedgers).toHaveLength(2);
  });

  it("ให้ที่ดินแก่คู่สมรสและหลาน ห้ามหัก 20 ล้าน", () => {
    const toSpouse = calculateTransferCosts({
      method: "ให้",
      transferValue: 25_000_000,
      assessedValue: 25_000_000,
      costBasis: 0,
      acquiredYear: "2550",
      transactionYear: "2569",
      assetCategory: "อสังหาริมทรัพย์",
      assetSubtype: "ที่ดิน",
      receivers: [{ name: "คู่สมรส", share: 100, taxClass: "คู่สมรส" }],
    });
    const toGrandchild = calculateTransferCosts({
      method: "ให้",
      transferValue: 25_000_000,
      assessedValue: 25_000_000,
      costBasis: 0,
      acquiredYear: "2550",
      transactionYear: "2569",
      assetCategory: "อสังหาริมทรัพย์",
      assetSubtype: "ที่ดิน",
      receivers: [{ name: "หลาน", share: 100, taxClass: "ผู้สืบสันดาน" }],
    });
    expect(toSpouse.lines.some((l) => l.code === "GENERAL_REAL_ESTATE_TRANSFER")).toBe(
      true,
    );
    expect(toGrandchild.lines.some((l) => l.code === "GENERAL_REAL_ESTATE_TRANSFER")).toBe(
      true,
    );
    const spouseGift5 = toSpouse.lines.find((l) => l.label === "ภาษีเงินได้จากการให้");
    expect(spouseGift5?.amount).toBe(0);
  });

  it("ยอดประมาณการปีเดียวกันรวมฐานการให้ ไม่บวกมูลค่าทรัพย์", () => {
    const car = asset({
      id: "C1",
      name: "รถยนต์",
      type: "ทรัพย์สินอื่น",
      subtype: "รถยนต์",
      value: 7_500_000,
    });
    const bond = asset({
      id: "B1",
      name: "พันธบัตร",
      type: "ทรัพย์สินทางการเงิน",
      subtype: "พันธบัตร",
      value: 40_000_000,
    });
    const fund = asset({
      id: "F1",
      name: "กองทุน",
      type: "ทรัพย์สินทางการเงิน",
      subtype: "กองทุน",
      value: 12_000_000,
    });
    const result = applyAggregatedPlanTaxes({
      assets: [car, bond, fund],
      members: [member("ก้องภพ", "บุตร")],
      plan: [car, bond, fund].map((a) =>
        planItem({
          id: a.id,
          asset: a.name,
          assetId: a.id,
          owner: "พ่อ",
          receiver: "ก้องภพ",
          method: "ให้",
        }),
      ),
    });
    const year = result.yearEstimates.find((y) => y.year === "2569");
    expect(year?.movableGiftTax).toBe(1_975_000);
    expect(year?.total).toBeLessThan(10_000_000);
    expect(year?.total).not.toBe(59_500_000);
  });

  it("มรดก 60 แล้ว 70 ล้านจากเจ้ามรดกคนเดียว ภาษีส่วนเพิ่มไปปีหลัง", () => {
    const first = asset({
      id: "I1",
      name: "บ้าน",
      type: "อสังหาริมทรัพย์",
      subtype: "บ้าน",
      value: 60_000_000,
    });
    const second = asset({
      id: "I2",
      name: "ที่ดิน",
      type: "อสังหาริมทรัพย์",
      subtype: "ที่ดิน",
      value: 70_000_000,
    });
    const result = applyAggregatedPlanTaxes({
      assets: [first, second],
      members: [member("ลูก A", "บุตร")],
      plan: [
        planItem({
          id: "P1",
          asset: first.name,
          assetId: first.id,
          owner: "พ่อ",
          receiver: "ลูก A",
          method: "มรดก",
          year: "2569",
        }),
        planItem({
          id: "P2",
          asset: second.name,
          assetId: second.id,
          owner: "พ่อ",
          receiver: "ลูก A",
          method: "มรดก",
          year: "2570",
        }),
      ],
    });
    const y2569 = result.yearEstimates.find((y) => y.year === "2569");
    const y2570 = result.yearEstimates.find((y) => y.year === "2570");
    expect(y2569?.inheritanceTax).toBe(0);
    expect(y2570?.inheritanceTax).toBe(1_500_000);
    expect(result.totalInheritanceTax).toBe(1_500_000);
  });

  it("รับมรดกจากพ่อ 80 ล้าน + แม่ 80 ล้าน แยกฐาน", () => {
    const fromDad = asset({
      id: "I1",
      name: "ที่ดินพ่อ",
      type: "อสังหาริมทรัพย์",
      subtype: "ที่ดิน",
      owner: "พ่อ",
      value: 80_000_000,
    });
    const fromMom = asset({
      id: "I2",
      name: "ที่ดินแม่",
      type: "อสังหาริมทรัพย์",
      subtype: "ที่ดิน",
      owner: "แม่",
      value: 80_000_000,
    });
    const result = applyAggregatedPlanTaxes({
      assets: [fromDad, fromMom],
      members: [member("ลูก A", "บุตร")],
      plan: [
        planItem({
          id: "P1",
          asset: fromDad.name,
          assetId: fromDad.id,
          owner: "พ่อ",
          receiver: "ลูก A",
          method: "มรดก",
        }),
        planItem({
          id: "P2",
          asset: fromMom.name,
          assetId: fromMom.id,
          owner: "แม่",
          receiver: "ลูก A",
          method: "มรดก",
        }),
      ],
    });
    expect(result.totalInheritanceTax).toBe(0);
    expect(result.inheritanceByReceiver).toHaveLength(2);
  });
});

