// app/proxy.ts
import { NextResponse } from "next/server";

export const config = {
  matcher: ["/dashboard/:path*"],
};

export function middleware(request: Request) {
  // Čitanje cookie-ja
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader
      .split(";")
      .map(c => c.trim().split("="))
      .filter(p => p.length === 2)
  );

  const sessionCookie = cookies["app_session"];

  if (!sessionCookie) {
    // nema sesije → redirect na login
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // pokušaj da parse-s JSON sesiju
  let session: any = null;
  try {
    session = JSON.parse(decodeURIComponent(sessionCookie));
  } catch (err) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const role = session.role;
  const companyId = session.companyId;

  // admin → pristup svuda
  if (role === "admin") {
    return NextResponse.next();
  }

  // editor → dozvoljeno samo u svojoj firmi
  if (role === "editor") {
    const url = new URL(request.url);

    // editor pokušava da ide na /dashboard/companies
    if (url.pathname === "/dashboard/companies") {
      return NextResponse.redirect(
        new URL(`/dashboard/companies/${companyId}/users`, request.url)
      );
    }

    // editor pokušava da otvori drugu kompaniju
    if (url.pathname.startsWith("/dashboard/companies/")) {
      const parts = url.pathname.split("/");
      const paramCompanyId = parts[3]; // /dashboard/companies/{id}/...

      if (paramCompanyId && paramCompanyId !== companyId) {
        return NextResponse.redirect(
          new URL(`/dashboard/companies/${companyId}/users`, request.url)
        );
      }
    }

    return NextResponse.next();
  }

  // fallback: ako role ne postoji → na login
  return NextResponse.redirect(new URL("/login", request.url));
}
