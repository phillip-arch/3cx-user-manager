// lib/data.ts
import { supabase } from "./supabaseClient";
import { supabaseAdmin } from "./supabaseAdmin";

// Prefer the service role key for writes so RLS does not block server actions.
const writeClient = supabaseAdmin ?? supabase;

/* TYPES
   ------------------------------------------------------------------ */

export type Company = {
  id: string;
  name: string;
};

export type User = {
  id: string;
  company_id: string;
  name: string;
  extension: string | null;
  email: string | null;
  status: "active" | "pending" | "deleted" | null | undefined;
  created_at: string;
  outbound_caller_id?: string | null;
  did?: string | null;
};

type UpdateUserInput = {
  userId: string;
  companyId: string;
  name: string;
  extension: string;
  email: string;
  outboundCallerId: string;
  did: string;
};

/* COMPANIES
   ------------------------------------------------------------------ */

export async function getCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error loading companies:", error);
    return [];
  }

  return (data || []) as Company[];
}

/* USERS - READ
   ------------------------------------------------------------------ */

export async function getCompanyUsers(
  companyId: string
): Promise<{ active: User[]; pending: User[]; deleted: User[] }> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("company_id", companyId)
    .order("extension", { ascending: true });

  if (error || !data) {
    console.error("Error loading users:", error);
    return { active: [], pending: [], deleted: [] };
  }

  const active: User[] = [];
  const pending: User[] = [];
  const deleted: User[] = [];

  for (const user of data as User[]) {
    if (user.status === "deleted") {
      deleted.push(user);
    } else if (user.status === "pending") {
      pending.push(user);
    } else {
      active.push(user);
    }
  }

  return { active, pending, deleted };
}

export async function getUserById(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error loading user by id:", error);
    return null;
  }

  return (data as User) || null;
}

/* USERS - WRITE HELPERS
   ------------------------------------------------------------------ */

type AddUserInput = {
  companyId: string;
  name: string;
  extension: string;
  email: string | null;
  outboundCallerId: string | null;
  did: string | null;
  status?: "active" | "pending";
};

/**
 * Adds a user after checking the extension is not already used
 * in the company (counts only active/null statuses).
 */
export async function addUserWithValidation(
  input: AddUserInput
): Promise<{ success: boolean; error?: string }> {
  const { companyId, name, extension, email, outboundCallerId, did, status } =
    input;

  // 1) Check for duplicate extension within the company
  const { data: existing, error: extError } = await writeClient
    .from("users")
    .select("id, extension, status")
    .eq("company_id", companyId)
    .eq("extension", extension);

  if (extError) {
    console.error("Error checking extension:", extError);
    return { success: false, error: "Error checking extension uniqueness." };
  }

  const alreadyUsed =
    existing &&
    existing.some(
      (u) =>
        u.status === "active" ||
        u.status === "pending" ||
        u.status === null ||
        u.status === undefined
    );

  if (alreadyUsed) {
    return {
      success: false,
      error: `Extension ${extension} is already used in this company.`,
    };
  }

  // 2) Insert user
  const { error: insertError } = await writeClient.from("users").insert([
    {
      company_id: companyId,
      name,
      extension,
      email,
      status: status ?? "active",
      outbound_caller_id: outboundCallerId,
      did,
    },
  ]);

  if (insertError) {
    console.error("Error inserting user:", insertError);
    return { success: false, error: "Failed to insert user." };
  }

  return { success: true };
}

/**
 * Soft delete -> set status = 'deleted'
 */
export async function softDeleteUser(userId: string): Promise<void> {
  const { error } = await writeClient
    .from("users")
    .update({ status: "deleted" })
    .eq("id", userId);

  if (error) {
    console.error("Error soft-deleting user:", error);
    throw new Error("Failed to soft-delete user.");
  }
}

/**
 * Restore -> set status = 'active'
 */
export async function restoreUser(userId: string): Promise<void> {
  const { error } = await writeClient
    .from("users")
    .update({ status: "active" })
    .eq("id", userId);

  if (error) {
    console.error("Error restoring user:", error);
    throw new Error("Failed to restore user.");
  }
}

/**
 * Hard delete -> permanently removes a user (admin only)
 */
export async function deleteUserForever(userId: string): Promise<void> {
  const { error } = await writeClient.from("users").delete().eq("id", userId);

  if (error) {
    console.error("Error deleting user forever:", error);
    throw new Error("Failed to delete user forever.");
  }
}

