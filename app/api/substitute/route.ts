import { NextResponse, type NextRequest } from "next/server";
import { createClient, getUser, canGenerate } from "@/lib/supabase/server";
import { getTasteProfile, listPantry } from "@/lib/db";
import { buildSubstitutionPrompt, buildSystemInstruction } from "@/lib/prompt";
import { GeminiUnavailableError, SUBSTITUTION_SCHEMA, generateJson } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  if (!canGenerate(user.email)) {
    return NextResponse.json(
      { error: "Substitutions are limited to this instance's owner." },
      { status: 403 },
    );
  }

  const { ingredient, recipeTitle } = await request.json();
  if (!ingredient) {
    return NextResponse.json({ error: "No ingredient given." }, { status: 400 });
  }

  const supabase = await createClient();
  const [profile, pantry] = await Promise.all([
    getTasteProfile(supabase, user.id),
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
