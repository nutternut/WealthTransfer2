import Link from "next/link";

export default function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center">
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{description}</p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex rounded-xl bg-mint-brandLight px-4 py-2 text-xs font-semibold text-mint-brand transition hover:bg-mint-100"
      >
        กลับไปภาพรวม
      </Link>
    </div>
  );
}
