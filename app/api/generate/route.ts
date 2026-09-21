import { NextResponse, type NextRequest } from "next/server";
import { buildSystemInstruction, buildUserPrompt, type GenerationRequest } from "@/lib/prompt";
import { TASTE } from "@/lib/taste";
import {
  GENERATION_SCHEMA,
  GeminiUnavailableError,
  coerceRecipe,
  generateJson,
} from "@/lib/gemini";

export async function POST(request: NextRequest) {
  let body: GenerationRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const parsed = (await generateJson({
      prompt: buildUserPrompt(body),
      systemInstruction: buildSystemInstruction(TASTE),
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
