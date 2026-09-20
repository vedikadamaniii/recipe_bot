import { createClient } from "@/lib/supabase/server";
import { OWNER_ID } from "@/lib/owner";
import { getTasteProfile, listPantry } from "@/lib/db";
import { GenerateClient } from "./generate-client";

export default async function GeneratePage() {
  const supabase = await createClient();
  const [pantry, profile] = await Promise.all([
    listPantry(supabase),
    getTasteProfile(supabase, OWNER_ID),
  ]);

  return (
    <GenerateClient
      pantryCount={pantry.length}
      hasProfile={profile.summary.trim().length > 0}
    />
  );
}
