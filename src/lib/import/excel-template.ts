import * as XLSX from "xlsx";

export const IMPORT_TEMPLATE_VERSION = "WT-P1-2569.09.4";

export const IMPORT_SHEETS = ["ทรัพย์สิน"] as const;

export const IMPORT_TEMPLATE_FILENAME =
  "แบบฟอร์มนำเข้า_Wealth_Transfer_Import.xlsx";

/** หัวตารางตามแบบฟอร์มนำเข้าทางการ */
export const SIMPLE_ASSET_HEADERS = [
  "รหัสทรัพย์สิน*",
  "ประเภททรัพย์สิน*",
  "ประเภทย่อย*",
  "ชื่อทรัพย์สิน*",
  "รายละเอียด",
  "ประเภทผู้ถือ*",
  "ผู้ถือกรรมสิทธิ์*",
  "สัดส่วน (%) *",
  "มูลค่า (บาท)*",
] as const;

export function buildAssetImportTemplate(): XLSX.WorkBook {
  const book = XLSX.utils.book_new();

  const ws = XLSX.utils.aoa_to_sheet([[...SIMPLE_ASSET_HEADERS]]);
  ws["!cols"] = [
    { wch: 16 },
    { wch: 20 },
    { wch: 18 },
    { wch: 28 },
    { wch: 24 },
    { wch: 16 },
    { wch: 20 },
    { wch: 16 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(book, ws, "ทรัพย์สิน");

  return book;
}

export function downloadAssetImportTemplate() {
  const book = buildAssetImportTemplate();
  const buffer = XLSX.write(book, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer;
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = IMPORT_TEMPLATE_FILENAME;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
