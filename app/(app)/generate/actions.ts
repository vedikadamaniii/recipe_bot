"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUnlocked } from "@/lib/access";
import { saveRecipe } from "@/lib/db";
import { OWNER_ID } from "@/lib/owner";
import type { DraftRecipe } from "@/lib/schema";

/**
 * Save a recipe to the library.
 *
 * Writes go through the service-role client, which bypasses row-level
 * security, so the unlock check here is the only thing standing between a
 * public URL and a writable database. It must come first.
 */
export async function saveGenerated(draft: DraftRecipe): Promise<{ id: string }> {
  if (!(await isUnlocked())) {
    throw new Error("Saving is limited to the owner of this instance.");
  }

  const supabase = createAdminClient();
  const saved = await saveRecipe(supabase, draft, OWNER_ID);

  revalidatePath("/library");
  return { id: saved.id };
}
