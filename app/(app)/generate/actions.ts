"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { OWNER_ID } from "@/lib/owner";
import { saveRecipe } from "@/lib/db";
import type { DraftRecipe } from "@/lib/schema";

/** Save a generated recipe into the library. It is already structured. */
export async function saveGenerated(draft: DraftRecipe): Promise<{ id: string }> {
  const supabase = await createClient();
  const saved = await saveRecipe(supabase, draft, OWNER_ID);

  revalidatePath("/library");
  return { id: saved.id };
}
