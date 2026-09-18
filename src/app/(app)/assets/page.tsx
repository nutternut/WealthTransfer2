import { Suspense } from "react";
import { AssetsList } from "@/components/assets/AssetsList";

export default function AssetsPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-400">
          กำลังโหลด...
        </div>
      }
    >
      <AssetsList />
    </Suspense>
  );
}
