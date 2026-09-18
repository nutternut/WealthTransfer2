import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseImportWorkbook } from "@/lib/import/excel-parse";
import {
  SIMPLE_ASSET_HEADERS,
  buildAssetImportTemplate,
} from "@/lib/import/excel-template";

function workbook(sheets: Record<string, Record<string, unknown>[]>) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
  }
  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

function aoaWorkbook(sheets: Record<string, unknown[][]>) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

describe("excel import", () => {
  it("กรอกแค่ชื่อทรัพย์สิน ก็นำเข้าได้", () => {
    const buffer = workbook({
      ทรัพย์สิน: [{ ชื่อทรัพย์สิน: "บ้านทดลอง" }],
    });
    const preview = parseImportWorkbook(buffer);
    expect(preview.blockingCount).toBe(0);
    expect(preview.passCount).toBe(1);
    expect(preview.assets[0]?.canImport).toBe(true);
    expect(preview.assets[0]?.name).toBe("บ้านทดลอง");
    expect(preview.assets[0]?.assetType).toBe("อื่น ๆ");
    expect(preview.assets[0]?.ownerId).toBe("");
    expect(preview.assets[0]?.ownershipPercent).toBe(100);
  });

  it("กรอกชื่อ ประเภท เจ้าของ ก็นำเข้าได้", () => {
    const buffer = workbook({
      ทรัพย์สิน: [
        {
          "ชื่อทรัพย์สิน": "บ้านทดลอง",
          "ประเภท": "บ้าน",
          "เจ้าของ": "สมชาย",
        },
      ],
    });
    const preview = parseImportWorkbook(buffer);
    expect(preview.blockingCount).toBe(0);
    expect(preview.passCount).toBe(1);
    expect(preview.assets[0]?.canImport).toBe(true);
    expect(preview.assets[0]?.ownerId).toBe("สมชาย");
  });

  it("แบบฟอร์มที่ดาวน์โหลดจากระบบ อัปกลับได้เลย", () => {
    const book = buildAssetImportTemplate();
    expect(book.SheetNames).toEqual(["ทรัพย์สิน"]);
    const headers = XLSX.utils.sheet_to_json<string[]>(book.Sheets["ทรัพย์สิน"]!, {
      header: 1,
    })[0];
    expect(headers).toEqual([...SIMPLE_ASSET_HEADERS]);
    XLSX.utils.sheet_add_aoa(
      book.Sheets["ทรัพย์สิน"]!,
      [
        [
          "A1",
          "อสังหาริมทรัพย์",
          "บ้าน",
          "บ้านทดลอง",
          "",
          "บุคคลธรรมดา",
          "สมชาย",
          100,
          3_000_000,
        ],
      ],
      { origin: "A2" },
    );
    const buffer = XLSX.write(book, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    const preview = parseImportWorkbook(buffer);
    expect(preview.passCount).toBe(1);
    expect(preview.assets[0]?.name).toBe("บ้านทดลอง");
    expect(preview.assets[0]?.category).toBe("อสังหาริมทรัพย์");
    expect(preview.assets[0]?.subtype).toBe("บ้าน");
    expect(preview.assets[0]?.ownerId).toBe("สมชาย");
    expect(preview.assets[0]?.ownerKind).toBe("บุคคลธรรมดา");
    expect(preview.assets[0]?.ownershipPercent).toBe(100);
    expect(preview.assets[0]?.computedValue).toBe(3_000_000);
    expect(preview.assets[0]?.canImport).toBe(true);
  });

  it("อ่านไฟล์แบบฟอร์มนำเข้าทางการได้", () => {
    const file = readFileSync(
      resolve("doc/แบบฟอร์มนำเข้า_Wealth_Transfer_Import.xlsx"),
    );
    const preview = parseImportWorkbook(
      file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
    );
    expect(preview.blockingCount).toBe(0);
    expect(preview.passCount).toBe(0);
  });

  it("นำเข้าตามหัวคอลัมน์แบบฟอร์มทางการ", () => {
    const buffer = workbook({
      ทรัพย์สิน: [
        {
          "รหัสทรัพย์สิน*": "RE-01",
          "ประเภททรัพย์สิน*": "อสังหาริมทรัพย์",
          "ประเภทย่อย*": "ที่ดิน",
          "ชื่อทรัพย์สิน*": "ที่ดินบางนา",
          รายละเอียด: "โฉนด 123",
          "ประเภทผู้ถือ*": "บุคคลธรรมดา",
          "ผู้ถือกรรมสิทธิ์*": "คุณเอกชัย",
          "สัดส่วน (%) *": 100,
          "มูลค่า (บาท)*": 18_000_000,
        },
      ],
    });
    const preview = parseImportWorkbook(buffer);
    expect(preview.passCount).toBe(1);
    expect(preview.assets[0]?.assetCode).toBe("RE-01");
    expect(preview.assets[0]?.category).toBe("อสังหาริมทรัพย์");
    expect(preview.assets[0]?.subtype).toBe("ที่ดิน");
    expect(preview.assets[0]?.ownerId).toBe("คุณเอกชัย");
    expect(preview.assets[0]?.ownerKind).toBe("บุคคลธรรมดา");
    expect(preview.assets[0]?.computedValue).toBe(18_000_000);
    expect(preview.assets[0]?.detail).toBe("โฉนด 123");
  });

  it("ไม่มีหัวตารางก็อ่านคอลัมน์ตามลำดับ ชื่อ-ประเภท-เจ้าของ-มูลค่า", () => {
    const buffer = aoaWorkbook({
      Sheet1: [["บ้านริมน้ำ", "บ้าน", "สมชาย", 2_000_000]],
    });
    const preview = parseImportWorkbook(buffer);
    expect(preview.passCount).toBe(1);
    expect(preview.assets[0]?.name).toBe("บ้านริมน้ำ");
    expect(preview.assets[0]?.assetType).toBe("บ้าน");
    expect(preview.assets[0]?.ownerId).toBe("สมชาย");
    expect(preview.assets[0]?.computedValue).toBe(2_000_000);
  });

  it("ที่ดินไม่มีราคาประเมินต่อตารางวา นำเข้าได้ถ้ามีมูลค่า", () => {
    const buffer = workbook({
      RealEstate: [
        {
          asset_code: "L1",
          asset_type: "ที่ดิน",
          asset_name: "นา",
          owner_id: "พ่อ",
          ownership_percent: 100,
          value: 5_000_000,
        },
      ],
    });
    const preview = parseImportWorkbook(buffer);
    expect(preview.assets[0]?.canImport).toBe(true);
    expect(preview.assets[0]?.computedValue).toBe(5_000_000);
  });

  it("เจ้าของรวมเกิน 100% นำเข้าได้แต่มีคำเตือน", () => {
    const buffer = workbook({
      People: [
        { person_id: "P1", name: "พ่อ" },
        { person_id: "P2", name: "แม่" },
      ],
      RealEstate: [
        {
          asset_code: "L1",
          asset_type: "ที่ดิน",
          asset_name: "นา",
          owner_id: "P1",
          ownership_percent: 60,
          assessed_rate_per_sqwah: 10000,
          area_rai: 1,
        },
        {
          asset_code: "L1",
          asset_type: "ที่ดิน",
          asset_name: "นา",
          owner_id: "P2",
          ownership_percent: 50,
          assessed_rate_per_sqwah: 10000,
          area_rai: 1,
        },
      ],
    });
    const preview = parseImportWorkbook(buffer);
    expect(preview.issues.some((i) => i.error_code === "OVER_100")).toBe(true);
    expect(preview.assets.every((a) => a.canImport)).toBe(true);
  });

  it("ไฟล์ส่งออกภาษาไทยนำเข้ากลับได้", () => {
    const buffer = workbook({
      ทรัพย์สิน: [
        {
          ชื่อทรัพย์สิน: "ที่ดินสุขุมวิท",
          ประเภท: "อสังหาริมทรัพย์",
          ประเภทย่อย: "ที่ดิน",
          ผู้ถือกรรมสิทธิ์: "สมชาย (บุคคลธรรมดา · 100%)",
          สัดส่วนถือครอง_เปอร์เซ็นต์: 100,
          มูลค่าตลาด_บาท: 12_000_000,
        },
      ],
    });
    const preview = parseImportWorkbook(buffer);
    expect(preview.passCount).toBe(1);
    expect(preview.assets[0]?.ownerId).toBe("สมชาย");
    expect(preview.assets[0]?.subtype).toBe("ที่ดิน");
    expect(preview.assets[0]?.computedValue).toBe(12_000_000);
  });

  it("อ่าน CSV ที่บังคับแค่ชื่อ", () => {
    const csv = "ชื่อทรัพย์สิน\nรถมือสอง\nที่ดินว่างเปล่า";
    const buffer = new TextEncoder().encode(csv).buffer;
    const preview = parseImportWorkbook(buffer, "assets.csv");
    expect(preview.passCount).toBe(2);
    expect(preview.assets.map((a) => a.name)).toEqual(["รถมือสอง", "ที่ดินว่างเปล่า"]);
  });
});
