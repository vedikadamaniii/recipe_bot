/**
 * The shared recipe contract.
 *
 * Every recipe — generated, screenshotted, pasted or scraped — is normalised
 * into these types exactly once, at the point it enters the system. Everything
 * downstream (scaling, unit conversion, cuisine browsing, substitutions) reads
 * this shape and nothing else.
 */

import type { Unit } from "./units";

/**
 * How an ingredient behaves when the recipe is scaled up or down.
 *
 * `linear`  — triple the recipe, triple the amount. True for most things.
 * `manual`  — scales arithmetically, but the cook should taste and adjust.
 *             Salt, spices, leaveners and frying oil do not behave linearly in
 *             real cooking; we still do the maths, but we say so in the UI
 *             rather than silently tripling the chilli.
 */
export type ScalingBehavior = "linear" | "manual";

export type Ingredient = {
  /** null for "salt to taste" / "a handful of coriander". */
  qty: number | null;
  /** null for countable items: "2 eggs", "1 onion". */
  unit: Unit | null;
  item: string;
  /** "finely chopped", "at room temperature" */
  prep?: string | null;
  /** Sub-recipe grouping, e.g. "For the marinade". */
  group?: string | null;
  scaling: ScalingBehavior;
  /** Free-text amount when it genuinely resists structuring ("a pinch"). */
  rawAmount?: string | null;
};

export type Step = {
  n: number;
  text: string;
  /** Optional timer hint in minutes, for cook mode. */
  minutes?: number | null;
};

export type SourceType = "generated" | "image" | "link" | "manual";

export type Recipe = {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  cuisine: string;
  tags: string[];
  ingredients: Ingredient[];
  steps: Step[];
  /** Servings the quantities above are written for. Scaling is relative to this. */
  baseServings: number;
  totalTimeMin?: number | null;
  sourceType: SourceType;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  rating?: number | null;
  notes?: string | null;
  createdAt: string;
};

/** A recipe as the model returns it, before it has an id or an owner. */
export type DraftRecipe = Omit<Recipe, "id" | "userId" | "createdAt">;

export type PantryItem = {
  id: string;
  userId: string;
  name: string;
  qty?: number | null;
  unit?: Unit | null;
  category?: string | null;
};

export type TasteProfile = {
  userId: string;
  /** The long-form context carried over from your ChatGPT thread. */
  summary: string;
  /** Hard constraints. These are enforced separately and never softened. */
  allergies: string[];
  dislikes: string[];
  spiceLevel?: "mild" | "medium" | "hot" | null;
  equipment: string[];
  /** Ingredients to reach for first. */
  favourites?: string[];
  /** Usually in the cupboard, so recipes may assume them. */
  staples?: string[];
};

/** Cuisines offered as browse filters. Free text is still allowed. */
export const COMMON_CUISINES = [
  "Indian",
  "Italian",
  "Mexican",
  "Thai",
  "Japanese",
  "Chinese",
  "Mediterranean",
  "Middle Eastern",
  "Korean",
  "Vietnamese",
  "French",
  "American",
  "British",
  "Greek",
  "Spanish",
  "Other",
] as const;
