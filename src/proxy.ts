import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Proxy ไป Supabase — อย่าบังคับ login cookie
  if (pathname.startsWith("/supabase")) {
    return NextResponse.next();
  }

  const session = request.cookies.get(AUTH_COOKIE)?.value;
  const isLoggedIn = Boolean(session);
  const isLoginPage = pathname === "/login";

  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && (isLoginPage || pathname === "/")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|supabase/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
