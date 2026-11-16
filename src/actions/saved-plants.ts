"use server";

import { getAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * saved_plants Server Actions (Phase 2 frontend integration).
 *
 * Security: identity is verified server-side via getClaims() (never the
 * client's word), then RLS (`p_saved_plants_owner_all`) bounds every row to
 * the authenticated owner. The plant must exist AND be published — checked
 * with a SELECT before insert (app-level rule, DATABASE_SCHEMA.md §3.6).
 *
 * Errors are returned as plain { ok:false, message } — thrown messages are
 * never shown raw to users.
 */

export interface SavePlantResult {
  ok: boolean;
  message: string;
}

export async function savePlant(plantId: string): Promise<SavePlantResult> {
  const auth = await getAuthContext();
  if (!auth.userId) {
    return { ok: false, message: "Sign in to save plants." };
  }
  if (typeof plantId !== "string" || plantId.length !== 36) {
    return { ok: false, message: "Invalid plant reference." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: plant } = await supabase
    .from("plant_library")
    .select("id, slug")
    .eq("id", plantId)
    .eq("is_published", true)
    .maybeSingle();

  if (!plant) {
    return { ok: false, message: "This plant isn't in the library yet." };
  }

  const { error } = await supabase
    .from("saved_plants")
    .insert({ user_id: auth.userId, plant_id: plant.id });

  if (error) {
    if (error.code === "23505") {
      return { ok: true, message: "Already in your saved plants." };
    }
    console.error(`[savePlant] insert failed (${error.code})`);
    return { ok: false, message: "Couldn't save the plant — try again." };
  }
  return { ok: true, message: "Plant saved." };
}

export async function unsavePlant(plantId: string): Promise<SavePlantResult> {
  const auth = await getAuthContext();
  if (!auth.userId) {
    return { ok: false, message: "Sign in first." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("saved_plants")
    .delete()
    .eq("user_id", auth.userId)
    .eq("plant_id", plantId);

  if (error) {
    console.error(`[unsavePlant] delete failed (${error.code})`);
    return { ok: false, message: "Couldn't remove the plant — try again." };
  }
  return { ok: true, message: "Plant removed." };
}
