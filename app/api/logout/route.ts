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
  const res = NextResponse.redirect(redirectUrl);
  clearSessionCookie(res);
  return res;
}

// Convenience for GET (clicking the route directly)
export async function GET(req: NextRequest) {
  const redirectUrl = new URL("/login", req.url);
  const res = NextResponse.redirect(redirectUrl);
  clearSessionCookie(res);
  return res;
}
