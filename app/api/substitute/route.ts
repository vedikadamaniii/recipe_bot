import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { OWNER_ID } from "@/lib/owner";
import { getTasteProfile, listPantry } from "@/lib/db";
import { buildSubstitutionPrompt, buildSystemInstruction } from "@/lib/prompt";
import { GeminiUnavailableError, SUBSTITUTION_SCHEMA, generateJson } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  const { ingredient, recipeTitle } = await request.json();
  if (!ingredient) {
    return NextResponse.json({ error: "No ingredient given." }, { status: 400 });
  }

  const supabase = await createClient();
  const [profile, pantry] = await Promise.all([
    getTasteProfile(supabase, OWNER_ID),
    listPantry(supabase),
  ]);

  try {
    const parsed = (await generateJson({
      prompt: buildSubstitutionPrompt(ingredient, recipeTitle ?? "this recipe", pantry, profile),
      systemInstruction: buildSystemInstruction(profile),
      schema: SUBSTITUTION_SCHEMA,
    })) as { substitutions?: unknown[] };

    return NextResponse.json({ substitutions: parsed.substitutions ?? [] });
  } catch (err) {
    if (err instanceof GeminiUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Could not find substitutions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
