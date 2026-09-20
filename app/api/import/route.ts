import { NextResponse, type NextRequest } from "next/server";
import { recipeFromHtml, stripHtml } from "@/lib/jsonld";
import {
  GeminiUnavailableError,
  SINGLE_RECIPE_SCHEMA,
  coerceRecipe,
  generateJson,
} from "@/lib/gemini";
import type { DraftRecipe } from "@/lib/schema";
import { assertPublicUrl } from "@/lib/url-guard";

const IMPORT_INSTRUCTION = `You transcribe recipes into structured data.
Read what you are given and record exactly what it says. Do not improve the
recipe, do not add steps, and do not invent quantities that are not there —
if an amount is genuinely absent, use null rather than guessing.
Use only these units: tsp, tbsp, cup, floz, ml, l, g, kg, oz, lb. Counted items
(eggs, onions) take no unit. Mark salt, spices, chilli, leaveners, extracts and
frying oil as "manual" scaling; everything else is "linear".
baseServings must be the number of servings the quantities are actually written
for.`;

/** Roughly 6MB of base64, which is about a 4.5MB image. */
const MAX_IMAGE_CHARS = 6_000_000;

async function fromUrl(rawUrl: string): Promise<DraftRecipe> {
  const url = assertPublicUrl(rawUrl);

  const res = await fetch(url, {
    headers: {
      // Many recipe sites serve a stripped page to unknown agents.
      "User-Agent": "Mozilla/5.0 (compatible; RecipeBot/1.0)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) throw new Error(`Could not read that page (HTTP ${res.status}).`);

  const html = await res.text();

  // Structured data first: it is exact, instant, and costs no quota.
  const structured = recipeFromHtml(html, url.toString());
  if (structured) return structured;

  // Fall back to the model on the cleaned page text.
  const text = stripHtml(html).slice(0, 24_000);
  if (text.length < 200) throw new Error("There was no readable recipe on that page.");

  const parsed = (await generateJson({
    prompt: `Transcribe the recipe on this page into structured data.\n\n${text}`,
    systemInstruction: IMPORT_INSTRUCTION,
    schema: SINGLE_RECIPE_SCHEMA,
  })) as Record<string, unknown>;

  return { ...coerceRecipe(parsed, "link"), sourceUrl: url.toString() };
}

async function fromText(text: string): Promise<DraftRecipe> {
  if (text.trim().length < 20) throw new Error("That is too short to be a recipe.");
  const parsed = (await generateJson({
    prompt: `Transcribe this recipe into structured data.\n\n${text.slice(0, 24_000)}`,
    systemInstruction: IMPORT_INSTRUCTION,
    schema: SINGLE_RECIPE_SCHEMA,
  })) as Record<string, unknown>;
  return coerceRecipe(parsed, "manual");
}

async function fromImage(dataUrl: string): Promise<DraftRecipe> {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) throw new Error("That image could not be read.");
  const [, mimeType, base64] = match;

  if (base64.length > MAX_IMAGE_CHARS) {
    throw new Error("That image is too large. Try one under about 4MB.");
  }

  const parsed = (await generateJson({
    prompt: [
      { text: "Transcribe the recipe in this image into structured data." },
      { inlineData: { mimeType, data: base64 } },
    ],
    systemInstruction: IMPORT_INSTRUCTION,
    schema: SINGLE_RECIPE_SCHEMA,
  })) as Record<string, unknown>;

  return coerceRecipe(parsed, "image");
}

export async function POST(request: NextRequest) {
  let body: { type?: string; url?: string; text?: string; image?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    let recipe: DraftRecipe;
    if (body.type === "url" && body.url) recipe = await fromUrl(body.url);
    else if (body.type === "text" && body.text) recipe = await fromText(body.text);
    else if (body.type === "image" && body.image) recipe = await fromImage(body.image);
    else return NextResponse.json({ error: "Nothing to import." }, { status: 400 });

    return NextResponse.json({ recipe });
  } catch (err) {
    if (err instanceof GeminiUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Import failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
