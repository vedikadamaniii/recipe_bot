"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { OWNER_ID } from "@/lib/owner";
import { addPantryItem, removePantryItem } from "@/lib/db";
import { parseIngredientLine } from "@/lib/parse";

/**
 * Add pantry items.
 *
 * Accepts several at once, comma or newline separated, and runs each through
 * the same deterministic parser the recipe importer uses — so "2 cups red
 * lentils" lands with its quantity intact rather than as a literal name.
 */
export async function addItems(formData: FormData) {
  const raw = String(formData.get("items") ?? "");
  const lines = raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length === 0) return;

  const supabase = await createClient();
  for (const line of lines) {
    const parsed = parseIngredientLine(line);
    const name = parsed.item || line;
    await addPantryItem(supabase, OWNER_ID, {
      name,
      qty: parsed.qty,
      unit: parsed.unit,
    });
  }

  revalidatePath("/pantry");
  revalidatePath("/generate");
}

export async function removeItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await removePantryItem(supabase, id);
  revalidatePath("/pantry");
  revalidatePath("/generate");
}
