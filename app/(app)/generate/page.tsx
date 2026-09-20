import { createClient, getUser, canGenerate } from "@/lib/supabase/server";
import { getTasteProfile, listPantry } from "@/lib/db";
import { GenerateClient } from "./generate-client";

export default async function GeneratePage() {
  const user = await getUser();
  const supabase = await createClient();
  const [pantry, profile] = await Promise.all([
    listPantry(supabase),
    getTasteProfile(supabase, user!.id),
  ]);

  return (
    <GenerateClient
      pantryCount={pantry.length}
      hasProfile={profile.summary.trim().length > 0}
      allowed={canGenerate(user!.email)}
    />
  );
}
