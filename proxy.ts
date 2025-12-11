// proxy.ts
import { NextRequest, NextResponse } from "next/server";
import type { AppSession } from "./lib/session";
import { parseSessionCookie } from "./lib/session";

// Next.js expects a function export named `proxy` (or default).
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const cookieValue = req.cookies.get("app_session")?.value;
  const session: AppSession | null = parseSessionCookie(cookieValue);

  // Protected routes
  if (pathname.startsWith("/dashboard")) {
    // No session -> redirect to login
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }

    // Editors cannot view the full companies list
    if (session.role === "editor" && pathname === "/dashboard/companies") {
      const url = req.nextUrl.clone();
      url.pathname = `/dashboard/companies/${session.companyId}/users`;
      return NextResponse.redirect(url);
    }

    // Editors cannot access other companies
    if (session.role === "editor" && pathname.startsWith("/dashboard/companies/")) {
      const parts = pathname.split("/");
      // /dashboard/companies/[companyId]/...
      const urlCompanyId = parts[3] || null;

      if (urlCompanyId && session.companyId && urlCompanyId !== session.companyId) {
        const url = req.nextUrl.clone();
        url.pathname = `/dashboard/companies/${session.companyId}/users`;
        return NextResponse.redirect(url);
      }
    }

    // Admins have full access
    return NextResponse.next();
  }

  // If already logged in, skip /login
  if (pathname === "/login" && session) {
    const url = req.nextUrl.clone();
    if (session.role === "admin") {
      url.pathname = "/dashboard/companies";
    } else {
      url.pathname = `/dashboard/companies/${session.companyId}/users`;
    }
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
