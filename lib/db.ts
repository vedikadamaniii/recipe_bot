/**
 * Data access.
 *
 * The database speaks snake_case and the application speaks the `Recipe`
 * contract from lib/schema.ts. Every translation between the two lives here, so
 * that column names never leak into components.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DraftRecipe,
  Ingredient,
  PantryItem,
  Recipe,
  Step,
  TasteProfile,
} from "./schema";
import { inferScalingBehavior } from "./scale";
import { isUnit } from "./units";

type Row = Record<string, unknown>;

/** Database row -> Recipe. Defensive, because jsonb columns are untyped. */
export function rowToRecipe(row: Row): Recipe {
  const ingredients = Array.isArray(row.ingredients) ? row.ingredients : [];
  const steps = Array.isArray(row.steps) ? row.steps : [];

  return {
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title ?? ""),
    description: (row.description as string) ?? null,
    cuisine: String(row.cuisine ?? "Other"),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    ingredients: ingredients.map((value): Ingredient => {
      const i = (value ?? {}) as Row;
      const unit = typeof i.unit === "string" ? i.unit : null;
      const item = String(i.item ?? "");
      return {
        qty: typeof i.qty === "number" ? i.qty : null,
        unit: isUnit(unit) ? unit : null,
        item,
        prep: (i.prep as string) ?? null,
        group: (i.group as string) ?? null,
        scaling:
          i.scaling === "manual" || i.scaling === "linear"
            ? i.scaling
            : inferScalingBehavior(item),
        rawAmount: (i.rawAmount as string) ?? null,
      };
    }),
    steps: steps.map((value, index): Step => {
      const s = (value ?? {}) as Row;
      return {
        n: typeof s.n === "number" ? s.n : index + 1,
        text: String(s.text ?? ""),
        minutes: typeof s.minutes === "number" ? s.minutes : null,
      };
    }),
    baseServings: typeof row.base_servings === "number" ? row.base_servings : 2,
    totalTimeMin: (row.total_time_min as number) ?? null,
    sourceType: (row.source_type as Recipe["sourceType"]) ?? "manual",
    sourceUrl: (row.source_url as string) ?? null,
    imageUrl: (row.image_url as string) ?? null,
    rating: (row.rating as number) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: String(row.created_at ?? ""),
  };
}

function recipeToRow(recipe: DraftRecipe, userId: string): Row {
  return {
    user_id: userId,
    title: recipe.title,
    description: recipe.description ?? null,
    cuisine: recipe.cuisine,
    tags: recipe.tags,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    base_servings: recipe.baseServings,
    total_time_min: recipe.totalTimeMin ?? null,
    source_type: recipe.sourceType,
    source_url: recipe.sourceUrl ?? null,
    image_url: recipe.imageUrl ?? null,
    rating: recipe.rating ?? null,
    notes: recipe.notes ?? null,
  };
}

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

export type RecipeFilters = {
  cuisine?: string | null;
  tag?: string | null;
  search?: string | null;
};

export async function listRecipes(
  sb: SupabaseClient,
  filters: RecipeFilters = {},
): Promise<Recipe[]> {
  let query = sb.from("recipes").select("*").order("created_at", { ascending: false });

  if (filters.cuisine) query = query.eq("cuisine", filters.cuisine);
  if (filters.tag) query = query.contains("tags", [filters.tag]);
  if (filters.search) {
    const term = filters.search.replace(/[%_,()]/g, " ").trim();
    if (term) query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not load recipes: ${error.message}`);
  return (data ?? []).map(rowToRecipe);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getRecipe(sb: SupabaseClient, id: string): Promise<Recipe | null> {
  // Postgres raises "invalid input syntax for type uuid" on a malformed id,
  // which would surface as a 500. A bad id is a missing recipe, not an error.
  if (!UUID_RE.test(id)) return null;

  const { data, error } = await sb.from("recipes").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load recipe: ${error.message}`);
  return data ? rowToRecipe(data) : null;
}

export async function saveRecipe(
  sb: SupabaseClient,
  recipe: DraftRecipe,
  userId: string,
): Promise<Recipe> {
  const { data, error } = await sb
    .from("recipes")
    .insert(recipeToRow(recipe, userId))
    .select()
    .single();
  if (error) throw new Error(`Could not save recipe: ${error.message}`);
  return rowToRecipe(data);
}

