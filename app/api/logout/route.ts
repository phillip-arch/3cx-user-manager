// app/api/logout/route.ts
import { NextRequest, NextResponse } from "next/server";

function clearSessionCookie(res: NextResponse) {
  res.cookies.set("app_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function POST(req: NextRequest) {
  const redirectUrl = new URL("/login", req.url);
  // Use 303 to force the redirected request to be GET (avoid 405 on /login)
  const res = NextResponse.redirect(redirectUrl, { status: 303 });
  clearSessionCookie(res);
  return res;
}

// Convenience for GET (clicking the route directly)
export async function GET(req: NextRequest) {
  const redirectUrl = new URL("/login", req.url);
  const res = NextResponse.redirect(redirectUrl, { status: 303 });
  clearSessionCookie(res);
  return res;
}
