// app/dashboard/companies/[companyId]/edit/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  params: Promise<{ companyId: string }>;
};

async function getCompany(companyId: string) {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .single();

  if (error || !data) return null;
  return data;
}

async function updateCompanyAction(formData: FormData) {
  "use server";

  const companyId = String(formData.get("companyId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!companyId || !name) return;

  const { error } = await supabase
    .from("companies")
    .update({ name })
    .eq("id", companyId);

  if (error) {
    console.error("Error updating company:", error);
    return;
  }

  revalidatePath("/dashboard/companies");
  redirect("/dashboard/companies");
}

export default async function EditCompanyPage(props: Props) {
  const { companyId } = await props.params;
  const company = await getCompany(companyId);

  if (!company) {
    redirect("/dashboard/companies");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="w-full px-4 md:px-6 lg:px-10 py-8 space-y-6 max-w-4xl">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              3CX User Manager
            </p>
            <h1 className="text-2xl font-semibold text-white">Edit company</h1>
            <p className="text-sm text-slate-300">ID: {companyId}</p>
          </div>
          <Link
            href="/dashboard/companies"
            className="text-xs md:text-sm px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition"
          >
            ← Back to companies
          </Link>
        </header>

        <section className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-lg shadow-black/30 backdrop-blur">
          <form action={updateCompanyAction} className="space-y-4">
            <input type="hidden" name="companyId" value={companyId} />
            <div className="flex flex-col gap-2">
              <label className="text-sm text-slate-300">Company name</label>
              <input
                name="name"
                defaultValue={company.name}
                required
                className="border border-white/10 rounded-lg px-3 py-3 text-base bg-white/5 text-white placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                placeholder="Company name"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-4 py-3 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium transition shadow-md shadow-indigo-900/40"
              >
                Save changes
              </button>
              <Link
                href="/dashboard/companies"
                className="px-4 py-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm text-white transition"
              >
                Cancel
              </Link>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
