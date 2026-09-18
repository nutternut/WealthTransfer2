import * as XLSX from "xlsx";
import type { Asset } from "@/data/wealth-transfer";

function ownersText(asset: Asset): string {
  if (asset.owners && asset.owners.length > 0) {
    return asset.owners
      .map((o) => `${o.owner} (${o.ownerKind} · ${o.share}%)`)
      .join("; ");
  }
  const kind = asset.ownerKind ? ` (${asset.ownerKind})` : "";
  return `${asset.owner}${kind}${asset.share != null ? ` · ${asset.share}%` : ""}`;
}

function assetToRow(asset: Asset) {
  return {
    รหัส: asset.id,
    ชื่อทรัพย์สิน: asset.name,
    ประเภท: asset.type,
    ประเภทย่อย: asset.subtype ?? "",
    รายละเอียด: asset.detail ?? "",
    ผู้ถือกรรมสิทธิ์: ownersText(asset),
    สัดส่วนถือครอง_เปอร์เซ็นต์: asset.share,
    สถานะแผน: asset.status,
    บทบาท: asset.role ?? "",
    มูลค่าตลาด_บาท: asset.value ?? "",
    ราคาประเมิน_บาท: asset.assessed ?? "",
    ต้นทุน_บาท: asset.cost ?? "",
    ปีที่ได้มา: asset.acquired === "-" ? "" : asset.acquired,
    ปีที่โอน: asset.transferYear ?? "",
    วิธีได้มา: asset.method ?? "",
    เนื้อที่: asset.area ?? "",
    ราคาประเมินต่อตารางวา_บาท: asset.assessedPerSqWa ?? "",
    ทุนจดทะเบียน_บาท: asset.registeredCapital ?? "",
    มูลค่าพาร์_บาท: asset.parValue ?? "",
    Book_Value_บาท: asset.bookValue ?? "",
    ผู้รับโอนที่ตั้งใจ: asset.intendedReceiver ?? "",
    หมายเหตุ: asset.note ?? "",
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * ส่งออกรายการทรัพย์สินเป็นไฟล์ Excel (.xlsx)
 */
export function exportAssetsToExcel(
  assets: Asset[],
  options?: { filename?: string; sheetName?: string },
) {
  if (assets.length === 0) {
    throw new Error("ไม่มีรายการทรัพย์สินให้ส่งออก");
  }

  const rows = assets.map(assetToRow);
  const sheet = XLSX.utils.json_to_sheet(rows);

  // ความกว้างคอลัมน์คร่าว ๆ
  const headers = Object.keys(rows[0]!);
  sheet["!cols"] = headers.map((key) => {
    const maxLen = Math.max(
      key.length,
      ...rows.map((r) => String((r as Record<string, unknown>)[key] ?? "").length),
    );
    return { wch: Math.min(40, Math.max(12, maxLen + 2)) };
  });

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    sheet,
    options?.sheetName ?? "ทรัพย์สิน",
  );

  const stamp = new Date()
    .toISOString()
    .slice(0, 19)
    .replaceAll(":", "")
    .replace("T", "-");
  const filename =
    options?.filename ?? `wealth-assets-${stamp}.xlsx`;

  const buffer = XLSX.write(book, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer;
  downloadBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename,
  );
}
