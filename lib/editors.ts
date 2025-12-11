// lib/editors.ts
import { supabase } from "./supabaseClient";
import { hashPassword } from "./passwords";

// Random privremena lozinka
function generateTempPassword(length = 10): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!?@#$";
  let res = "";
  for (let i = 0; i < length; i++) {
    res += chars[Math.floor(Math.random() * chars.length)];
  }
  return res;
}

/**
 * Vrati editor nalog za usera (ako postoji)
 */
export async function getEditorAccountForUser(userId: string) {
  const { data, error } = await supabase
    .from("app_accounts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error loading editor account:", error);
    return null;
  }

  return data ?? null;
}

/**
 * Kreira editor nalog
 */
export async function createEditorAccountForUser(params: {
  userId: string;
  companyId: string;
  email: string;
}): Promise<{ success: boolean; tempPassword?: string; error?: string }> {
  const normalizedEmail = params.email.trim().toLowerCase();

  // 1. već postoji?
  const { data: existing, error: checkError } = await supabase
    .from("app_accounts")
    .select("id")
    .eq("user_id", params.userId)
    .limit(1);

  if (checkError) {
    console.error("Error checking existing editor:", checkError);
    return { success: false, error: checkError.message };
  }

  if (existing && existing.length > 0) {
    return { success: false, error: "Editor account already exists." };
  }

  // 2. generiši password
  const tempPassword = generateTempPassword();
  const passwordHash = hashPassword(tempPassword);

  // 3. insert u db
  const { error: insertError } = await supabase.from("app_accounts").insert({
    user_id: params.userId,
    company_id: params.companyId,
    email: normalizedEmail,
    role: "editor",
    password_hash: passwordHash,
    is_active: true,
  });

  if (insertError) {
    console.error("Error creating editor account:", insertError);
    return { success: false, error: insertError.message };
  }

  return { success: true, tempPassword };
}

/**
 * Uklanja editor nalog za usera
 */
export async function removeEditorAccountForUser(userId: string) {
  const { error } = await supabase
    .from("app_accounts")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("Error removing editor account:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
