// lib/session.ts

export type AppSession = {
  accountId: string;
  userId: string | null;
  companyId: string | null;
  role: "admin" | "editor";
};

/**
 * Bezbedno parsira JSON session cookie.
 */
export function parseSessionCookie(value: string | undefined): AppSession | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as AppSession;
    // Minimalna validacija
    if (!parsed || !parsed.role) return null;
    if (parsed.role !== "admin" && parsed.role !== "editor") return null;
    return {
      accountId: parsed.accountId,
      userId: parsed.userId ?? null,
      companyId: parsed.companyId ?? null,
      role: parsed.role,
    };
  } catch {
    return null;
  }
}
