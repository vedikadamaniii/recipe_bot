"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { saveRecipe } from "@/lib/db";
import type { DraftRecipe } from "@/lib/schema";

/** Save a generated recipe into the library. It is already structured. */
export async function saveGenerated(draft: DraftRecipe): Promise<{ id: string }> {
  const user = await getUser();
  if (!user) throw new Error("Not signed in.");

  const supabase = await createClient();
  const saved = await saveRecipe(supabase, draft, user.id);

  revalidatePath("/library");
  return { id: saved.id };
}
