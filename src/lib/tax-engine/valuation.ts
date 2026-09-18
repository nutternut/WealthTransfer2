/**
 * Valuation Engine — คำนวณมูลค่าจากข้อมูลดิบ ห้ามเชื่อสูตรที่ฝังใน Excel
 * อ้างอิง คู่มือปรับปรุงระบบ Wealth Transfer ระยะที่ 1 ข้อ 2.4
 */

export function areaToSqWa(
  rai: number,
  ngan: number,
  sqWa: number,
): number {
  return rai * 400 + ngan * 100 + sqWa;
}

export function landAssessedValue(
  rai: number,
  ngan: number,
  sqWa: number,
  ratePerSqWa: number,
): number {
  return areaToSqWa(rai, ngan, sqWa) * ratePerSqWa;
}

export function buildingAssessedValue(
  usableAreaSqm: number,
  ratePerSqm: number,
  depreciationFactor: number,
): number {
  return usableAreaSqm * ratePerSqm * depreciationFactor;
}

export function condoAssessedValue(areaSqm: number, ratePerSqm: number): number {
  return areaSqm * ratePerSqm;
}

export function sharesAtPar(sharesHeld: number, parValuePerShare: number): number {
  return sharesHeld * parValuePerShare;
}

export function sharesAtPaidUp(
  ownershipPercent: number,
  companyPaidUpCapital: number,
): number {
  return (ownershipPercent / 100) * companyPaidUpCapital;
}

export function sharesAtBook(
  sharesHeld: number,
  bookValuePerShare: number,
): number {
  return sharesHeld * bookValuePerShare;
}

export function listedSharesValue(
  sharesHeld: number,
  closingPrice: number,
): number {
  return sharesHeld * closingPrice;
}

export function fundValue(unitsHeld: number, navPerUnit: number): number {
  return unitsHeld * navPerUnit;
}

export function depositValue(
  principal: number,
  accruedInterest = 0,
): number {
  return principal + accruedInterest;
}

export function quantityValue(quantity: number, pricePerUnit: number): number {
  return quantity * pricePerUnit;
}

export function ownershipShareValue(
  grossValue: number,
  ownershipPercent: number,
): number {
  return grossValue * (ownershipPercent / 100);
}

/**
 * สูตรหุ้นต้องมีจำนวนหุ้น×พาร์ หรือสัดส่วน×ทุนชำระแล้ว
 * ห้ามคูณสัดส่วนถือหุ้นกับราคาพาร์ต่อหุ้นโดยตรง
 */
export function sharesValueOrThrow(input: {
  sharesHeld?: number | null;
  parValuePerShare?: number | null;
  ownershipPercent?: number | null;
  companyPaidUpCapital?: number | null;
  bookValuePerShare?: number | null;
}): { value: number; method: string } {
  const shares = input.sharesHeld ?? 0;
  const par = input.parValuePerShare ?? 0;
  if (shares > 0 && par > 0) {
    return { value: sharesAtPar(shares, par), method: "shares × par" };
  }
  const pct = input.ownershipPercent ?? 0;
  const paidUp = input.companyPaidUpCapital ?? 0;
  if (pct > 0 && paidUp > 0) {
    return {
      value: sharesAtPaidUp(pct, paidUp),
      method: "ownership% × paid-up capital",
    };
  }
  const book = input.bookValuePerShare ?? 0;
  if (shares > 0 && book > 0) {
    return { value: sharesAtBook(shares, book), method: "shares × book" };
  }
  throw new Error(
    "สูตรหุ้นไม่ครบ — ต้องมีจำนวนหุ้น×ราคาพาร์ หรือสัดส่วน×ทุนชำระแล้ว (ห้ามคูณสัดส่วนกับราคาพาร์ต่อหุ้น)",
  );
}
