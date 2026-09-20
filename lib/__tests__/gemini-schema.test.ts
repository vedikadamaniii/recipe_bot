import { describe, expect, it } from "vitest";
import { coerceRecipe, parseJsonResponse } from "../gemini-schema";
import { scaleRecipe } from "../scale";
import type { Recipe } from "../schema";

const good = {
  title: "Chickpea Curry",
  description: "Weeknight curry.",
  cuisine: "Indian",
  tags: ["high-protein", "vegan"],
  baseServings: 4,
  totalTimeMin: 30,
  ingredients: [
    { qty: 2, unit: "tbsp", item: "olive oil", scaling: "linear" },
    { qty: 1, unit: null, item: "onion", prep: "diced", scaling: "linear" },
    { qty: 1, unit: "tsp", item: "garam masala", scaling: "manual" },
  ],
  steps: [
    { n: 1, text: "Fry the onion." },
    { n: 2, text: "Add everything else.", minutes: 20 },
  ],
  missingFromPantry: ["chickpeas"],
};

describe("coerceRecipe", () => {
  it("passes a well-formed response straight through", () => {
    const r = coerceRecipe(good, "generated");
    expect(r.title).toBe("Chickpea Curry");
    expect(r.baseServings).toBe(4);
    expect(r.ingredients).toHaveLength(3);
    expect(r.ingredients[2].scaling).toBe("manual");
    expect(r.missingFromPantry).toEqual(["chickpeas"]);
    expect(r.sourceType).toBe("generated");
  });

  it("keeps an invented unit as part of the item instead of dropping it", () => {
    // Models occasionally return units outside our list ("bunch", "handful").
    // Losing the word entirely would turn "1 bunch coriander" into "1 coriander".
    const r = coerceRecipe(
      { ...good, ingredients: [{ qty: 1, unit: "bunch", item: "coriander", scaling: "linear" }] },
      "generated",
    );
    expect(r.ingredients[0].unit).toBeNull();
    expect(r.ingredients[0].item).toBe("bunch coriander");
    expect(r.ingredients[0].qty).toBe(1);
  });

  it("normalises unit casing and whitespace", () => {
    const r = coerceRecipe(
      { ...good, ingredients: [{ qty: 1, unit: " TBSP ", item: "oil", scaling: "linear" }] },
      "generated",
    );
    expect(r.ingredients[0].unit).toBe("tbsp");
  });

  it("infers a missing scaling flag rather than defaulting to linear", () => {
    const r = coerceRecipe(
      { ...good, ingredients: [{ qty: 1, unit: "tsp", item: "chilli powder" }] },
      "generated",
    );
    expect(r.ingredients[0].scaling).toBe("manual");
  });

  it("survives a response missing almost everything", () => {
    const r = coerceRecipe({}, "manual");
    expect(r.title).toBe("Untitled recipe");
    expect(r.cuisine).toBe("Other");
    expect(r.baseServings).toBe(2);
    expect(r.ingredients).toEqual([]);
    expect(r.steps).toEqual([]);
  });

  it("rejects a nonsense serving count instead of breaking every scaled version", () => {
    // baseServings is the divisor for all scaling; a 0 here would be fatal.
    expect(coerceRecipe({ ...good, baseServings: 0 }, "generated").baseServings).toBe(2);
    expect(coerceRecipe({ ...good, baseServings: -3 }, "generated").baseServings).toBe(2);
    expect(coerceRecipe({ ...good, baseServings: "six" }, "generated").baseServings).toBe(2);
  });

  it("renumbers steps that arrive without numbers", () => {
    const r = coerceRecipe(
      { ...good, steps: [{ text: "First." }, { text: "Second." }] },
      "generated",
    );
    expect(r.steps.map((s) => s.n)).toEqual([1, 2]);
  });

  it("coerces a non-finite quantity to null rather than NaN", () => {
    const r = coerceRecipe(
      { ...good, ingredients: [{ qty: NaN, unit: "g", item: "flour", scaling: "linear" }] },
      "generated",
    );
    expect(r.ingredients[0].qty).toBeNull();
  });

  it("produces output the deterministic scaler can consume", () => {
    // The whole point of the schema: generated recipes scale like any other.
    const draft = coerceRecipe(good, "generated");
    const recipe: Recipe = { ...draft, id: "x", userId: "u", createdAt: "now" };
    const scaled = scaleRecipe(recipe, 8);
    expect(scaled.factor).toBe(2);
    expect(scaled.ingredients[0].scaledQty).toBe(0.25);
    expect(scaled.ingredients[0].scaledUnit).toBe("cup");
    expect(scaled.ingredients[2].needsTasteCheck).toBe(true);
  });
});

describe("parseJsonResponse", () => {
  it("parses plain JSON", () => {
    expect(parseJsonResponse('{"a":1}')).toEqual({ a: 1 });
  });

  it("tolerates markdown fencing", () => {
    expect(parseJsonResponse('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonResponse('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("gives a readable error instead of a raw SyntaxError", () => {
    expect(() => parseJsonResponse("not json")).toThrow(/valid JSON/);
    expect(() => parseJsonResponse(undefined)).toThrow(/empty response/);
  });
});
