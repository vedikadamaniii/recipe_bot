/**
 * Extracting recipes from a URL via schema.org structured data.
 *
 * Most recipe sites embed a machine-readable `schema.org/Recipe` block for
 * Google. Reading it is free, instant and exact, so we always try this before
 * spending AI quota on guessing at page text. The model is the fallback.
 */

import type { DraftRecipe, Step } from "./schema";
import { parseIngredientLines, parseIsoDuration, parseYield } from "./parse";

type Json = Record<string, unknown>;

/** Pull every JSON-LD payload out of an HTML document. */
export function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = re.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // Some sites emit invalid JSON-LD. Skip it rather than failing the import.
    }
  }
  return blocks;
}

function typesOf(node: Json): string[] {
  const t = node["@type"];
  if (typeof t === "string") return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === "string");
  return [];
}

/** Walk a JSON-LD payload (including `@graph` and arrays) for a Recipe node. */
export function findRecipeNode(payload: unknown): Json | null {
  const seen = new Set<unknown>();
  const queue: unknown[] = [payload];

  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);

    if (Array.isArray(node)) {
      queue.push(...node);
      continue;
    }

    const obj = node as Json;
    if (typesOf(obj).includes("Recipe")) return obj;

    if (Array.isArray(obj["@graph"])) queue.push(...(obj["@graph"] as unknown[]));
    for (const value of Object.values(obj)) {
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.flatMap((v) => {
      if (typeof v === "string") return [v];
      if (v && typeof v === "object" && typeof (v as Json).name === "string") {
        return [(v as Json).name as string];
      }
      return [];
    });
  }
  return [];
}

/** schema.org instructions come as a string, a list, or nested HowToSections. */
function extractSteps(value: unknown): Step[] {
  const texts: string[] = [];

  const walk = (node: unknown) => {
    if (!node) return;
    if (typeof node === "string") {
      texts.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === "object") {
      const obj = node as Json;
      if (typesOf(obj).includes("HowToSection")) {
        walk(obj.itemListElement);
        return;
      }
      if (typeof obj.text === "string") texts.push(obj.text);
      else if (typeof obj.name === "string") texts.push(obj.name);
    }
  };

  walk(value);

  // A single blob of instructions is common. Split it BEFORE stripping HTML,
  // because stripping collapses the newlines and block tags that mark the
  // step boundaries.
  const parts = texts.length === 1 ? splitInstructionBlob(texts[0]) : texts;

  return parts
    .map((t) => stripHtml(t).trim())
    .filter((t) => t.length > 0)
    .map((text, i) => ({ n: i + 1, text }));
}

function splitInstructionBlob(text: string): string[] {
  const withBreaks = text.replace(/<\/(?:p|li|div)>|<br\s*\/?>/gi, "\n");
  const parts = withBreaks
    .split(/\r?\n+|(?<=\.)\s{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return parts.length > 1 ? parts : [text];
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function firstImageUrl(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return firstImageUrl(value[0]);
  if (typeof value === "object") {
    const url = (value as Json).url;
    return typeof url === "string" ? url : null;
  }
  return null;
}

/**
 * Turn a Recipe JSON-LD node into our draft shape.
 * Returns null when the node lacks the two things that make a recipe a recipe:
 * a title and some ingredients.
 */
export function recipeFromJsonLd(node: Json, sourceUrl?: string): DraftRecipe | null {
  const title = typeof node.name === "string" ? stripHtml(node.name) : "";
  const ingredientLines = asStringArray(node.recipeIngredient ?? node.ingredients).map(stripHtml);

  if (!title || ingredientLines.length === 0) return null;

  const cuisineValues = asStringArray(node.recipeCuisine);
  const categoryValues = asStringArray(node.recipeCategory);
  const keywords = asStringArray(node.keywords).flatMap((k) =>
    k.split(",").map((s) => s.trim()).filter(Boolean),
  );

  return {
    title,
    description:
      typeof node.description === "string" ? stripHtml(node.description) : null,
    cuisine: cuisineValues[0] ? titleCase(cuisineValues[0]) : "Other",
    tags: [...new Set([...categoryValues, ...keywords])].slice(0, 12),
    ingredients: parseIngredientLines(ingredientLines),
    steps: extractSteps(node.recipeInstructions),
    baseServings: parseYield(node.recipeYield) ?? 4,
    totalTimeMin:
      parseIsoDuration(node.totalTime as string) ??
      parseIsoDuration(node.cookTime as string),
    sourceType: "link",
    sourceUrl: sourceUrl ?? null,
    imageUrl: firstImageUrl(node.image),
    rating: null,
    notes: null,
  };
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Best-effort recipe extraction from raw HTML.
 * Returns null when the page has no usable structured data — the caller then
 * falls back to sending cleaned page text to the model.
 */
export function recipeFromHtml(html: string, sourceUrl?: string): DraftRecipe | null {
  for (const block of extractJsonLdBlocks(html)) {
    const node = findRecipeNode(block);
    if (node) {
      const recipe = recipeFromJsonLd(node, sourceUrl);
      if (recipe) return recipe;
    }
  }
  return null;
}
