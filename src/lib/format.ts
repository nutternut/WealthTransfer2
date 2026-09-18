/** แสดงตัวเลขเป็นจำนวนเต็มบาท (ปัดเศษ) */
export function fmt(n: number) {
  return new Intl.NumberFormat("th-TH", {
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

/** แสดงเป็นบาท (ว่าง → —) — จำนวนเต็ม ไม่มีทศนิยม */
export function money(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return `฿${fmt(n)}`;
}

/**
 * บาทแบบย่อสำหรับ KPI — เช่น ฿1.2M, ฿41.7M, ฿889.2M
 * K / M / B (พัน / ล้าน / พันล้าน)
 */
export function moneyCompact(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";

  const format = (value: number, suffix: string) => {
    const trimmed = value.toFixed(1).replace(/\.0$/, "");
    return `${sign}฿${trimmed}${suffix}`;
  };

  if (abs >= 1_000_000_000) return format(abs / 1_000_000_000, "B");
  if (abs >= 1_000_000) return format(abs / 1_000_000, "M");
  if (abs >= 1_000) return format(abs / 1_000, "K");
  return `${sign}฿${fmt(abs)}`;
}

export function assetEffectiveValue(
  value: number | null | undefined,
  share: number,
) {
  if (value == null) return undefined;
  return (value * share) / 100;
}

/**
 * มูลค่าที่แสดงในรายการ —
 * หุ้น: ใช้ค่าสูงสุดระหว่างราคาพาร์ / ราคาตลาด / Book Value
 * อื่นๆ: ใช้ราคาซื้อขาย แล้ว fallback ราคาประเมิน
 */
export function assetDisplayAmount(asset: {
  value?: number | null;
  assessed?: number | null;
  parValue?: number | null;
  bookValue?: number | null;
}) {
  const candidates = [asset.value, asset.parValue, asset.bookValue].filter(
    (n): n is number => n != null && Number.isFinite(n),
  );
  if (candidates.length > 0) return Math.max(...candidates);
  return asset.assessed ?? undefined;
}

/** มูลค่าแสดง × สัดส่วนถือครอง — ตาม assetDisplayAmount */
export function assetEffectiveDisplayValue(asset: {
  value?: number | null;
  assessed?: number | null;
  parValue?: number | null;
  bookValue?: number | null;
  share: number;
}) {
  return assetEffectiveValue(assetDisplayAmount(asset), asset.share);
}
