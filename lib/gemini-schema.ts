/**
 * The structured-output contract and response coercion.
 *
 * Kept separate from `gemini.ts` (which is server-only) because this half is
 * pure data handling and is worth testing directly — the repair logic below is
 * what stands between a slightly-off model response and a corrupted library.
 */

import { Type } from "@google/genai";
import type { DraftRecipe } from "./schema";
import { inferScalingBehavior } from "./scale";
import { isUnit } from "./units";

const INGREDIENT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    qty: {
      type: Type.NUMBER,
      nullable: true,
      description: "Numeric amount. Null only for genuine 'to taste' items.",
    },
    unit: {
      type: Type.STRING,
      nullable: true,
      description:
        "One of: tsp, tbsp, cup, floz, ml, l, g, kg, oz, lb. Null for counted items.",
    },
    item: { type: Type.STRING, description: "The ingredient itself, no amount." },
    prep: { type: Type.STRING, nullable: true, description: "e.g. 'finely chopped'" },
    group: {
      type: Type.STRING,
      nullable: true,
      description: "Sub-recipe grouping, e.g. 'For the marinade'.",
    },
    scaling: {
      type: Type.STRING,
      enum: ["linear", "manual"],
      description:
        "'manual' for salt, spices, chilli, leaveners, extracts and frying oil.",
    },
  },
  required: ["qty", "unit", "item", "scaling"],
};

const RECIPE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING, nullable: true },
    cuisine: { type: Type.STRING },
    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
    baseServings: {
      type: Type.INTEGER,
      description: "Servings the quantities are written for. Must be accurate.",
    },
    totalTimeMin: { type: Type.INTEGER, nullable: true },
    ingredients: { type: Type.ARRAY, items: INGREDIENT_SCHEMA },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          n: { type: Type.INTEGER },
          text: { type: Type.STRING },
          minutes: { type: Type.INTEGER, nullable: true },
        },
        required: ["n", "text"],
      },
    },
    missingFromPantry: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Ingredients the cook would need to buy.",
    },
  },
  required: ["title", "cuisine", "tags", "baseServings", "ingredients", "steps"],
};

export const GENERATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    recipes: { type: Type.ARRAY, items: RECIPE_SCHEMA },
  },
  required: ["recipes"],
};

export const SINGLE_RECIPE_SCHEMA = RECIPE_SCHEMA;

export const SUBSTITUTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    substitutions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "What to use instead." },
          amount: {
            type: Type.STRING,
            description: "How much, relative to the original. e.g. 'the same', '¾ as much'.",
          },
          effect: { type: Type.STRING, description: "What it changes about the dish." },
          caveat: {
            type: Type.STRING,
            nullable: true,
            description: "State plainly when the substitution will not work well.",
          },
        },
        required: ["name", "amount", "effect"],
      },
    },
  },
  required: ["substitutions"],
};

/** A generated recipe plus the shopping gap, before it is saved. */
export type GeneratedRecipe = DraftRecipe & { missingFromPantry: string[] };

type RawRecipe = Record<string, unknown>;

/**
 * Coerce a model response into our schema.
 *
 * Structured output gets us most of the way, but models still occasionally
 * invent a unit ("bunch") or omit a scaling flag. We repair rather than reject:
 * an unrecognised unit is dropped into the item text so no information is lost,
 * which is better than throwing away an otherwise good recipe.
 */
export function coerceRecipe(raw: RawRecipe, sourceType: DraftRecipe["sourceType"]): GeneratedRecipe {
  const ingredients = Array.isArray(raw.ingredients) ? raw.ingredients : [];

  return {
    title: String(raw.title ?? "Untitled recipe"),
    description: raw.description ? String(raw.description) : null,
    cuisine: String(raw.cuisine ?? "Other"),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String).slice(0, 12) : [],
    baseServings: toPositiveInt(raw.baseServings) ?? 2,
    totalTimeMin: toPositiveInt(raw.totalTimeMin),
    ingredients: ingredients.map((value) => {
      const ing = (value ?? {}) as RawRecipe;
      const rawUnit = ing.unit == null ? null : String(ing.unit).toLowerCase().trim();
      const unitOk = isUnit(rawUnit);
      const item = String(ing.item ?? "").trim();

      return {
        qty: typeof ing.qty === "number" && Number.isFinite(ing.qty) ? ing.qty : null,
        unit: unitOk ? rawUnit : null,
        // Keep an unrecognised unit as part of the item rather than losing it.
        item: unitOk || !rawUnit ? item : `${rawUnit} ${item}`.trim(),
        prep: ing.prep ? String(ing.prep) : null,
        group: ing.group ? String(ing.group) : null,
        scaling:
          ing.scaling === "manual" || ing.scaling === "linear"
            ? ing.scaling
            : inferScalingBehavior(item),
      };
    }),
    steps: Array.isArray(raw.steps)
      ? raw.steps.map((value, i) => {
          const step = (value ?? {}) as RawRecipe;
          return {
            n: toPositiveInt(step.n) ?? i + 1,
            text: String(step.text ?? "").trim(),
            minutes: toPositiveInt(step.minutes),
          };
        })
      : [],
    sourceType,
    sourceUrl: null,
    imageUrl: null,
    rating: null,
    notes: null,
    missingFromPantry: Array.isArray(raw.missingFromPantry)
      ? raw.missingFromPantry.map(String)
      : [],
  };
}

function toPositiveInt(value: unknown): number | null {
  const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Parse a structured-output response body, tolerating markdown fencing. */
export function parseJsonResponse(text: string | undefined): unknown {
  if (!text) throw new Error("The model returned an empty response.");
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("The model did not return valid JSON.");
  }
}
