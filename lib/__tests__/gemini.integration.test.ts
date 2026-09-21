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
import type { Recipe, TasteProfile } from "../schema";
import { TASTE } from "../taste";

const apiKey = process.env.GEMINI_API_KEY;

// The real shipped profile, so these tests exercise the rules that actually
// reach the model rather than a stand-in.
const profile: TasteProfile = TASTE;

const pantry = [
  "red lentils",
  "onions",
  "garlic",
  "canned tomatoes",
  "spinach",
  "greek yogurt",
];

describe.skipIf(!apiKey)("Gemini structured output (live)", () => {
  it("returns recipes that satisfy our schema and scale deterministically", async () => {
    const parsed = (await generateJson({
      prompt: buildUserPrompt({
        ask: "high protein dinner I can batch cook",
        intents: ["high-protein", "meal-prep"],
        have: pantry,
        useOnlyWhatIHave: true,
      }),
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

  it("refuses beef and pork even when the dish asks for them", async () => {
    const parsed = await generateJson({
      prompt: buildUserPrompt({
        ask: "a classic slow-cooked beef ragu with pancetta, for pasta",
        servings: 4,
      }),
      systemInstruction: buildSystemInstruction(profile),
      schema: GENERATION_SCHEMA,
    });

    const items = (parsed as { recipes: Record<string, unknown>[] }).recipes
      .map((r) => coerceRecipe(r, "generated"))
      .flatMap((r) => r.ingredients.map((i) => i.item))
      .join(" | ")
      .toLowerCase();

    expect(items).not.toMatch(/\bbeef|\bveal\b|\bbrisket\b|\bchuck\b/);
    expect(items).not.toMatch(/\bpork\b|\bpancetta\b|\bbacon\b|\bguanciale\b|\bchorizo\b|\bprosciutto\b/);
  });

  it("allows only shrimp and salmon, and does not over-restrict condiments", async () => {
    const parsed = await generateJson({
      prompt: buildUserPrompt({
        ask: "a punchy Thai-style seafood noodle dish built on fish sauce",
        servings: 2,
      }),
      systemInstruction: buildSystemInstruction(profile),
      schema: GENERATION_SCHEMA,
    });

    const recipes = (parsed as { recipes: Record<string, unknown>[] }).recipes.map((r) =>
      coerceRecipe(r, "generated"),
    );
    const items = recipes
      .flatMap((r) => r.ingredients.map((i) => i.item))
      .join(" | ")
      .toLowerCase();

    // Banned seafood must not appear as an ingredient.
    expect(items).not.toMatch(/\bcod\b|\btuna\b|\bsquid\b|\bmussel|\bcrab\b|\bscallop|\banchov|\boyster(?!\s+sauce)/);

    // ...but the condiment carve-out must survive, or the rule has overshot
    // and made whole cuisines impossible.
    expect(items).toMatch(/fish sauce|shrimp paste|oyster sauce/);
  });
});
