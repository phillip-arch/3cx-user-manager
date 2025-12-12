// app/dashboard/companies/[companyId]/users/page.tsx
import Link from "next/link";
import BannerList from "@/components/BannerList";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabaseClient";

import {
  getCompanyUsers,
  addUserWithValidation,
  softDeleteUser,
  restoreUser,
  deleteUserForever,
  approvePendingUser,
  rejectPendingUser,
  importUsersFromCsv,
  type User,
} from "@/lib/data";
import { parseSessionCookie, type AppSession } from "@/lib/session";
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ companyId: string }>;
  searchParams?: Promise<{
    search?: string;
    userMsg?: string;
    userError?: string;
    approveMsg?: string;
    import?: string;
  }>;
};

async function getCurrentSessionRole(): Promise<"admin" | "editor" | "guest"> {
  const h = await headers();
  const cookieHeader = h.get("cookie") || "";

  const rawCookie = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("app_session="));

  if (!rawCookie) return "guest";

  const encoded = rawCookie.split("=").slice(1).join("=");
  let decoded = encoded;
  try {
    decoded = decodeURIComponent(encoded);
  } catch {
    // ignore
  }

  try {
    const session: AppSession | null = parseSessionCookie(decoded);
    if (!session) return "guest";
    return session.role;
  } catch {
    return "guest";
  }
}

/* ---------- SERVER ACTIONS ---------- */

