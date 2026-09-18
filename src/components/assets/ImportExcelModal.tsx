"use client";

import { useId, useState } from "react";
import { Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { downloadAssetImportTemplate } from "@/lib/import/excel-template";
import {
  downloadErrorReport,
  parseImportWorkbook,
  type ImportPreview,
} from "@/lib/import/excel-parse";
import { commitImportPreview, hashFile } from "@/lib/import/excel-commit";

type ImportExcelModalProps = {
  open: boolean;
  onClose: () => void;
  onImported: () => void | Promise<void>;
};

export function ImportExcelModal({
  open,
  onClose,
  onImported,
}: ImportExcelModalProps) {
  const titleId = useId();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [filename, setFilename] = useState("");
  const [fileHash, setFileHash] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseImportWorkbook(buffer, file.name);
      setPreview(parsed);
      setFilename(file.name);
      setFileHash(await hashFile(buffer));
      if (parsed.passCount === 0) {
        setError("ไม่เจอชื่อทรัพย์สินในไฟล์ — กรอกตามแบบฟอร์มชีต «ทรัพย์สิน»");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "อ่านไฟล์ไม่สำเร็จ");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleCommit() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const result = await commitImportPreview(preview, {
        filename,
        fileHash,
      });
      await onImported();
      onClose();
      setPreview(null);
      if (result.skipped > 0 && result.createdAssets.length === 0) {
        setError(`นำเข้าไม่สำเร็จ · ข้าม ${result.skipped} แถว`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "นำเข้าไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="flex min-h-screen items-start justify-center px-3 py-8">
        <button
          type="button"
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
          aria-label="ปิด"
          onClick={onClose}
        />
        <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <div className="flex items-center gap-2 text-slate-800">
              <FileSpreadsheet className="h-4 w-4 text-mint-brand" />
              <h3 className="text-sm font-bold" id={titleId}>
                นำเข้าทรัพย์สินจาก Excel
              </h3>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-50" aria-label="ปิด">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 p-5">
            <div className="rounded-xl border border-mint-100 bg-mint-brandLight/40 px-3.5 py-2.5 text-xs text-mint-brandDark">
              <p className="font-semibold">ใช้แบบฟอร์มนำเข้า Wealth Transfer</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                ชีต «ทรัพย์สิน»: รหัสทรัพย์สิน · ประเภททรัพย์สิน · ประเภทย่อย · ชื่อทรัพย์สิน · รายละเอียด · ประเภทผู้ถือ · ผู้ถือกรรมสิทธิ์ · สัดส่วน · มูลค่า
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadAssetImportTemplate()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" />
                ดาวน์โหลดแบบฟอร์ม
              </button>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-mint-brand px-3.5 py-2 text-xs font-semibold text-white hover:bg-mint-brandDark">
                <Upload className="h-3.5 w-3.5" />
                อัปโหลดไฟล์
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            {error ? (
              <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
            ) : null}

            {preview ? (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Stat label="นำเข้าได้" value={preview.passCount} />
                  <Stat label="ข้าม" value={preview.assets.length - preview.passCount} />
                  <Stat label="แถวทั้งหมด" value={preview.assets.length} />
                </div>
                <div className="max-h-72 overflow-auto rounded-xl border border-slate-100">
                  <table className="w-full text-left text-[11px]">
                    <thead className="sticky top-0 bg-slate-50 text-slate-400">
                      <tr>
                        <th className="px-3 py-2">ชื่อทรัพย์สิน</th>
                        <th className="px-3 py-2">ประเภท</th>
                        <th className="px-3 py-2">เจ้าของ</th>
                        <th className="px-3 py-2">มูลค่า</th>
                        <th className="px-3 py-2">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {preview.assets.map((row) => (
                        <tr key={`${row.sheet}-${row.row}-${row.assetCode}`}>
                          <td className="px-3 py-2 font-medium text-slate-700">{row.name || "—"}</td>
                          <td className="px-3 py-2">{row.assetType || "อื่น ๆ"}</td>
                          <td className="px-3 py-2">{row.ownerId || "สมาชิกคนแรก"}</td>
                          <td className="px-3 py-2 tabular-nums">
                            {row.computedValue ? row.computedValue.toLocaleString("th-TH") : "—"}
                          </td>
                          <td className="px-3 py-2">
                            {row.canImport ? "พร้อมนำเข้า" : row.issues[0]?.message ?? "ข้าม"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {preview.issues.some((i) => i.severity === "Blocking Error") ? (
                    <button
                      type="button"
                      onClick={() => downloadErrorReport(preview.issues)}
                      className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600"
                    >
                      รายการที่ข้าม
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy || preview.passCount === 0}
                    onClick={() => void handleCommit()}
                    className="rounded-xl bg-mint-brand px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {busy ? "กำลังนำเข้า..." : `ยืนยันนำเข้า ${preview.passCount} รายการ`}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className="text-lg font-bold tabular-nums text-slate-800">{value}</div>
    </div>
  );
}
