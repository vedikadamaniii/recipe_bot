"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
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
  const user = await getUser();
  if (!user) throw new Error("Not signed in.");

  const spice = String(formData.get("spiceLevel") ?? "");

  const profile: TasteProfile = {
    userId: user.id,
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
}