async function addUserAction(formData: FormData) {
  "use server";

  const companyId = String(formData.get("companyId") || "");
  const roleFromForm = String(formData.get("role") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const extension = String(formData.get("extension") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const outbound = String(formData.get("outbound") || "").trim();
  const did = String(formData.get("did") || "").trim();
  const role =
    roleFromForm === "admin" || roleFromForm === "editor"
      ? roleFromForm
      : await getCurrentSessionRole();
  const status = role === "editor" ? "pending" : "active";

  const result = await addUserWithValidation({
    companyId,
    name,
    extension: extension || "",
    email: email || null,
    outboundCallerId: outbound || null,
    did: did || null,
    status,
  });

  if (!result.success) {
    console.error(result.error);
    redirect(
      `/dashboard/companies/${companyId}/users?userError=${encodeURIComponent(
        result.error || "Failed to add user."
      )}`
    );
  }

  revalidatePath(`/dashboard/companies/${companyId}/users`);
  redirect(
    `/dashboard/companies/${companyId}/users?userMsg=${encodeURIComponent(
      "User added successfully."
    )}`
  );
}

async function importCsvAction(formData: FormData) {
  "use server";

  const companyId = String(formData.get("companyId") || "");
  const file = formData.get("file") as File | null;

  if (!file) {
    redirect(
      `/dashboard/companies/${companyId}/users?import=missing&${Date.now()}`
    );
  }

  const text = await file.text();
  if (!text.trim()) {
    redirect(
      `/dashboard/companies/${companyId}/users?import=empty&${Date.now()}`
    );
  }
  const result = await importUsersFromCsv(companyId, text);

  if (!result.success) {
    console.error(result.error);
    redirect(
      `/dashboard/companies/${companyId}/users?import=error&${Date.now()}`
    );
  }

  revalidatePath(`/dashboard/companies/${companyId}/users`);
  redirect(
    `/dashboard/companies/${companyId}/users?import=success&${Date.now()}`
  );
}

async function softDeleteAction(formData: FormData) {
  "use server";

  const userId = String(formData.get("userId") || "");
  const companyId = String(formData.get("companyId") || "");

  await softDeleteUser(userId);
  revalidatePath(`/dashboard/companies/${companyId}/users`);
}

async function restoreAction(formData: FormData) {
  "use server";

  const userId = String(formData.get("userId") || "");
  const companyId = String(formData.get("companyId") || "");

  await restoreUser(userId);
  revalidatePath(`/dashboard/companies/${companyId}/users`);
}

async function deleteForeverAction(formData: FormData) {
  "use server";

  const userId = String(formData.get("userId") || "");
  const companyId = String(formData.get("companyId") || "");

  await deleteUserForever(userId);
  revalidatePath(`/dashboard/companies/${companyId}/users`);
}

async function approvePendingAction(formData: FormData) {
  "use server";

  const userId = String(formData.get("userId") || "");
  const companyId = String(formData.get("companyId") || "");

  await approvePendingUser(userId);
  revalidatePath(`/dashboard/companies/${companyId}/users`);
  redirect(
    `/dashboard/companies/${companyId}/users?approveMsg=${encodeURIComponent(
      "User approved."
    )}`
  );
}

async function rejectPendingAction(formData: FormData) {
  "use server";

  const userId = String(formData.get("userId") || "");
  const companyId = String(formData.get("companyId") || "");

  await rejectPendingUser(userId);
  revalidatePath(`/dashboard/companies/${companyId}/users`);
  redirect(
    `/dashboard/companies/${companyId}/users?approveMsg=${encodeURIComponent(
      "User rejected and removed."
    )}`
  );
}

/* ---------- PAGE COMPONENT ---------- */

export default async function CompanyUsersPage(props: Props) {
  const { companyId } = await props.params;
  const searchObj = props.searchParams ? await props.searchParams : {};
  const rawSearch = (searchObj.search || "").trim();
  const search = rawSearch.toLowerCase();
  const userMsg = (searchObj.userMsg || "").toString();
  const userError = (searchObj.userError || "").toString();
  const approveMsg = (searchObj.approveMsg || "").toString();
  const importStatus = (searchObj.import || "").toString();

  const role = await getCurrentSessionRole();
  const { data: companyRow } = await supabase
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .maybeSingle();
  const companyName = companyRow?.name || companyId;

  const raw = (await getCompanyUsers(companyId)) as any;

  const active: User[] = Array.isArray(raw)
    ? raw
    : (raw?.active as User[]) || [];
  const pending: User[] = Array.isArray(raw)
    ? []
    : (raw?.pending as User[]) || [];
  const deleted: User[] = Array.isArray(raw)
    ? []
    : (raw?.deleted as User[]) || [];

  const filterFn = (u: User) => {
    if (!search) return true;
    const name = (u.name || "").toLowerCase();
    const ext = (u.extension || "").toLowerCase();
    const email = (u.email || "").toLowerCase();
    const outbound = ((u as any).outbound_caller_id || "").toLowerCase();
    const did = ((u as any).did || "").toLowerCase();

    return (
      name.includes(search) ||
      ext.includes(search) ||
      email.includes(search) ||
      outbound.includes(search) ||
      did.includes(search)
    );
  };

  type Banner = { text: string; tone: "success" | "warning" | "error" };
  const banners: Banner[] = [];

  if (importStatus === "success") {
    banners.push({ text: "CSV imported successfully.", tone: "success" });
  } else if (importStatus === "empty") {
    banners.push({
      text: "The CSV file was empty. Nothing imported.",
      tone: "warning",
    });
  } else if (importStatus === "missing") {
    banners.push({
      text: "Please select a CSV file before importing.",
      tone: "warning",
    });
  } else if (importStatus === "error") {
    banners.push({ text: "CSV import failed. Please try again.", tone: "error" });
  }

  if (userMsg) {
    banners.push({ text: userMsg, tone: "success" });
  }
  if (userError) {
    banners.push({ text: userError, tone: "error" });
  }
  if (approveMsg) {
    banners.push({ text: approveMsg, tone: "success" });
  }

  const activeFiltered = active.filter(filterFn);
  const pendingFiltered = pending.filter(filterFn);
  const deletedFiltered = deleted.filter(filterFn);

  const canHardDelete = role === "admin";

  const pendingSection =
    role === "admin" || (role === "editor" && pendingFiltered.length > 0) ? (
      <section className="bg-white/5 border border-white/10 rounded-2xl shadow-lg shadow-black/30 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5 rounded-t-2xl">
          <h2 className="font-semibold text-base text-white">Pending users</h2>
          <span className="text-xs px-3 py-1 rounded-full bg-amber-500/20 text-amber-100 border border-amber-400/30">
            {pendingFiltered.length} pending
          </span>
        </div>

        <div className="md:hidden space-y-3 p-4">
          {pendingFiltered.length === 0 && (
            <div className="text-center text-slate-300 text-sm py-4">
              No pending users.
            </div>
          )}
          {pendingFiltered.map((u) => (
            <div
              key={u.id}
              className="border border-white/10 rounded-xl p-3 bg-white/5 flex flex-col gap-2"
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-white">{u.name}</p>
                  <p className="text-xs text-slate-300">Ext {u.extension}</p>
                </div>
                <span className="text-xs text-slate-400">{(u as any).did || ""}</span>
              </div>
              <p className="text-xs text-slate-300">{u.email || "No email"}</p>
              <p className="text-xs text-slate-400">
                Dial-out: {(u as any).outbound_caller_id || ""}
              </p>
              <div className="flex gap-2 pt-1">
                <Link
                  href={`/dashboard/companies/${companyId}/users/${u.id}/edit?role=${role}`}
                        className="flex-1 text-xs px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition text-center"
                      >
                        🖉
                </Link>
                {role === "admin" ? (
                  <>
                    <form action={approvePendingAction} className="flex-1">
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="companyId" value={companyId} />
                      <button
                        type="submit"
                        className="w-full text-xs px-3 py-2 rounded-lg border border-emerald-300/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20 transition"
                      >
                        ✓
                      </button>
                    </form>
                    <form action={rejectPendingAction} className="flex-1">
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="companyId" value={companyId} />
                      <button
                        type="submit"
                        className="w-full text-xs px-3 py-2 rounded-lg border border-red-300/40 bg-red-500/10 text-red-100 hover:bg-red-500/20 transition"
                      >
                        Reject
                      </button>
                    </form>
                  </>
                ) : (
                  <span className="text-xs text-amber-100 bg-amber-500/10 border border-amber-300/30 rounded-lg px-3 py-2">
                    🕒
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:block text-xs">
          <table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "22%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "26%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "20%" }} />
            </colgroup>
            <thead className="border-b border-white/10 bg-white/5 text-slate-200">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Extension</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Dial-Out</th>
                <th className="text-left px-4 py-3">Direct (DID)</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingFiltered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-300">
                    No pending users.
                  </td>
                </tr>
              )}

              {pendingFiltered.map((u) => (
                <tr key={u.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 text-white">
                    <span className="block truncate">{u.name || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    <span className="block truncate">{u.extension || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    <span className="block truncate">{u.email || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    <span className="block truncate">
                      {(u as any).outbound_caller_id || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    <span className="block truncate">{(u as any).did || "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/dashboard/companies/${companyId}/users/${u.id}/edit?role=${role}`}
                        className="text-xs px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition"
                      >
                        🖉
                      </Link>
                      {role === "admin" ? (
                        <>
                          <form action={approvePendingAction}>
                            <input type="hidden" name="userId" value={u.id} />
                            <input type="hidden" name="companyId" value={companyId} />
                            <button
                              type="submit"
                              className="text-xs px-3 py-2 rounded-lg border border-emerald-300/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20 transition"
                            >
                              ✓
                            </button>
                          </form>
                      <form action={rejectPendingAction}>
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="companyId" value={companyId} />
                        <button
                          type="submit"
                          className="text-xs px-3 py-2 rounded-lg border border-red-300/40 bg-red-500/10 text-red-100 hover:bg-red-500/20 transition"
                        >
                              Reject
                        </button>
                      </form>
                    </>
                      ) : (
                        <span className="text-xs px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-300/30 text-amber-100">
                          🕒
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    ) : null;

  const activeSection = (
    <section className="bg-white/5 border border-white/10 rounded-2xl shadow-lg shadow-black/30 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5 rounded-t-2xl">
        <h2 className="font-semibold text-base text-white">Active users</h2>
        <span className="text-xs px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-100 border border-indigo-400/30">
          {activeFiltered.length} users
        </span>
      </div>

      <div className="md:hidden space-y-3 p-4">
        {activeFiltered.length === 0 && (
          <div className="text-center text-slate-300 text-sm py-4">
            No active users.
          </div>
        )}
        {activeFiltered.map((u) => (
          <div
            key={u.id}
            className="border border-white/10 rounded-xl p-3 bg-white/5 flex flex-col gap-2"
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold text-white">{u.name}</p>
                <p className="text-xs text-slate-300">Ext {u.extension}</p>
              </div>
              <span className="text-xs text-slate-400">{(u as any).did || ""}</span>
            </div>
            <p className="text-xs text-slate-300">{u.email || "No email"}</p>
            <p className="text-xs text-slate-400">
              Dial-out: {(u as any).outbound_caller_id || ""}
            </p>
            <div className="flex gap-2 pt-1">
              <Link
                href={`/dashboard/companies/${companyId}/users/${u.id}/edit?role=${role}`}
                className="text-xs px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition"
              >
                🖉
              </Link>
              <form action={softDeleteAction} className="flex-1">
                <input type="hidden" name="userId" value={u.id} />
                <input type="hidden" name="companyId" value={companyId} />
                <button
                  type="submit"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-red-300/40 bg-red-500/10 text-red-100 hover:bg-red-500/20 transition"
                >
                        Delete
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block text-xs">
        <table className="w-full" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "22%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "26%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "20%" }} />
          </colgroup>
          <thead className="border-b border-white/10 bg-white/5 text-slate-200">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Extension</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Dial-Out</th>
              <th className="text-left px-4 py-3">Direct (DID)</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {activeFiltered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-300">
                  No active users.
                </td>
              </tr>
            )}

            {activeFiltered.map((u) => (
              <tr key={u.id} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-3 text-white">
                  <span className="block truncate">{u.name || "—"}</span>
                </td>
                <td className="px-4 py-3 text-slate-200">
                  <span className="block truncate">{u.extension || "—"}</span>
                </td>
                <td className="px-4 py-3 text-slate-200">
                  <span className="block truncate">{u.email || "—"}</span>
                </td>
                <td className="px-4 py-3 text-slate-200">
                  <span className="block truncate">
                    {(u as any).outbound_caller_id || "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-200">
                  <span className="block truncate">{(u as any).did || "—"}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link
                      href={`/dashboard/companies/${companyId}/users/${u.id}/edit?role=${role}`}
                      className="text-xs px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition"
                    >
                      🖉
                    </Link>

                    <form action={softDeleteAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="companyId" value={companyId} />
                      <button
                        type="submit"
                        className="text-xs px-3 py-2 rounded-lg border border-red-300/40 bg-red-500/10 text-red-100 hover:bg-red-500/20 transition"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  const deletedSection = (
    <section className="bg-white/5 border border-white/10 rounded-2xl shadow-lg shadow-black/30 backdrop-blur mb-10">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5 rounded-t-2xl">
        <h2 className="font-semibold text-base text-white">Deleted users</h2>
        <span className="text-xs px-3 py-1 rounded-full bg-amber-500/20 text-amber-100 border border-amber-400/30">
          {deletedFiltered.length} users
        </span>
      </div>

      <div className="md:hidden space-y-3 p-4">
        {deletedFiltered.length === 0 && (
          <div className="text-center text-slate-300 text-sm py-4">
            No deleted users.
          </div>
        )}
        {deletedFiltered.map((u) => (
          <div
            key={u.id}
            className="border border-white/10 rounded-xl p-3 bg-white/5 flex flex-col gap-2"
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold text-white">{u.name}</p>
                <p className="text-xs text-slate-300">Ext {u.extension}</p>
              </div>
              <span className="text-xs text-slate-400">{(u as any).did || ""}</span>
            </div>
            <p className="text-xs text-slate-300">{u.email || "No email"}</p>
            <p className="text-xs text-slate-400">
              Dial-out: {(u as any).outbound_caller_id || ""}
            </p>
            <div className="flex gap-2 pt-1">
              <form action={restoreAction} className="flex-1">
                <input type="hidden" name="userId" value={u.id} />
                <input type="hidden" name="companyId" value={companyId} />
                <button
                  type="submit"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-emerald-300/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20 transition"
                >
                  Restore
                </button>
              </form>

              {canHardDelete && (
                <form action={deleteForeverAction} className="flex-1">
                  <input type="hidden" name="userId" value={u.id} />
                  <input type="hidden" name="companyId" value={companyId} />
                  <button
                    type="submit"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-red-300/40 bg-red-500/10 text-red-100 hover:bg-red-500/20 transition"
                  >
                        X
</button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block text-xs">
        <table className="w-full text-sm table-fixed">
          <colgroup>
              <col style={{ width: "22%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "26%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "20%" }} />
          </colgroup>
          <thead className="border-b border-white/10 bg-white/5">
            <tr className="text-slate-200">
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Extension</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Dial-Out</th>
              <th className="text-left px-4 py-3">Direct (DID)</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {deletedFiltered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-300">
                  No deleted users.
                </td>
              </tr>
            )}

            {deletedFiltered.map((u) => (
              <tr key={u.id} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-3 text-white">{u.name}</td>
                <td className="px-4 py-3 text-slate-200">{u.extension}</td>
                <td className="px-4 py-3 text-slate-200">{u.email}</td>
                <td className="px-4 py-3 text-slate-200">
                  {(u as any).outbound_caller_id || ""}
                </td>
                <td className="px-4 py-3 text-slate-200">{(u as any).did || ""}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <form action={restoreAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="companyId" value={companyId} />
                      <button
                        type="submit"
                        className="text-xs px-3 py-2 rounded-lg border border-emerald-300/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20 transition"
                      >
                        Restore
                      </button>
                    </form>

                        {canHardDelete && (
                          <form action={deleteForeverAction}>
                            <input type="hidden" name="userId" value={u.id} />
                            <input type="hidden" name="companyId" value={companyId} />
                            <button
                              type="submit"
                              className="text-xs px-3 py-2 rounded-lg border border-red-300/40 bg-red-500/10 text-red-100 hover:bg-red-500/20 transition"
                            >
                        X
</button>
                          </form>
                        )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <div className="min-h-screen w-screen bg-slate-950 text-slate-50 overflow-x-hidden">
      <header className="w-full border-b border-white/10 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
        <div className="w-full px-4 md:px-6 lg:px-10 py-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              3CX User Manager
            </p>
            <h1 className="text-2xl font-semibold text-white">Company users</h1>
            <p className="text-sm text-slate-300">{companyName}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {role === "admin" && (
              <Link
                href="/dashboard/companies"
                className="text-xs md:text-sm px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition"
              >
                ← Back to companies
              </Link>
            )}
            <span className="text-xs md:text-sm px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-200">
              Role: {role}
            </span>
            <form action="/api/logout" method="POST">
              <button
                type="submit"
                className="text-xs md:text-sm px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="w-full px-4 md:px-6 lg:px-10 py-8 flex flex-col gap-6">
        {banners.map((banner, idx) => (
          <div
            key={idx}
            className={`rounded-xl border px-4 py-3 text-sm ${
              banner.tone === "success"
                ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-100"
                : banner.tone === "warning"
                ? "bg-amber-500/15 border-amber-400/40 text-amber-100"
                : "bg-red-500/15 border-red-400/40 text-red-100"
            }`}
          >
            {banner.text}
          </div>
        ))}

        <section className="grid gap-4 md:grid-cols-2">
          {/* ADD USER */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-lg shadow-black/30 backdrop-blur">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-base text-white">Add new user</h2>
              <span className="text-xs text-slate-400">Quick create</span>
            </div>
            <form action={addUserAction} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="hidden" name="companyId" value={companyId} />
              <input type="hidden" name="role" value={role} />

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-300">Name</label>
                <input
                  name="name"
                  required
                  placeholder="User name"
                  className="border border-white/10 rounded-lg px-3 py-2 text-sm bg-white/5 text-white placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-300">Extension</label>
                <input
                  name="extension"
                  placeholder="100"
                  className="border border-white/10 rounded-lg px-3 py-2 text-sm bg-white/5 text-white placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-300">Email</label>
                <input
                  name="email"
                  type="email"
                  placeholder="user@example.com"
                  className="border border-white/10 rounded-lg px-3 py-2 text-sm bg-white/5 text-white placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-300">Dial-Out Number</label>
                <input
                  name="outbound"
                  placeholder="+43 1 234567"
                  className="border border-white/10 rounded-lg px-3 py-2 text-sm bg-white/5 text-white placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-300">Direct Number (DID)</label>
                <input
                  name="did"
                  placeholder="+43 1 765432"
                  className="border border-white/10 rounded-lg px-3 py-2 text-sm bg-white/5 text-white placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full px-4 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium transition shadow-md shadow-indigo-900/40"
                >
                  + Add user
                </button>
              </div>

              <p className="sm:col-span-2 text-xs text-slate-400">
                Extension must be unique within this company (active users).
              </p>
            </form>
          </div>

          {/* IMPORT CSV + SEARCH */}
          <div className="space-y-4">
            {role === "admin" && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-lg shadow-black/30 backdrop-blur">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-base text-white">Import users from 3CX CSV</h2>
                  <span className="text-xs text-slate-400">Bulk</span>
                </div>
                <p className="text-xs text-slate-300 mb-3">
                  Expected columns: <strong>Number</strong>, <strong>FirstName</strong>,{" "}
                  <strong>LastName</strong>, <strong>EmailAddress</strong>,{" "}
                  <strong>OutboundCallerID</strong>, <strong>DID</strong>. Others are ignored;
                  existing extensions are skipped.
                </p>
                <form
                  action={importCsvAction}
                  className="flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <input type="hidden" name="companyId" value={companyId} />
                  <input
                    type="file"
                    name="file"
                    accept=".csv"
                    required
                    className="text-sm text-slate-200"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-white text-sm font-medium transition"
                  >
                    Import CSV
                  </button>
                </form>
                <p className="text-xs text-slate-400 mt-2">
                  Select a CSV file first; empty submissions are ignored.
                </p>
              </div>
            )}

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 shadow-lg shadow-black/30 backdrop-blur">
              <form method="GET" className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm">
                <div className="flex flex-col gap-1 w-full sm:w-auto">
                  <label className="text-xs text-slate-300">Search users</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="search"
                      defaultValue={rawSearch}
                      placeholder="Name, extension, email, DID…"
                      className="border border-white/10 rounded-lg px-3 py-2 text-sm bg-white/5 text-white placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none w-full sm:w-64"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-medium transition shadow-md shadow-indigo-900/40"
                    >
                      Search
                    </button>
                  </div>
                </div>
                {rawSearch && (
                  <Link
                    href={`/dashboard/companies/${companyId}/users`}
                    className="text-xs text-slate-300 underline"
                  >
                    Clear
                  </Link>
                )}
              </form>
            </div>
          </div>
        </section>

        {/* PENDING USERS (admin can act, editor can view) */}
        {(role === "admin" || (role === "editor" && pendingFiltered.length > 0)) && (
      <section
        className="bg-white/5 border border-white/10 rounded-2xl shadow-lg shadow-black/30 backdrop-blur"
        style={{ order: role === "admin" ? 1 : 2 }}
      >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5 rounded-t-2xl">
              <h2 className="font-semibold text-base text-white">Pending users</h2>
              <span className="text-xs px-3 py-1 rounded-full bg-amber-500/20 text-amber-100 border border-amber-400/30">
                {pendingFiltered.length} pending
              </span>
            </div>

            <div className="md:hidden space-y-3 p-4">
              {pendingFiltered.length === 0 && (
                <div className="text-center text-slate-300 text-sm py-4">
                  No pending users.
                </div>
              )}
              {pendingFiltered.map((u) => (
                <div
                  key={u.id}
                  className="border border-white/10 rounded-xl p-3 bg-white/5 flex flex-col gap-2"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-white">{u.name}</p>
                      <p className="text-xs text-slate-300">Ext {u.extension}</p>
                    </div>
                    <span className="text-xs text-slate-400">
                      {(u as any).did || "—"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{u.email || "No email"}</p>
                  <p className="text-xs text-slate-400">
                    Dial-out: {(u as any).outbound_caller_id || "—"}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Link
                      href={`/dashboard/companies/${companyId}/users/${u.id}/edit?role=${role}`}
                      className="flex-1 text-xs px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition text-center"
                        >
                          🖉
                    </Link>
                    {role === "admin" ? (
                      <>
                        <form action={approvePendingAction} className="flex-1">
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="companyId" value={companyId} />
                          <button
                            type="submit"
                            className="w-full text-xs px-3 py-2 rounded-lg border border-emerald-300/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20 transition"
                      >
                        ✓
                          </button>
                        </form>
                    <form action={rejectPendingAction} className="flex-1">
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="companyId" value={companyId} />
                      <button
                        type="submit"
                        className="w-full text-xs px-3 py-2 rounded-lg border border-red-300/40 bg-red-500/10 text-red-100 hover:bg-red-500/20 transition"
                    >
                      Reject
                      </button>
                    </form>
                  </>
                    ) : (
                        <span className="text-xs text-amber-100 bg-amber-500/10 border border-amber-300/30 rounded-lg px-3 py-2">
                        🕒
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

          <div className="hidden md:block text-xs">
            <table className="w-full" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "22%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "26%" }} />
              </colgroup>
              <thead className="border-b border-white/10 bg-white/5">
                <tr className="text-slate-200">
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Extension</th>
                  <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">Dial-Out</th>
                    <th className="text-left px-4 py-3">Direct (DID)</th>
                    <th className="text-left px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingFiltered.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-6 text-center text-slate-300"
                      >
                        No pending users.
                      </td>
                    </tr>
                  )}

                  {pendingFiltered.map((u) => (
                <tr key={u.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 text-white">
                    <span className="block truncate">{u.name || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    <span className="block truncate">{u.extension || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    <span className="block truncate">{u.email || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    <span className="block truncate">
                      {(u as any).outbound_caller_id || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    <span className="block truncate">{(u as any).did || "—"}</span>
                  </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Link
                            href={`/dashboard/companies/${companyId}/users/${u.id}/edit?role=${role}`}
                            className="text-xs px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition"
                        >
                          🖉
                          </Link>
                          {role === "admin" ? (
                            <>
                              <form action={approvePendingAction}>
                                <input type="hidden" name="userId" value={u.id} />
                                <input type="hidden" name="companyId" value={companyId} />
                                <button
                                  type="submit"
                                  className="text-xs px-3 py-2 rounded-lg border border-emerald-300/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20 transition"
                        >
                          ✓
                                </button>
                              </form>
                          <form action={rejectPendingAction}>
                            <input type="hidden" name="userId" value={u.id} />
                            <input type="hidden" name="companyId" value={companyId} />
                            <button
                              type="submit"
                              className="text-xs px-3 py-2 rounded-lg border border-red-300/40 bg-red-500/10 text-red-100 hover:bg-red-500/20 transition"
                        >
                              Reject
                            </button>
                          </form>
                          </>
                        ) : (
                          <span className="text-xs px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-300/30 text-amber-100">
                          🕒
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ACTIVE USERS */}
    <section
      className="bg-white/5 border border-white/10 rounded-2xl shadow-lg shadow-black/30 backdrop-blur"
      style={{ order: role === "admin" ? 3 : 1 }}
    >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5 rounded-t-2xl">
            <h2 className="font-semibold text-base text-white">Active users</h2>
            <span className="text-xs px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-100 border border-indigo-400/30">
              {activeFiltered.length} users
            </span>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3 p-4">
            {activeFiltered.length === 0 && (
              <div className="text-center text-slate-300 text-sm py-4">
                No active users.
              </div>
            )}
            {activeFiltered.map((u) => (
              <div
                key={u.id}
                className="border border-white/10 rounded-xl p-3 bg-white/5 flex flex-col gap-2"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-white">{u.name}</p>
                    <p className="text-xs text-slate-300">Ext {u.extension}</p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {(u as any).did || "—"}
                  </span>
                </div>
                <p className="text-xs text-slate-300">{u.email || "No email"}</p>
                <p className="text-xs text-slate-400">
                  Dial-out: {(u as any).outbound_caller_id || "—"}
                </p>
                <div className="flex gap-2 pt-1">
                  <Link
                    href={`/dashboard/companies/${companyId}/users/${u.id}/edit?role=${role}`}
                    className="text-xs px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition"
                      >
                        🖉
                  </Link>
                  <form action={softDeleteAction} className="flex-1">
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="companyId" value={companyId} />
                    <button
                      type="submit"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-red-300/40 bg-red-500/10 text-red-100 hover:bg-red-500/20 transition"
                        >
                          Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block text-xs">
            <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "22%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "26%" }} />
              </colgroup>
              <thead className="border-b border-white/10 bg-white/5">
                <tr className="text-slate-200">
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Extension</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Dial-Out</th>
                  <th className="text-left px-4 py-3">Direct (DID)</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeFiltered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-slate-300"
                    >
                      No active users.
                    </td>
                  </tr>
                )}

                {activeFiltered.map((u) => (
                <tr key={u.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 text-white">
                    <span className="block truncate">{u.name || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    <span className="block truncate">{u.extension || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    <span className="block truncate">{u.email || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    <span className="block truncate">
                      {(u as any).outbound_caller_id || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    <span className="block truncate">{(u as any).did || "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link
                          href={`/dashboard/companies/${companyId}/users/${u.id}/edit?role=${role}`}
                          className="text-xs px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition"
                        >
                          🖉
                        </Link>

                        <form action={softDeleteAction}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="companyId" value={companyId} />
                          <button
                            type="submit"
                            className="text-xs px-3 py-2 rounded-lg border border-red-300/40 bg-red-500/10 text-red-100 hover:bg-red-500/20 transition"
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* DELETED USERS */}
    <section
      className="bg-white/5 border border-white/10 rounded-2xl shadow-lg shadow-black/30 backdrop-blur mb-10"
      style={{ order: role === "admin" ? 2 : 3 }}
    >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5 rounded-t-2xl">
            <h2 className="font-semibold text-base text-white">Deleted users</h2>
            <span className="text-xs px-3 py-1 rounded-full bg-amber-500/20 text-amber-100 border border-amber-400/30">
              {deletedFiltered.length} users
            </span>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3 p-4">
            {deletedFiltered.length === 0 && (
              <div className="text-center text-slate-300 text-sm py-4">
                No deleted users.
              </div>
            )}
            {deletedFiltered.map((u) => (
              <div
                key={u.id}
                className="border border-white/10 rounded-xl p-3 bg-white/5 flex flex-col gap-2"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-white">{u.name}</p>
                    <p className="text-xs text-slate-300">Ext {u.extension}</p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {(u as any).did || "—"}
                  </span>
                </div>
                <p className="text-xs text-slate-300">{u.email || "No email"}</p>
                <p className="text-xs text-slate-400">
                  Dial-out: {(u as any).outbound_caller_id || "—"}
                </p>
                <div className="flex gap-2 pt-1">
                  <form action={restoreAction} className="flex-1">
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="companyId" value={companyId} />
                    <button
                      type="submit"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-emerald-300/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20 transition"
                    >
                      Restore
                    </button>
                  </form>

                  {canHardDelete && (
                    <form action={deleteForeverAction} className="flex-1">
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="companyId" value={companyId} />
                      <button
                        type="submit"
                        className="w-full text-xs px-3 py-2 rounded-lg border border-red-300/40 bg-red-500/10 text-red-100 hover:bg-red-500/20 transition"
                      >
                        X
</button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block text-xs">
            <table className="w-full" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "22%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "26%" }} />
              </colgroup>
              <thead className="border-b border-white/10 bg-white/5">
                <tr className="text-slate-200">
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Extension</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Dial-Out</th>
                  <th className="text-left px-4 py-3">Direct (DID)</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deletedFiltered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-slate-300"
                    >
                      No deleted users.
                    </td>
                  </tr>
                )}

                {deletedFiltered.map((u) => (
                <tr key={u.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 text-white">
                    <span className="block truncate">{u.name || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    <span className="block truncate">{u.extension || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    <span className="block truncate">{u.email || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    <span className="block truncate">
                      {(u as any).outbound_caller_id || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    <span className="block truncate">{(u as any).did || "—"}</span>
                  </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <form action={restoreAction}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="companyId" value={companyId} />
                          <button
                            type="submit"
                            className="text-xs px-3 py-2 rounded-lg border border-emerald-300/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20 transition"
                          >
                            Restore
                          </button>
                        </form>

                        {canHardDelete && (
                          <form action={deleteForeverAction}>
                            <input type="hidden" name="userId" value={u.id} />
                            <input type="hidden" name="companyId" value={companyId} />
                            <button
                              type="submit"
                              className="text-xs px-3 py-2 rounded-lg border border-red-300/40 bg-red-500/10 text-red-100 hover:bg-red-500/20 transition"
                            >
                        X
</button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