export async function updateRecipe(
  sb: SupabaseClient,
  id: string,
  patch: Partial<DraftRecipe>,
): Promise<Recipe> {
  const row: Row = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.cuisine !== undefined) row.cuisine = patch.cuisine;
  if (patch.tags !== undefined) row.tags = patch.tags;
  if (patch.ingredients !== undefined) row.ingredients = patch.ingredients;
  if (patch.steps !== undefined) row.steps = patch.steps;
  if (patch.baseServings !== undefined) row.base_servings = patch.baseServings;
  if (patch.totalTimeMin !== undefined) row.total_time_min = patch.totalTimeMin;
  if (patch.rating !== undefined) row.rating = patch.rating;
  if (patch.notes !== undefined) row.notes = patch.notes;

  const { data, error } = await sb.from("recipes").update(row).eq("id", id).select().single();
  if (error) throw new Error(`Could not update recipe: ${error.message}`);
  return rowToRecipe(data);
}

export async function deleteRecipe(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("recipes").delete().eq("id", id);
  if (error) throw new Error(`Could not delete recipe: ${error.message}`);
}

/** Distinct cuisines present in the library, for the browse filter. */
export async function listCuisines(sb: SupabaseClient): Promise<string[]> {
  const { data, error } = await sb.from("recipes").select("cuisine");
  if (error) throw new Error(`Could not load cuisines: ${error.message}`);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const c = String((row as Row).cuisine ?? "Other");
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.keys()].sort();
}

// ---------------------------------------------------------------------------
// Pantry
// ---------------------------------------------------------------------------

function rowToPantryItem(row: Row): PantryItem {
  const unit = typeof row.unit === "string" ? row.unit : null;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name ?? ""),
    qty: (row.qty as number) ?? null,
    unit: isUnit(unit) ? unit : null,
    category: (row.category as string) ?? null,
  };
}

export async function listPantry(sb: SupabaseClient): Promise<PantryItem[]> {
  const { data, error } = await sb
    .from("pantry_items")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(`Could not load pantry: ${error.message}`);
  return (data ?? []).map(rowToPantryItem);
}

export async function addPantryItem(
  sb: SupabaseClient,
  userId: string,
  item: { name: string; qty?: number | null; unit?: string | null; category?: string | null },
): Promise<PantryItem> {
  // The table has a unique (user_id, name) constraint, so adding something you
  // already have updates it rather than erroring.
  const { data, error } = await sb
    .from("pantry_items")
    .upsert(
      {
        user_id: userId,
        name: item.name.trim(),
        qty: item.qty ?? null,
        unit: item.unit ?? null,
        category: item.category ?? null,
      },
      { onConflict: "user_id,name" },
    )
    .select()
    .single();
  if (error) throw new Error(`Could not add "${item.name}": ${error.message}`);
  return rowToPantryItem(data);
}

export async function removePantryItem(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("pantry_items").delete().eq("id", id);
  if (error) throw new Error(`Could not remove item: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Taste profile
// ---------------------------------------------------------------------------

export async function getTasteProfile(
  sb: SupabaseClient,
  userId: string,
): Promise<TasteProfile> {
  const { data, error } = await sb
    .from("taste_profile")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Could not load taste profile: ${error.message}`);

  // A signup trigger seeds this row, but fall back to an empty profile rather
  // than crashing if it is somehow missing.
  return {
    userId,
    summary: String(data?.summary ?? ""),
    allergies: (data?.allergies as string[]) ?? [],
    dislikes: (data?.dislikes as string[]) ?? [],
    spiceLevel: (data?.spice_level as TasteProfile["spiceLevel"]) ?? null,
    equipment: (data?.equipment as string[]) ?? [],
  };
}

export async function saveTasteProfile(
  sb: SupabaseClient,
  profile: TasteProfile,
): Promise<void> {
  const { error } = await sb.from("taste_profile").upsert(
    {
      user_id: profile.userId,
      summary: profile.summary,
      allergies: profile.allergies,
      dislikes: profile.dislikes,
      spice_level: profile.spiceLevel,
      equipment: profile.equipment,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`Could not save taste profile: ${error.message}`);
}
