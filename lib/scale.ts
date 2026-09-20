/**
 * Deterministic portion scaling.
 *
 * Like `units.ts`, this never calls the AI. Asking a language model to "triple
 * this recipe" is slow, costs quota on every interaction, and is not repeatable
 * — ask twice and 3x of 1½ tsp comes back as "about 4 tsp" one time and
 * "1 tbsp + 1½ tsp" the next. Arithmetic is instant and always agrees with
 * itself.
 */

import type { Ingredient, Recipe, ScalingBehavior } from "./schema";
import { normalizeUnit } from "./units";

/**
 * Ingredients whose amount should not be trusted to a straight multiplication.
 * Used as a fallback when an imported recipe did not come with `scaling` set.
 */
const MANUAL_SCALING_PATTERNS: RegExp[] = [
  /\bsalt\b/i,
  /\bpepper\b/i,
  /\bchilli?\b|\bchili\b|\bcayenne\b/i,
  /\bspice|\bmasala\b|\bcumin\b|\bcoriander powder\b|\bturmeric\b|\bpaprika\b/i,
  /\bbaking (powder|soda)\b/i,
  /\byeast\b/i,
  /\bvanilla\b|\bextract\b|\bessence\b/i,
  /\boil for (deep |shallow )?fry/i,
  /\bfor frying\b/i,
  /\bgarnish\b/i,
  /\bto taste\b/i,
];

/** Best-guess scaling behaviour for an ingredient the model did not classify. */
export function inferScalingBehavior(item: string): ScalingBehavior {
  return MANUAL_SCALING_PATTERNS.some((re) => re.test(item)) ? "manual" : "linear";
}

export type ScaledIngredient = Ingredient & {
  /** Quantity after scaling, already normalised to a readable unit. */
  scaledQty: number | null;
  /** Unit after normalisation — may differ from the original (48 tsp -> 1 cup). */
  scaledUnit: Ingredient["unit"];
  /**
   * True when the arithmetic was applied but the cook should check by taste.
   * The UI surfaces this; it is never silently swallowed.
   */
  needsTasteCheck: boolean;
};

export type ScaledRecipe = Omit<Recipe, "ingredients"> & {
  ingredients: ScaledIngredient[];
  servings: number;
  factor: number;
};

/** Scale a single ingredient by `factor`. */
export function scaleIngredient(ing: Ingredient, factor: number): ScaledIngredient {
  const behavior = ing.scaling ?? inferScalingBehavior(ing.item);
  // The warning is only meaningful when the amount actually changed.
  const flag = behavior === "manual" && factor !== 1;

  // "Salt to taste" has no number to scale; it stays as written.
  if (ing.qty === null) {
    return {
      ...ing,
      scaledQty: null,
      scaledUnit: ing.unit,
      needsTasteCheck: flag,
    };
  }

  const raw = ing.qty * factor;

  // Countable items ("2 eggs") have no unit to normalise into, and half an egg
  // is not useful — round to a sensible whole where the result is close to one.
  if (!ing.unit) {
    return {
      ...ing,
      scaledQty: roundCount(raw),
      scaledUnit: null,
      needsTasteCheck: flag,
    };
  }

  const { qty, unit } = normalizeUnit(raw, ing.unit);
  return {
    ...ing,
    scaledQty: qty,
    scaledUnit: unit,
    needsTasteCheck: flag,
  };
}

/**
 * Counts land on halves at most: 1.5 onions is a real instruction, 1.37 is not.
 */
function roundCount(n: number): number {
  if (n < 1) return Math.round(n * 4) / 4;
  return Math.round(n * 2) / 2;
}

/** Scale a whole recipe to a target number of servings. */
export function scaleRecipe(recipe: Recipe, targetServings: number): ScaledRecipe {
  const base = recipe.baseServings > 0 ? recipe.baseServings : 1;
  const factor = targetServings / base;

  return {
    ...recipe,
    ingredients: recipe.ingredients.map((ing) => scaleIngredient(ing, factor)),
    servings: targetServings,
    factor,
  };
}

/** Preset portion choices offered in the UI. */
export const SERVING_PRESETS = [
  { label: "1 meal", servings: 1 },
  { label: "2 meals", servings: 2 },
  { label: "3 meals", servings: 3 },
  { label: "Meal prep (5)", servings: 5 },
  { label: "Batch (8)", servings: 8 },
] as const;
