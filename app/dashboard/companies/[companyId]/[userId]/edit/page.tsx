// app/dashboard/companies/[companyId]/users/[userId]/edit/page.tsx
import { getCompanyUsers, getUserById, updateUser } from "@/lib/data";
import {
  getEditorAccountForUser,
  createEditorAccountForUser,
  removeEditorAccountForUser,
} from "@/lib/editors";
import { redirect } from "next/navigation";

export default async function EditUserPage(props: {
  params: Promise<{ companyId: string; userId: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { companyId, userId } = await props.params;
  const search = await props.searchParams;
  const message = search.message || "";
  const errorMessage = search.error || "";

  const user = await getUserById(userId);
  if (!user) {
    return <div>User not found.</div>;
  }

  const editorAccount = await getEditorAccountForUser(userId);
  const hasEditor = !!editorAccount;

  const baseUrl = `/dashboard/companies/${companyId}/users/${userId}/edit`;

  // UPDATE user action
  async function updateUserAction(formData: FormData) {
    "use server";

    const name = String(formData.get("name") || "");
    const extension = String(formData.get("extension") || "");
    const email = String(formData.get("email") || "");
    const callerId = String(formData.get("outbound_caller_id") || "");
    const did = String(formData.get("did") || "");

    const result = await updateUser({
      userId,
      companyId,
      name,
      extension,
      email,
      outboundCallerId: callerId,
      did,
    });

    if (!result.success) {
      redirect(`${baseUrl}?error=${encodeURIComponent(result.error!)}`);
    }

    redirect(`${baseUrl}?message=${encodeURIComponent("User updated successfully!")}`);
  }

  async function makeEditorAction(formData: FormData) {
    "use server";

    const email = String(formData.get("editorEmail") || "");

    const result = await createEditorAccountForUser({
      userId,
      companyId,
      email,
    });

    if (!result.success) {
      redirect(`${baseUrl}?error=${encodeURIComponent(result.error!)}`);
    }

    const msg = `Editor created. Temporary password: ${result.tempPassword}`;
    redirect(`${baseUrl}?message=${encodeURIComponent(msg)}`);
  }

  async function removeEditorAction() {
    "use server";

    await removeEditorAccountForUser(userId);

    redirect(
      `${baseUrl}?message=${encodeURIComponent("Editor access removed.")}`
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold mb-4">Edit User</h1>

      {message && <p className="text-green-700 text-sm">{message}</p>}
      {errorMessage && <p className="text-red-700 text-sm">{errorMessage}</p>}

      {/* UPDATE USER FORM */}
      <form action={updateUserAction} className="space-y-3 bg-white p-4 border rounded-xl">
        <h2 className="text-lg font-semibold mb-2">User Details</h2>

        <div>
          <label className="block text-xs mb-1">Name</label>
          <input
            name="name"
            defaultValue={user.name}
            className="border px-2 py-1 rounded-md w-full"
            required
          />
        </div>

        <div>
          <label className="block text-xs mb-1">Extension</label>
          <input
            name="extension"
            defaultValue={user.extension ?? ""}
            className="border px-2 py-1 rounded-md w-full"
          />
        </div>

        <div>
          <label className="block text-xs mb-1">Email</label>
          <input
            name="email"
            defaultValue={user.email ?? ""}
            className="border px-2 py-1 rounded-md w-full"
          />
        </div>

        <div>
          <label className="block text-xs mb-1">Outbound Caller ID</label>
          <input
            name="outbound_caller_id"
            defaultValue={user.outbound_caller_id ?? ""}
            className="border px-2 py-1 rounded-md w-full"
          />
        </div>

        <div>
          <label className="block text-xs mb-1">DID</label>
          <input
            name="did"
            defaultValue={user.did ?? ""}
            className="border px-2 py-1 rounded-md w-full"
          />
        </div>

        <button className="mt-2 px-4 py-2 bg-slate-900 text-white rounded-md text-sm">
          Save Changes
        </button>
      </form>

      {/* EDITOR ACCESS SECTION */}
      <section className="bg-white p-4 border rounded-xl">
        <h2 className="text-lg font-semibold mb-3">Editor Access</h2>

        {hasEditor ? (
          <>
            <p className="text-green-700 text-sm mb-3">
              Editor account active for: {editorAccount.email}
            </p>

            <form action={removeEditorAction}>
              <button className="px-4 py-2 rounded-md border text-red-700 text-sm">
                Remove Editor Access
              </button>
            </form>
          </>
        ) : (
          <form action={makeEditorAction} className="space-y-3 max-w-sm">
            <div>
              <label className="block text-xs mb-1">Editor Email</label>
              <input
                name="editorEmail"
                defaultValue={user.email ?? ""}
                className="border px-2 py-1 rounded-md w-full"
                required
              />
            </div>

            <button className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm">
              Create Editor Account
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
