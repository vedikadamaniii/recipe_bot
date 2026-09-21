import { NextResponse, type NextRequest } from "next/server";
import { buildSystemInstruction, buildUserPrompt, type GenerationRequest } from "@/lib/prompt";
import { TASTE } from "@/lib/taste";
import { VISITOR_DAILY_CAP, isUnlocked } from "@/lib/access";
import { claimGeneration } from "@/lib/usage";
import {
  GENERATION_SCHEMA,
  GeminiUnavailableError,
  coerceRecipe,
  generateJson,
} from "@/lib/gemini";
import EXAMPLE from "@/lib/example-result.json";

/**
 * Generate recipes.
 *
 * The owner generates freely. Visitors share a daily budget of live
 * generations so the site demonstrates itself honestly, and once that is spent
 * they get a real saved result clearly labelled as one. Degrading to a saved
 * example beats showing an error to someone evaluating the work.
 */
export async function POST(request: NextRequest) {
  let body: GenerationRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const unlocked = await isUnlocked();

  if (!unlocked) {
    let used: number;
    try {
      used = await claimGeneration();
    } catch {
      // If the counter is unavailable, fail closed to the example rather than
      // leaving the quota unguarded.
      return NextResponse.json({ ...EXAMPLE, saved: true });
    }

    if (used > VISITOR_DAILY_CAP) {
      return NextResponse.json({ ...EXAMPLE, saved: true });
    }
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

    return NextResponse.json({ recipes, saved: false });
  } catch (err) {
    // A visitor should never see a stack of API trouble; hand them the example.
    if (!unlocked) return NextResponse.json({ ...EXAMPLE, saved: true });

    if (err instanceof GeminiUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