/**
 * Approve a pending user -> set status = 'active'
 */
export async function approvePendingUser(userId: string): Promise<void> {
  const { error } = await writeClient
    .from("users")
    .update({ status: "active" })
    .eq("id", userId)
    .eq("status", "pending");

  if (error) {
    console.error("Error approving user:", error);
    throw new Error("Failed to approve user.");
  }
}

/**
 * Reject a pending user -> delete the record
 */
export async function rejectPendingUser(userId: string): Promise<void> {
  const { error } = await writeClient
    .from("users")
    .delete()
    .eq("id", userId)
    .eq("status", "pending");

  if (error) {
    console.error("Error rejecting user:", error);
    throw new Error("Failed to reject user.");
  }
}

export async function updateUser(
  input: UpdateUserInput
): Promise<{ success: boolean; error?: string }> {
  const { userId, companyId, name, extension, email, outboundCallerId, did } =
    input;

  const { error } = await writeClient
    .from("users")
    .update({
      name: name || null,
      extension: extension || null,
      email: email || null,
      outbound_caller_id: outboundCallerId || null,
      did: did || null,
    })
    .eq("id", userId)
    .eq("company_id", companyId);

  if (error) {
    console.error("Error updating user:", error);
    return { success: false, error: "Failed to update user." };
  }

  return { success: true };
}

/* CSV IMPORT
   ------------------------------------------------------------------ */

/**
 * Expects CSV with columns:
 * Number, FirstName, LastName, EmailAddress, OutboundCallerID, DID
 * Ignores everything else.
 * Skips extensions that already exist in the company.
 */
export async function importUsersFromCsv(
  companyId: string,
  csvText: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      return { success: false, error: "CSV file seems to be empty." };
    }

    const header = lines[0].split(",");
    const idxNumber = header.indexOf("Number");
    const idxFirstName = header.indexOf("FirstName");
    const idxLastName = header.indexOf("LastName");
    const idxEmail = header.indexOf("EmailAddress");
    const idxOutbound = header.indexOf("OutboundCallerID");
    const idxDid = header.indexOf("DID");

    if (idxNumber === -1) {
      return {
        success: false,
        error: "CSV must contain a 'Number' column.",
      };
    }

    // Existing extensions so we can skip those that already exist
    const { data: existing, error: existingError } = await writeClient
      .from("users")
      .select("extension, status")
      .eq("company_id", companyId);

    if (existingError) {
      console.error("Error loading existing extensions:", existingError);
      return { success: false, error: "Failed to load existing users." };
    }

    const usedExtensions = new Set(
      (existing || [])
        .filter(
          (u) =>
            u.status === "active" ||
            u.status === "pending" ||
            u.status === null ||
            u.status === undefined
        )
        .map((u) => (u.extension || "").toString())
    );

    const rowsToInsert: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (!row) continue;

      const cols = row.split(",");
      if (cols.length === 0) continue;

      const ext = (cols[idxNumber] || "").trim();
      if (!ext) continue;
      if (usedExtensions.has(ext)) continue; // already exists

      const firstName = idxFirstName >= 0 ? (cols[idxFirstName] || "").trim() : "";
      const lastName = idxLastName >= 0 ? (cols[idxLastName] || "").trim() : "";
      const email =
        idxEmail >= 0 ? (cols[idxEmail] || "").trim() || null : null;
      const outbound =
        idxOutbound >= 0 ? (cols[idxOutbound] || "").trim() || null : null;
      const did = idxDid >= 0 ? (cols[idxDid] || "").trim() || null : null;

      const name =
        firstName || lastName
          ? `${firstName} ${lastName}`.trim()
          : ext; // fallback -> use ext when no name

      rowsToInsert.push({
        company_id: companyId,
        name,
        extension: ext,
        email,
        outbound_caller_id: outbound,
        did,
        status: "active",
      });

      usedExtensions.add(ext);
    }

    if (rowsToInsert.length === 0) {
      return {
        success: true,
        error: "No new users to import (all extensions already exist).",
      };
    }

    const { error: insertError } = await writeClient
      .from("users")
      .insert(rowsToInsert);

    if (insertError) {
      console.error("Error inserting CSV users:", insertError);
      return { success: false, error: "Failed to insert imported users." };
    }

    return { success: true };
  } catch (e) {
    console.error("CSV import error:", e);
    return { success: false, error: "Unexpected error while importing CSV." };
  }
}
