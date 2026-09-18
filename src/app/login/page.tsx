import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-mint-neutralLight text-sm text-slate-400">
          กำลังโหลด...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
