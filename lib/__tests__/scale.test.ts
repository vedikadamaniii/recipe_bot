import { describe, expect, it } from "vitest";
import type { Ingredient, Recipe } from "../schema";
import { inferScalingBehavior, scaleIngredient, scaleRecipe } from "../scale";
import { formatAmount } from "../units";

const ing = (partial: Partial<Ingredient> & { item: string }): Ingredient => ({
  qty: null,
  unit: null,
  scaling: "linear",
  ...partial,
});

describe("inferScalingBehavior", () => {
  it("flags the things that do not scale linearly in real cooking", () => {
    expect(inferScalingBehavior("salt")).toBe("manual");
    expect(inferScalingBehavior("red chilli powder")).toBe("manual");
    expect(inferScalingBehavior("baking soda")).toBe("manual");
    expect(inferScalingBehavior("vanilla extract")).toBe("manual");
    expect(inferScalingBehavior("oil for deep frying")).toBe("manual");
    expect(inferScalingBehavior("garam masala")).toBe("manual");
  });

  it("leaves ordinary ingredients linear", () => {
    expect(inferScalingBehavior("chicken thighs")).toBe("linear");
    expect(inferScalingBehavior("basmati rice")).toBe("linear");
    expect(inferScalingBehavior("onion")).toBe("linear");
  });
});

describe("scaleIngredient", () => {
  it("scales linearly and normalises the unit", () => {
    const result = scaleIngredient(ing({ item: "flour", qty: 1.5, unit: "cup" }), 3);
    expect(result.scaledQty).toBe(4.5);
    expect(result.scaledUnit).toBe("cup");
    expect(formatAmount(result.scaledQty, result.scaledUnit)).toBe("4½ cup");
  });

  it("promotes to a larger unit when the number gets unwieldy", () => {
    // 16 tbsp of stock is really 1 cup.
    const result = scaleIngredient(ing({ item: "stock", qty: 4, unit: "tbsp" }), 4);
    expect(result.scaledUnit).toBe("cup");
    expect(result.scaledQty).toBe(1);
  });

  it("leaves 'to taste' amounts alone", () => {
    const result = scaleIngredient(ing({ item: "salt", qty: null, scaling: "manual" }), 3);
    expect(result.scaledQty).toBeNull();
  });

  it("flags manual ingredients instead of silently tripling the chilli", () => {
    const result = scaleIngredient(
      ing({ item: "chilli powder", qty: 1, unit: "tsp", scaling: "manual" }),
      3,
    );
    // The arithmetic still happens (and 3 tsp normalises to 1 tbsp)...
    expect(result.scaledQty).toBe(1);
    expect(result.scaledUnit).toBe("tbsp");
    // ...but the cook is told to check.
    expect(result.needsTasteCheck).toBe(true);
  });

  it("does not nag when the recipe is not actually being scaled", () => {
    const result = scaleIngredient(
      ing({ item: "salt", qty: 1, unit: "tsp", scaling: "manual" }),
      1,
    );
    expect(result.needsTasteCheck).toBe(false);
  });

  it("keeps countable items whole-ish — 1.37 eggs is not an instruction", () => {
    const eggs = scaleIngredient(ing({ item: "eggs", qty: 2, unit: null }), 1.5);
    expect(eggs.scaledQty).toBe(3);
    expect(eggs.scaledUnit).toBeNull();

    const onion = scaleIngredient(ing({ item: "onion", qty: 1, unit: null }), 1.37);
    expect(onion.scaledQty).toBe(1.5);
  });

  it("falls back to inferred behaviour when the source did not classify", () => {
    const loose = { item: "sea salt", qty: 1, unit: "tsp" } as unknown as Ingredient;
    expect(scaleIngredient(loose, 3).needsTasteCheck).toBe(true);
  });
});

describe("scaleRecipe", () => {
  const recipe: Recipe = {
    id: "r1",
    userId: "u1",
    title: "Weeknight Dal",
    cuisine: "Indian",
    tags: ["high-protein"],
    baseServings: 2,
    sourceType: "generated",
    createdAt: "2026-09-20T00:00:00Z",
    steps: [{ n: 1, text: "Simmer everything." }],
    ingredients: [
      ing({ item: "red lentils", qty: 1, unit: "cup" }),
      ing({ item: "onion", qty: 1, unit: null }),
      ing({ item: "turmeric", qty: 0.5, unit: "tsp", scaling: "manual" }),
      ing({ item: "salt", qty: null, scaling: "manual" }),
    ],
  };

  it("scales from base servings to the target", () => {
    const scaled = scaleRecipe(recipe, 6);
    expect(scaled.factor).toBe(3);
    expect(scaled.servings).toBe(6);
    expect(scaled.ingredients[0].scaledQty).toBe(3);
    expect(scaled.ingredients[1].scaledQty).toBe(3);
    expect(scaled.ingredients[2].needsTasteCheck).toBe(true);
    expect(scaled.ingredients[3].scaledQty).toBeNull();
  });

  it("scales down as well as up", () => {
    const scaled = scaleRecipe(recipe, 1);
    expect(scaled.factor).toBe(0.5);
    expect(formatAmount(scaled.ingredients[0].scaledQty, scaled.ingredients[0].scaledUnit)).toBe(
      "½ cup",
    );
  });

  it("is a no-op at the base serving count", () => {
    const scaled = scaleRecipe(recipe, 2);
    expect(scaled.factor).toBe(1);
    expect(scaled.ingredients[0].scaledQty).toBe(1);
    expect(scaled.ingredients.every((i) => !i.needsTasteCheck)).toBe(true);
  });

  it("does not divide by zero on a malformed base", () => {
    const broken = { ...recipe, baseServings: 0 };
    expect(() => scaleRecipe(broken, 4)).not.toThrow();
    expect(scaleRecipe(broken, 4).factor).toBe(4);
  });

  it("preserves recipe metadata through scaling", () => {
    const scaled = scaleRecipe(recipe, 5);
    expect(scaled.title).toBe("Weeknight Dal");
    expect(scaled.cuisine).toBe("Indian");
    expect(scaled.steps).toHaveLength(1);
  });
});
