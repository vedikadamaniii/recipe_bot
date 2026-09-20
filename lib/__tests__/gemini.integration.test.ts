/**
 * Integration test against the real Gemini API.
 *
 * Skipped automatically when GEMINI_API_KEY is absent, so the offline suite
 * still runs in CI and on a fresh clone. This is the test that proves the
 * central claim of the architecture: that the model reliably returns data our
 * deterministic scaling and unit code can consume without re-parsing prose.
 *
 *   npm run test:live
 */
import { describe, expect, it } from "vitest";
import { GENERATION_SCHEMA, coerceRecipe } from "../gemini-schema";
import { generateJson } from "../gemini";
import { buildSystemInstruction, buildUserPrompt } from "../prompt";
import { scaleRecipe } from "../scale";
import { ALL_UNITS } from "../units";
import type { PantryItem, Recipe, TasteProfile } from "../schema";

const apiKey = process.env.GEMINI_API_KEY;

const profile: TasteProfile = {
  userId: "test",
  summary:
    "I cook mostly Indian and Mediterranean food on weeknights. I like bold, " +
    "sour and spiced flavours, and I batch cook on Sundays. I do not enjoy " +
    "very sweet savoury dishes.",
  allergies: ["peanuts", "shellfish"],
  dislikes: ["raw tomato"],
  spiceLevel: "medium",
  equipment: ["gas hob", "oven", "blender"],
};

const pantry: PantryItem[] = [
  { id: "1", userId: "test", name: "red lentils" },
  { id: "2", userId: "test", name: "onions" },
  { id: "3", userId: "test", name: "garlic" },
  { id: "4", userId: "test", name: "canned tomatoes" },
  { id: "5", userId: "test", name: "spinach" },
  { id: "6", userId: "test", name: "greek yogurt" },
];

describe.skipIf(!apiKey)("Gemini structured output (live)", () => {
  it("returns recipes that satisfy our schema and scale deterministically", async () => {
    const parsed = (await generateJson({
      prompt: buildUserPrompt(
        { ask: "high protein dinner I can batch cook", intents: ["high-protein", "meal-prep"], pantryOnly: true },
        pantry,
      ),
      systemInstruction: buildSystemInstruction(profile),
      schema: GENERATION_SCHEMA,
    })) as { recipes: Record<string, unknown>[] };
    expect(Array.isArray(parsed.recipes)).toBe(true);
    expect(parsed.recipes.length).toBeGreaterThanOrEqual(1);

    const recipes = parsed.recipes.map((r: Record<string, unknown>) =>
      coerceRecipe(r, "generated"),
    );

    for (const draft of recipes) {
      expect(draft.title.length).toBeGreaterThan(0);
      expect(draft.ingredients.length).toBeGreaterThan(0);
      expect(draft.steps.length).toBeGreaterThan(0);
      expect(draft.baseServings).toBeGreaterThan(0);

      // Every unit must be one we can actually convert; anything else would
      // have been folded into the item text by coerceRecipe.
      for (const ing of draft.ingredients) {
        if (ing.unit !== null) expect(ALL_UNITS).toContain(ing.unit);
        expect(ing.item.length).toBeGreaterThan(0);
        expect(["linear", "manual"]).toContain(ing.scaling);
      }

      // The real payoff: a generated recipe scales with no further AI calls.
      const recipe: Recipe = { ...draft, id: "x", userId: "u", createdAt: "now" };
      const scaled = scaleRecipe(recipe, draft.baseServings * 3);
      expect(scaled.factor).toBe(3);
      expect(scaled.ingredients).toHaveLength(draft.ingredients.length);
      for (const ing of scaled.ingredients) {
        if (ing.qty !== null) expect(Number.isFinite(ing.scaledQty)).toBe(true);
      }
    }

    // At least one spice or salt should be flagged for a taste check when
    // tripled — if nothing is, the scaling hints are not reaching the model.
    const tripled = recipes.flatMap((draft: ReturnType<typeof coerceRecipe>) =>
      scaleRecipe({ ...draft, id: "x", userId: "u", createdAt: "now" }, draft.baseServings * 3)
        .ingredients,
    );
    expect(tripled.some((i: { needsTasteCheck: boolean }) => i.needsTasteCheck)).toBe(true);
  });

  it("respects a stated allergy", async () => {
    const parsed = await generateJson({
      prompt: buildUserPrompt(
        { ask: "a satay-style noodle dish with a rich nutty sauce", servings: 2 },
        [],
      ),
      systemInstruction: buildSystemInstruction(profile),
      schema: GENERATION_SCHEMA,
    });
    const recipes = (parsed as { recipes: Record<string, unknown>[] }).recipes.map((r) =>
      coerceRecipe(r, "generated"),
    );
    const items = recipes
      .flatMap((r) => r.ingredients.map((i) => `${i.item} ${i.prep ?? ""}`))
      .join(" | ")
      .toLowerCase();

    // Asking for satay is asking for peanuts. The model must adapt, never
    // quietly include the allergen.
    //
    // Note the negation stripping: the model legitimately writes things like
    // "shellfish-free curry paste", and a naive substring check reads that as
    // a violation when it is the opposite.
    const withoutNegations = items.replace(
      /\b(peanut|shellfish|shrimp|prawn)s?[-\s]?free\b/g,
      "",
    );

    expect(withoutNegations).not.toMatch(/\bpeanut/);
    expect(withoutNegations).not.toMatch(/\bshrimp|\bprawn|\bshellfish/);

    // And it should still have produced a usable nutty sauce by substituting.
    expect(items).toMatch(/cashew|almond|tahini|sunflower|sesame/);
  });
});
