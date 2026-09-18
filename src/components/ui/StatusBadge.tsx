import type { AssetStatus } from "@/data/wealth-transfer";

const styles: Record<string, string> = {
  green: "bg-mint-brandLight text-mint-brandDark border-mint-100",
  orange: "bg-amber-50 text-amber-700 border-amber-100",
  blue: "bg-sky-50 text-sky-700 border-sky-100",
  gray: "bg-slate-50 text-slate-600 border-slate-100",
};

export function statusTone(status: string): keyof typeof styles {
  if (
    status.includes("มีแผน") ||
    status.includes("มีชีวิต") ||
    status.includes("ใช้งาน") ||
    status.includes("Success") ||
    status.includes("เหมาะสมสูง") ||
    status === "แนะนำ"
  ) {
    return "green";
  }
  if (
    status.includes("ระหว่าง") ||
    status.includes("รอ") ||
    status === "ร่าง" ||
    status === "เหมาะสม" ||
    status.includes("พิจารณา")
  ) {
    return "orange";
  }
  if (status.includes("คำนวณ")) return "blue";
  return "gray";
}

export function StatusBadge({ status }: { status: AssetStatus | string }) {
  const tone = statusTone(status);
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] leading-5 font-semibold ${styles[tone]}`}
    >
      {status}
    </span>
  );
}
