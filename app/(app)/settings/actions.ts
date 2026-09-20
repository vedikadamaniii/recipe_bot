"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OWNER_ID } from "@/lib/owner";
import { saveTasteProfile } from "@/lib/db";
import type { TasteProfile } from "@/lib/schema";

/** Split a comma- or newline-separated list into clean entries. */
function parseList(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function saveProfile(formData: FormData) {
  const spice = String(formData.get("spiceLevel") ?? "");

  const profile: TasteProfile = {
    userId: OWNER_ID,
    summary: String(formData.get("summary") ?? "").trim(),
    allergies: parseList(formData.get("allergies")),
    dislikes: parseList(formData.get("dislikes")),
    spiceLevel:
      spice === "mild" || spice === "medium" || spice === "hot" ? spice : null,
    equipment: parseList(formData.get("equipment")),
  };

  const supabase = await createClient();
  await saveTasteProfile(supabase, profile);
  revalidatePath("/settings");
  revalidatePath("/generate");

  // Redirect rather than fall through, so the form remounts from saved state
  // and the save is actually confirmed. Without this a successful save looked
  // identical to no save at all.
  redirect("/settings?saved=1");
}
