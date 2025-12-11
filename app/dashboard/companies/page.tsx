// app/dashboard/companies/page.tsx

import Link from "next/link";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabaseClient";
import { getCompanies } from "@/lib/data";
import { parseSessionCookie, type AppSession } from "@/lib/session";

async function addCompanyAction(formData: FormData) {
  "use server";

  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const { error } = await supabase.from("companies").insert({ name });
  if (error) console.error("Error adding company:", error);

  revalidatePath("/dashboard/companies");
}

async function editCompanyAction(formData: FormData) {
  "use server";

  const companyId = String(formData.get("companyId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!companyId || !name) return;

  const { error } = await supabase
    .from("companies")
    .update({ name })
    .eq("id", companyId);

  if (error) console.error("Error updating company:", error);

  revalidatePath("/dashboard/companies");
}

async function deleteCompanyAction(formData: FormData) {
  "use server";

  const companyId = String(formData.get("companyId") || "");
  if (!companyId) return;

  const { error: usersError } = await supabase
    .from("users")
    .delete()
    .eq("company_id", companyId);
  if (usersError) console.error("Error deleting users for company:", usersError);

  const { error: companyError } = await supabase
    .from("companies")
    .delete()
    .eq("id", companyId);
  if (companyError) console.error("Error deleting company:", companyError);

  revalidatePath("/dashboard/companies");
}

async function getCurrentSessionRole(): Promise<"admin" | "editor" | "guest"> {
  const h = await headers();
  const rawCookie =
    h
      .get("cookie")
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("app_session=")) || "";

  if (!rawCookie) return "guest";

  const encoded = rawCookie.split("=").slice(1).join("=");
  let decoded = encoded;
  try {
    decoded = decodeURIComponent(encoded);
  } catch {
    /* noop */
  }

  try {
    const session: AppSession | null = parseSessionCookie(decoded);
    return session?.role ?? "guest";
  } catch {
    return "guest";
  }
}

export default async function CompaniesPage() {
  const role = await getCurrentSessionRole();
  const companies = await getCompanies();

  const companiesWithCounts = await Promise.all(
    companies.map(async (c) => {
      const { count: pendingCount = 0 } = await supabase
        .from("users")
        .select("*", { head: true, count: "exact" })
        .eq("company_id", c.id)
        .eq("status", "pending");

      const { count: deletedCount = 0 } = await supabase
        .from("users")
        .select("*", { head: true, count: "exact" })
        .eq("company_id", c.id)
        .eq("status", "deleted");

      return {
        ...c,
        reviewCount: pendingCount + deletedCount,
      };
    })
  );

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-50">
      <div className="w-full px-4 md:px-6 lg:px-10 py-8 space-y-6">
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              3CX User Manager
            </p>
            <h1 className="text-2xl font-semibold text-white">Companies</h1>
            <p className="text-sm text-slate-300">
              Manage tenants and jump into their users.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs md:text-sm">
            <span className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-200">
              Role: {role}
            </span>
            <form action="/api/logout" method="POST">
              <button
                type="submit"
                className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition"
              >
                Log out
              </button>
            </form>
          </div>
        </header>

        <section className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-lg shadow-black/30 backdrop-blur">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-base text-white">Add new company</h2>
            <span className="text-xs text-slate-400">Create</span>
          </div>
          <form
            action={addCompanyAction}
            className="flex flex-col sm:flex-row gap-3 text-sm"
          >
            <input
              name="name"
              required
              placeholder="Company name"
              className="flex-1 border border-white/10 rounded-lg px-3 py-3 text-sm bg-white/5 text-white placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 py-3 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium transition shadow-md shadow-indigo-900/40"
            >
              + Add
            </button>
          </form>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {companiesWithCounts.map((c) => (
            <div
              key={c.id}
              className="border border-white/10 rounded-2xl bg-white/5 p-4 flex flex-col gap-3 shadow-md shadow-black/30 backdrop-blur"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-base text-white truncate">
                    {c.name}
                  </h2>
                  {role === "admin" && c.reviewCount > 0 && (
                    <span className="text-[11px] px-3 py-1 rounded-full bg-amber-900/70 border border-amber-700/40 text-amber-100">
                      {c.reviewCount} pending
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <Link
                  href={`/dashboard/companies/${c.id}/users`}
                  className="text-xs px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white transition"
                >
                  View users
                </Link>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/companies/${c.id}/edit`}
                    className="text-xs px-3 py-2 rounded-lg border border-indigo-300/40 bg-indigo-500/10 text-indigo-100 hover:bg-indigo-500/20 transition"
                  >
                    Edit
                  </Link>

                  <form action={deleteCompanyAction}>
                    <input type="hidden" name="companyId" value={c.id} />
                    <button
                      type="submit"
                      className="text-xs px-3 py-2 rounded-lg border border-red-300/40 bg-red-500/10 text-red-100 hover:bg-red-500/20 transition"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}

          {companies.length === 0 && (
            <div className="col-span-full rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300 text-center">
              No companies yet. Add your first company above.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
