import { describe, expect, it } from "vitest";
import {
  parseIngredientLine,
  parseIngredientLines,
  parseIsoDuration,
  parseQuantity,
  parseUnit,
  parseYield,
  stripDualMeasurement,
} from "../parse";

describe("parseQuantity", () => {
  it("reads the numeric forms recipes actually use", () => {
    expect(parseQuantity("2 eggs").qty).toBe(2);
    expect(parseQuantity("1.5 cups flour").qty).toBe(1.5);
    expect(parseQuantity("1/2 tsp salt").qty).toBe(0.5);
    expect(parseQuantity("1 1/2 cups flour").qty).toBe(1.5);
    expect(parseQuantity("½ tsp salt").qty).toBe(0.5);
    expect(parseQuantity("1½ cups flour").qty).toBe(1.5);
    expect(parseQuantity("⅓ cup oil").qty).toBeCloseTo(1 / 3, 5);
  });

  it("takes the lower bound of a range", () => {
    expect(parseQuantity("2-3 onions").qty).toBe(2);
    expect(parseQuantity("2 to 3 onions").qty).toBe(2);
  });

  it("returns null when there is no number, leaving the text intact", () => {
    const r = parseQuantity("Salt to taste");
    expect(r.qty).toBeNull();
    expect(r.rest).toBe("Salt to taste");
  });

  it("does not divide by zero on malformed fractions", () => {
    expect(() => parseQuantity("1/0 cups flour")).not.toThrow();
  });
});

describe("parseUnit", () => {
  it("maps spellings onto canonical units", () => {
    expect(parseUnit("cups flour").unit).toBe("cup");
    expect(parseUnit("tablespoons olive oil").unit).toBe("tbsp");
    expect(parseUnit("tsp. salt").unit).toBe("tsp");
    expect(parseUnit("grams butter").unit).toBe("g");
    expect(parseUnit("fl oz milk").unit).toBe("floz");
  });

  it("does not mistake an ingredient for a unit", () => {
    expect(parseUnit("eggs").unit).toBeNull();
    expect(parseUnit("onion, diced").unit).toBeNull();
  });
});

describe("parseIngredientLine", () => {
  it("parses the standard shape", () => {
    const r = parseIngredientLine("1 1/2 cups all-purpose flour");
    expect(r).toMatchObject({ qty: 1.5, unit: "cup", item: "all-purpose flour" });
  });

  it("handles countable items with no unit", () => {
    const r = parseIngredientLine("2 eggs");
    expect(r).toMatchObject({ qty: 2, unit: null, item: "eggs" });
  });

  it("splits preparation off after a comma", () => {
    const r = parseIngredientLine("1 onion, finely chopped");
    expect(r.item).toBe("onion");
    expect(r.prep).toBe("finely chopped");
  });

  it("splits preparation out of a parenthetical", () => {
    const r = parseIngredientLine("3 cloves garlic (minced)");
    expect(r.item).toBe("cloves garlic");
    expect(r.prep).toBe("minced");
  });

  it("recognises 'to taste' as having no fixed quantity", () => {
    const r = parseIngredientLine("Salt to taste");
    expect(r.qty).toBeNull();
    expect(r.item.toLowerCase()).toBe("salt");
    expect(r.scaling).toBe("manual");
  });

  it("flags spices as needing a taste check", () => {
    expect(parseIngredientLine("1 tsp red chilli powder").scaling).toBe("manual");
    expect(parseIngredientLine("200 g chicken thighs").scaling).toBe("linear");
  });

  it("never loses text it cannot structure", () => {
    const r = parseIngredientLine("A generous handful of coriander");
    expect(r.qty).toBeNull();
    expect(r.rawAmount).toBe("A generous handful of coriander");
    expect(r.item.length).toBeGreaterThan(0);
  });

  it("handles the metric/imperial double that UK sites write", () => {
    // "800g/1lb 12oz" is one amount written twice, not two ingredients.
    const r = parseIngredientLine("800g/1lb 12oz canned chickpeas");
    expect(r.qty).toBe(800);
    expect(r.unit).toBe("g");
    expect(r.item).toBe("canned chickpeas");

    const r2 = parseIngredientLine("1kg/2lb 4oz potatoes, peeled");
    expect(r2).toMatchObject({ qty: 1, unit: "kg", item: "potatoes", prep: "peeled" });
  });

  it("does not mangle a lone measurement or a fraction with a slash", () => {
    expect(stripDualMeasurement("400g canned tomatoes")).toBe("400g canned tomatoes");
    expect(parseIngredientLine("1/2 tsp salt").qty).toBe(0.5);
    expect(parseIngredientLine("1 1/2 cups flour").qty).toBe(1.5);
  });

  it("survives empty and whitespace input", () => {
    expect(parseIngredientLine("").item).toBe("");
    expect(parseIngredientLine("   ").item).toBe("");
  });

  it("parses a realistic ingredient list end to end", () => {
    const parsed = parseIngredientLines([
      "2 tbsp olive oil",
      "1 large onion, thinly sliced",
      "",
      "3 cloves garlic, minced",
      "½ tsp turmeric",
      "400 g canned tomatoes",
      "Salt to taste",
    ]);
    expect(parsed).toHaveLength(6);
    expect(parsed[0]).toMatchObject({ qty: 2, unit: "tbsp", item: "olive oil" });
    expect(parsed[3]).toMatchObject({ qty: 0.5, unit: "tsp", scaling: "manual" });
    expect(parsed[4]).toMatchObject({ qty: 400, unit: "g" });
    expect(parsed[5].qty).toBeNull();
  });
});

describe("schema.org value parsing", () => {
  it("converts ISO durations to minutes", () => {
    expect(parseIsoDuration("PT30M")).toBe(30);
    expect(parseIsoDuration("PT1H30M")).toBe(90);
    expect(parseIsoDuration("PT2H")).toBe(120);
    expect(parseIsoDuration(null)).toBeNull();
    expect(parseIsoDuration("nonsense")).toBeNull();
  });

  it("digs a serving count out of loose recipeYield values", () => {
    expect(parseYield(4)).toBe(4);
    expect(parseYield("4 servings")).toBe(4);
    expect(parseYield(["6 servings", "6"])).toBe(6);
    expect(parseYield("a loaf")).toBeNull();
    expect(parseYield(undefined)).toBeNull();
  });
});
