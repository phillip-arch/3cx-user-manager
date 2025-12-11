// app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { verifyPassword } from "@/lib/passwords";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const emailRaw = String(body.email || "");
    const password = String(body.password || "");

    const email = emailRaw.trim(); // BEZ toLowerCase

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: "Missing email or password." },
        { status: 400 }
      );
    }

    // Uzmemo NAJSKORIJEG app_account za taj email
    const { data: rows, error } = await supabase
      .from("app_accounts")
      .select("*")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Login query error:", error);
      return NextResponse.json(
        { ok: false, error: "Login failed. Please try again." },
        { status: 500 }
      );
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const account = rows[0];

    if (!account.password_hash) {
      return NextResponse.json(
        { ok: false, error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const ok = verifyPassword(password, account.password_hash as string);

    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const sessionPayload = {
      accountId: account.id as string,
      userId: (account.user_id as string | null) ?? null,
      companyId: (account.company_id as string | null) ?? null,
      role: account.role as "admin" | "editor",
    };

    const res = NextResponse.json({
      ok: true,
      role: sessionPayload.role,
      companyId: sessionPayload.companyId,
    });

    res.cookies.set("app_session", JSON.stringify(sessionPayload), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8, // 8h
    });

    return res;
  } catch (err) {
    console.error("Login API error:", err);
    return NextResponse.json(
      { ok: false, error: "Unexpected error." },
      { status: 500 }
    );
  }
}
