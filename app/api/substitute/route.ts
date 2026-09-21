import { NextResponse, type NextRequest } from "next/server";
import { buildSubstitutionPrompt, buildSystemInstruction } from "@/lib/prompt";
import { TASTE } from "@/lib/taste";
import { GeminiUnavailableError, SUBSTITUTION_SCHEMA, generateJson } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  const { ingredient, recipeTitle, have } = await request.json();
  if (!ingredient) {
    return NextResponse.json({ error: "No ingredient given." }, { status: 400 });
  }

  // `have` is whatever was last typed on the Cook page, passed through from the
  // browser. There is no pantry to read any more.
  const onHand: string[] = Array.isArray(have) ? have.map(String) : [];

  try {
    const parsed = (await generateJson({
      prompt: buildSubstitutionPrompt(ingredient, recipeTitle ?? "this recipe", onHand, TASTE),
      systemInstruction: buildSystemInstruction(TASTE),
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
