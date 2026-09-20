"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Lock,
  User,
  X,
} from "lucide-react";
import { loginWithUsernamePassword } from "@/lib/auth";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3.5 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:border-mint-brand focus:ring-2 focus:ring-mint-200 focus:outline-none";

type LoginPhase = "idle" | "loading" | "success" | "error";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState("");
  const [phase, setPhase] = useState<LoginPhase>("idle");

  // กันกรณี form ส่งแบบ GET ก่อน hydrate — ลบ credentials ออกจาก URL ทันที
  useEffect(() => {
    if (
      !searchParams.has("username") &&
      !searchParams.has("password")
    ) {
      return;
    }
    const next = searchParams.get("next");
    const clean =
      next && next.startsWith("/") && !next.startsWith("//")
        ? `/login?next=${encodeURIComponent(next)}`
        : "/login";
    router.replace(clean);
  }, [router, searchParams]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  async function handleLogin() {
    if (phase === "loading" || phase === "success") return;

    setToast("");
    setPhase("loading");

    const result = await loginWithUsernamePassword(username, password);
    if (!result.ok) {
      setToast(result.message);
      setPhase("error");
      window.setTimeout(() => setPhase("idle"), 500);
      return;
    }

    setPhase("success");

    const next = searchParams.get("next");
    const destination =
      next && next.startsWith("/") && !next.startsWith("//")
        ? next
        : "/dashboard";

    window.setTimeout(() => {
      router.replace(destination);
      router.refresh();
    }, 700);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    void handleLogin();
  }

  const leaving = phase === "success";

  return (
    <div
      className={`relative flex min-h-screen flex-col lg:flex-row ${
        leaving ? "animate-[loginSuccessOut_0.65s_ease-in_forwards]" : ""
      }`}
    >
      {toast ? (
        <div
          role="alert"
          className="fixed top-5 left-1/2 z-[70] flex max-w-[min(92vw,420px)] -translate-x-1/2 items-start gap-3 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-700 shadow-[0_12px_40px_-12px_rgba(190,24,93,0.35)] animate-[fadeUp_0.25s_ease-out]"
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-[11px] font-bold text-rose-600">
            !
          </span>
          <p className="min-w-0 flex-1 font-medium leading-snug">{toast}</p>
          <button
            type="button"
            onClick={() => setToast("")}
            className="shrink-0 rounded-md p-0.5 text-rose-400 transition hover:bg-rose-50 hover:text-rose-600"
            aria-label="ปิด"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Left brand panel — light editorial */}
      <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-[#e8eaed] px-8 py-16 sm:px-10 lg:px-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 42%, #f4f5f7 0%, #e8eaed 55%, #dde0e4 100%)",
          }}
        />

        <div className="relative z-10 flex w-full max-w-lg flex-col items-center text-center">
          <p
            className="font-serif text-[1.35rem] leading-none tracking-tight text-slate-900 opacity-0 sm:text-[1.5rem] animate-[fadeUp_0.55s_ease-out_forwards]"
            style={{ animationDelay: "60ms" }}
          >
            Family Business
          </p>

          <h1
            className="mt-3 font-serif text-[2.75rem] leading-[1.05] font-bold tracking-tight text-black opacity-0 sm:text-5xl lg:text-[3.5rem] animate-[fadeUp_0.55s_ease-out_forwards]"
            style={{ animationDelay: "140ms" }}
          >
            Wealth Planning
          </h1>

          <div
            aria-hidden
            className="mt-5 h-px w-14 bg-[#5c3a1e] opacity-0 animate-[fadeUp_0.5s_ease-out_forwards]"
            style={{ animationDelay: "220ms" }}
          />

          <p
            className="mt-8 text-lg font-medium tracking-tight text-slate-900 opacity-0 sm:text-xl animate-[fadeUp_0.55s_ease-out_forwards]"
            style={{ animationDelay: "280ms" }}
          >
            Business. Wealth. Family.
          </p>

          <p
            className="mt-3 text-sm text-slate-400 opacity-0 sm:text-[15px] animate-[fadeUp_0.55s_ease-out_forwards]"
            style={{ animationDelay: "340ms" }}
          >
            Prepare What Matters for the Next Generation.
          </p>

          <div
            className="mt-16 flex flex-col items-center opacity-0 sm:mt-20 animate-[fadeUp_0.55s_ease-out_forwards]"
            style={{ animationDelay: "420ms" }}
          >
            <div className="text-[2.75rem] leading-none font-extrabold tracking-[0.02em] text-mint-brand sm:text-5xl">
              FAMZ
            </div>
            <p className="mt-2.5 text-xs tracking-wide text-slate-400">
              Powered by VeriSci
            </p>
          </div>
        </div>
      </section>

      {/* Right auth panel */}
      <section className="relative flex flex-1 items-center justify-center bg-mint-neutralLight px-5 py-12 sm:px-8 lg:px-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#e8eef6_0%,_transparent_55%)]"
        />

        {leaving ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-mint-neutralLight/70 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-3 animate-[checkPop_0.45s_ease-out_forwards]">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-mint-brand text-white shadow-lg shadow-mint-brand/30">
                <Check className="h-7 w-7" strokeWidth={2.5} />
              </div>
              <p className="text-sm font-semibold text-mint-brandDark">
                เข้าสู่ระบบสำเร็จ
              </p>
            </div>
          </div>
        ) : null}

        <div
          className="relative w-full max-w-[420px] opacity-0 animate-[fadeUp_0.55s_ease-out_forwards]"
          style={{ animationDelay: "180ms" }}
        >
          <div
            className={
              phase === "error" ? "animate-[shakeX_0.45s_ease-in-out]" : ""
            }
          >
            <div className="rounded-[1.75rem] border border-slate-100 bg-white p-7 shadow-[0_24px_60px_-28px_rgba(18,40,71,0.18)] transition-shadow duration-300 sm:p-9">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                เข้าสู่ระบบ
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">
                สำหรับผู้มีสิทธิ์เข้าถึงข้อมูลตระกูลเท่านั้น
              </p>

              <form
                method="post"
                action="/login"
                onSubmit={handleSubmit}
                className="mt-6 space-y-4"
              >
                <div className="space-y-1.5">
                  <label
                    htmlFor="username"
                    className="block text-xs font-semibold text-slate-600"
                  >
                    ชื่อผู้ใช้
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={inputClass}
                      placeholder="username"
                      required
                      disabled={phase === "loading" || phase === "success"}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold text-slate-600"
                  >
                    รหัสผ่าน
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputClass} pr-11`}
                      placeholder="password"
                      required
                      enterKeyHint="go"
                      disabled={phase === "loading" || phase === "success"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
                      aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={phase === "loading" || phase === "success"}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-mint-brand py-3.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-mint-brandDark hover:shadow-md hover:shadow-mint-brand/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80"
                >
                  {phase === "loading" ? (
                    <>
                      <span
                        className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-[spin_0.7s_linear_infinite]"
                        aria-hidden
                      />
                      กำลังเข้าสู่ระบบ...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                      เข้าสู่ระบบ
                    </>
                  )}
                </button>
              </form>
            </div>

            <p className="mt-5 text-center text-[11px] text-slate-400">
              เข้าสู่ระบบด้วยบัญชีที่ผู้ดูแลระบบสร้างให้
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
