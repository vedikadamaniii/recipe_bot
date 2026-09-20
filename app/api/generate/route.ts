import { NextResponse, type NextRequest } from "next/server";
import { createClient, getUser, canGenerate } from "@/lib/supabase/server";
import { getTasteProfile, listPantry } from "@/lib/db";
import { buildSystemInstruction, buildUserPrompt, type GenerationRequest } from "@/lib/prompt";
import {
  GENERATION_SCHEMA,
  GeminiUnavailableError,
  coerceRecipe,
  generateJson,
} from "@/lib/gemini";

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to generate recipes." }, { status: 401 });
  }

  // The deployed URL is public, so generation is gated to an allowlist. Anyone
  // else can sign in and browse, but cannot spend the API quota.
  if (!canGenerate(user.email)) {
    return NextResponse.json(
      {
        error:
          "This is a personal instance, so recipe generation is limited to its owner. " +
          "You can still browse saved recipes.",
      },
      { status: 403 },
    );
  }

  let body: GenerationRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = await createClient();
  const [profile, pantry] = await Promise.all([
    getTasteProfile(supabase, user.id),
    listPantry(supabase),
  ]);

  try {
    const parsed = (await generateJson({
      prompt: buildUserPrompt(body, pantry),
      systemInstruction: buildSystemInstruction(profile),
      schema: GENERATION_SCHEMA,
    })) as { recipes?: Record<string, unknown>[] };

    const recipes = (parsed.recipes ?? []).map((r) => coerceRecipe(r, "generated"));
    if (recipes.length === 0) {
      return NextResponse.json(
        { error: "No recipes came back. Try rephrasing what you are after." },
        { status: 502 },
      );
    }

    return NextResponse.json({ recipes });
  } catch (err) {
    if (err instanceof GeminiUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
