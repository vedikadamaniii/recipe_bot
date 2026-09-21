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

/**
 * Caps on the image payload.
 *
 * Serverless request bodies are commonly limited to around 4.5MB, and base64
 * inflates a file by roughly a third, so the browser downscales before upload
 * and this is the backstop rather than the first line of defence.
 */
const MAX_IMAGES = 8;
const MAX_TOTAL_CHARS = 5_500_000;

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

  if (!res.ok) {
    // A lot of recipe sites sit behind bot protection that serves a JavaScript
    // challenge to anything that is not a real browser. That is a deliberate
    // choice by the site, not something to work around, so say so plainly and
    // point at the routes that do work.
    if (res.status === 403 || res.status === 401 || res.status === 429) {
      throw new Error(
        "That site blocks automated readers, so the page cannot be fetched here. " +
          "Open it in your browser and use Paste, or screenshot it and use Photo. " +
          "Both read the same recipe.",
      );
    }
    if (res.status === 404) {
      throw new Error("That page does not exist. Check the link.");
    }
    throw new Error(`That page could not be read (HTTP ${res.status}).`);
  }

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

async function fromImages(dataUrls: string[]): Promise<DraftRecipe> {
  if (dataUrls.length === 0) throw new Error("No images given.");
  if (dataUrls.length > MAX_IMAGES) {
    throw new Error(`That is more than ${MAX_IMAGES} images. Try splitting it up.`);
  }

  const total = dataUrls.reduce((n, d) => n + d.length, 0);
  if (total > MAX_TOTAL_CHARS) {
    throw new Error("Those images are too large together. Try fewer, or smaller ones.");
  }

  const parts: unknown[] = [
    {
      text:
        dataUrls.length === 1
          ? "Transcribe the recipe in this image into structured data."
          : `These ${dataUrls.length} images are parts of ONE single recipe, in order — ` +
            "typically the ingredients on some and the method on others, and they may " +
            "overlap. Combine them into one recipe. Do not produce several recipes, and " +
            "do not repeat an ingredient that appears in more than one image.",
    },
  ];

  for (const dataUrl of dataUrls) {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
    if (!match) throw new Error("One of those images could not be read.");
    parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
  }

  const parsed = (await generateJson({
    prompt: parts,
    systemInstruction: IMPORT_INSTRUCTION,
    schema: SINGLE_RECIPE_SCHEMA,
  })) as Record<string, unknown>;

  return coerceRecipe(parsed, "image");
}

export async function POST(request: NextRequest) {
  let body: { type?: string; url?: string; text?: string; images?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    let recipe: DraftRecipe;
    if (body.type === "url" && body.url) recipe = await fromUrl(body.url);
    else if (body.type === "text" && body.text) recipe = await fromText(body.text);
    else if (body.type === "image" && body.images?.length)
      recipe = await fromImages(body.images);
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
