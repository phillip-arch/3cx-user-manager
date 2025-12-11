// app/dashboard/companies/[companyId]/users/[userId]/edit/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabaseClient";
import {
  getEditorAccountForUser,
  createEditorAccountForUser,
  removeEditorAccountForUser,
} from "@/lib/editors";

type Props = {
  params: Promise<{ companyId: string; userId: string }>;
  searchParams: Promise<{ message?: string; error?: string; role?: string }>;
};

export default async function EditUserPage(props: Props) {
  const { companyId, userId } = await props.params;
  const search = await props.searchParams;
  const message = search.message ?? "";
  const errorMessage = search.error ?? "";

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error loading user:", error);
    return <div>Error loading user.</div>;
  }

  if (!user) {
    return <div>User not found.</div>;
  }

  const editorAccount = await getEditorAccountForUser(userId);
  const hasEditor = !!editorAccount;
  const basePath = `/dashboard/companies/${companyId}/users/${userId}/edit`;

  // Determine role from query string provided by the listing page
  const currentRole: "admin" | "editor" | "guest" =
    search.role === "admin" || search.role === "editor" ? search.role : "guest";

  // SERVER ACTIONS
  async function updateUserAction(formData: FormData) {
    "use server";

    const name = String(formData.get("name") || "").trim();
    const extension = String(formData.get("extension") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const dialOut = String(formData.get("outbound_caller_id") || "").trim();
    const did = String(formData.get("did") || "").trim();
    const role: "admin" | "editor" | "guest" = currentRole;
    const status = role === "editor" ? "pending" : "active";

    if (!name) {
      redirect(`${basePath}?error=${encodeURIComponent("Name is required.")}`);
    }

    if (extension) {
      const { data: extUsers, error: extErr } = await supabase
        .from("users")
        .select("id")
        .eq("company_id", companyId)
        .eq("extension", extension)
        .neq("id", userId)
        .in("status", ["active", "pending", null]);

      if (extErr) {
        console.error("Extension check error:", extErr);
        redirect(
          `${basePath}?error=${encodeURIComponent(
            "Could not validate extension."
          )}`
        );
      }

      if (extUsers && extUsers.length > 0) {
        redirect(
          `${basePath}?error=${encodeURIComponent(
            `Extension ${extension} is already used in this company.`
          )}`
        );
      }
    }

    const { error: updateErr } = await supabase
      .from("users")
      .update({
        name,
        extension: extension || null,
        email: email || null,
        outbound_caller_id: dialOut || null,
        did: did || null,
        status,
      })
      .eq("id", userId);

    if (updateErr) {
      console.error("Update user error:", updateErr);
      redirect(
        `${basePath}?error=${encodeURIComponent(
          "Saving user failed. Please try again."
        )}`
      );
    }

    const listPath = `/dashboard/companies/${companyId}/users`;
    await revalidatePath(listPath);
    const successMsg =
      status === "pending"
        ? "Changes saved and sent for admin approval."
        : "User updated successfully.";
    redirect(`${listPath}?userMsg=${encodeURIComponent(successMsg)}`);
  }

  async function makeEditorAction(formData: FormData) {
    "use server";

    const email = String(formData.get("editorEmail") || "").trim();

    if (!email) {
      redirect(
        `${basePath}?error=${encodeURIComponent("Editor email is required.")}`
      );
    }

    const result = await createEditorAccountForUser({
      userId,
      companyId,
      email,
    });

    if (!result.success) {
      redirect(
        `${basePath}?error=${encodeURIComponent(
          result.error || "Failed to create editor account."
        )}`
      );
    }

    const msg = `Editor created. Temporary password: ${result.tempPassword}`;
    redirect(`${basePath}?message=${encodeURIComponent(msg)}`);
  }

  async function removeEditorAction() {
    "use server";

    await removeEditorAccountForUser(userId);
    redirect(
      `${basePath}?message=${encodeURIComponent("Editor access removed.")}`
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="w-full border-b border-white/10 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
        <div className="w-full px-4 md:px-6 lg:px-10 py-6 flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            3CX User Manager
          </p>
          <h1 className="text-2xl font-semibold text-white">Edit User</h1>
          <Link
            href={`/dashboard/companies/${companyId}/users`}
            className="text-xs text-indigo-200 underline"
          >
            ← Back to users
          </Link>
        </div>
      </header>

      <main className="w-full px-4 md:px-6 lg:px-10 py-8 space-y-6 max-w-6xl">
        {message && (
          <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 text-emerald-100 px-4 py-3 text-sm">
            {message}
          </div>
        )}
        {errorMessage && (
          <div className="rounded-xl border border-red-400/40 bg-red-500/15 text-red-100 px-4 py-3 text-sm">
            {errorMessage}
          </div>
        )}

        <section className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-lg shadow-black/30 backdrop-blur">
          <h2 className="text-lg font-semibold mb-4 text-white">
            Edit user: {user.name}
          </h2>

          <form action={updateUserAction} className="space-y-4">
            <input type="hidden" name="role" value={currentRole} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Name *
                </label>
                <input
                  name="name"
                  defaultValue={user.name ?? ""}
                  className="w-full border border-white/10 rounded-lg px-3 py-2.5 text-sm bg-white/5 text-white placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Extension
                </label>
                <input
                  name="extension"
                  defaultValue={user.extension ?? ""}
                  className="w-full border border-white/10 rounded-lg px-3 py-2.5 text-sm bg-white/5 text-white placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  defaultValue={user.email ?? ""}
                  className="w-full border border-white/10 rounded-lg px-3 py-2.5 text-sm bg-white/5 text-white placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Dial-Out Number
                </label>
                <input
                  name="outbound_caller_id"
                  defaultValue={user.outbound_caller_id ?? ""}
                  className="w-full border border-white/10 rounded-lg px-3 py-2.5 text-sm bg-white/5 text-white placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-slate-300 mb-1">
                  Direct Number (DID)
                </label>
                <input
                  name="did"
                  defaultValue={user.did ?? ""}
                  className="w-full border border-white/10 rounded-lg px-3 py-2.5 text-sm bg-white/5 text-white placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                className="px-4 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium transition shadow-md shadow-indigo-900/40"
              >
                Save changes
              </button>
              <Link
                href={`/dashboard/companies/${companyId}/users`}
                className="px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm text-white transition"
              >
                Cancel
              </Link>
            </div>
          </form>
        </section>

        <section className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-lg shadow-black/30 backdrop-blur">
          <h2 className="text-lg font-semibold mb-3 text-white">Editor access</h2>
          <p className="text-xs text-slate-300 mb-4">
            Editors can log into this app and manage users only in their own company.
          </p>

          {hasEditor ? (
            <div className="space-y-3">
              <p className="text-sm text-emerald-100">
                Editor account is active for{" "}
                <span className="font-medium">{editorAccount.email}</span>.
              </p>
              <form action={removeEditorAction}>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg border border-red-300/40 bg-red-500/10 text-red-100 hover:bg-red-500/20 text-sm transition"
                >
                  Remove editor access
                </button>
              </form>
            </div>
          ) : (
            <form action={makeEditorAction} className="space-y-3 max-w-sm">
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Editor login email
                </label>
                <input
                  name="editorEmail"
                  defaultValue={user.email ?? ""}
                  className="w-full border border-white/10 rounded-lg px-3 py-2.5 text-sm bg-white/5 text-white placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                  required
                />
              </div>
              <p className="text-xs text-slate-300">
                A temporary password will be generated and shown once after creating the editor account.
              </p>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium transition shadow-md shadow-indigo-900/40"
              >
                Create editor account
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
