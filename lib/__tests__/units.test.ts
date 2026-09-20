import { describe, expect, it } from "vitest";
import {
  ConversionError,
  toMeasure,
  canConvert,
  convert,
  convertibleUnits,
  densityFor,
  formatAmount,
  formatQuantity,
  normalizeUnit,
} from "../units";

describe("convert — within a system", () => {
  it("gives clean answers across US volume units", () => {
    expect(convert(3, "tsp", "tbsp")).toBe(1);
    expect(convert(1, "tbsp", "tsp")).toBe(3);
    expect(convert(16, "tbsp", "cup")).toBe(1);
    expect(convert(1, "cup", "tsp")).toBe(48);
    expect(convert(2, "cup", "floz")).toBe(16);
  });

  it("does not drift on repeated multiples", () => {
    expect(convert(6, "tsp", "tbsp")).toBe(2);
    expect(convert(9, "tsp", "tbsp")).toBe(3);
    expect(convert(0.5, "cup", "tbsp")).toBe(8);
  });

  it("converts US volume to metric", () => {
    expect(convert(1, "cup", "ml")).toBeCloseTo(236.588, 2);
    expect(convert(1, "tsp", "ml")).toBeCloseTo(4.929, 3);
  });

  it("converts within weight", () => {
    expect(convert(1, "kg", "g")).toBe(1000);
    expect(convert(16, "oz", "lb")).toBe(1);
    expect(convert(1, "lb", "g")).toBeCloseTo(453.592, 2);
  });

  it("is identity for the same unit", () => {
    expect(convert(7.5, "g", "g")).toBe(7.5);
  });
});

describe("convert — across systems (volume <-> weight)", () => {
  it("uses the density table for known ingredients", () => {
    // 1 cup of flour is the canonical ~125 g.
    expect(convert(1, "cup", "g", "all-purpose flour")).toBeCloseTo(125.4, 0);
    // Water is the easy case: 1 ml = 1 g.
    expect(convert(500, "ml", "g", "water")).toBeCloseTo(500, 5);
  });

  it("matches the longest density key, so 'brown sugar' beats 'sugar'", () => {
    expect(densityFor("packed brown sugar")).toBe(0.93);
    expect(densityFor("granulated sugar")).toBe(0.845);
  });

  it("REFUSES to guess when the ingredient density is unknown", () => {
    // This is the important one: a confidently wrong cups-to-grams number is
    // worse than no conversion at all.
    expect(() => convert(1, "cup", "g", "chopped mushrooms")).toThrow(ConversionError);
    expect(() => convert(1, "cup", "g")).toThrow(ConversionError);
    expect(canConvert("cup", "g", "chopped mushrooms")).toBe(false);
    expect(canConvert("cup", "g", "flour")).toBe(true);
  });

  it("only offers convertible units to the UI", () => {
    const forMushrooms = convertibleUnits("cup", "chopped mushrooms");
    expect(forMushrooms).not.toContain("g");
    expect(forMushrooms).toContain("ml");

    const forFlour = convertibleUnits("cup", "flour");
    expect(forFlour).toContain("g");
  });
});

describe("normalizeUnit", () => {
  it("steps up to a readable unit within the same measurement system", () => {
    expect(normalizeUnit(48, "tsp")).toEqual({ qty: 1, unit: "cup" });
    expect(normalizeUnit(1500, "ml")).toEqual({ qty: 1.5, unit: "l" });
    expect(normalizeUnit(1000, "g")).toEqual({ qty: 1, unit: "kg" });
  });

  it("steps down for small amounts", () => {
    expect(normalizeUnit(0.25, "tbsp")).toEqual({ qty: 0.75, unit: "tsp" });
  });

  it("prefers fractions of bulk units over whole small ones", () => {
    // Cooks write "½ cup", not the arithmetically identical "8 tbsp".
    expect(normalizeUnit(0.5, "cup")).toEqual({ qty: 0.5, unit: "cup" });
    expect(normalizeUnit(8, "tbsp")).toEqual({ qty: 0.5, unit: "cup" });
    expect(normalizeUnit(12, "tbsp")).toEqual({ qty: 0.75, unit: "cup" });
    // But small spoon amounts stay on the spoon ladder: ¼ tbsp is not a thing.
    expect(normalizeUnit(0.25, "tbsp")).toEqual({ qty: 0.75, unit: "tsp" });
    expect(normalizeUnit(3, "tbsp")).toEqual({ qty: 3, unit: "tbsp" });
  });

  it("never crosses from US to metric", () => {
    expect(normalizeUnit(2, "cup").unit).toBe("cup");
    expect(normalizeUnit(3, "tbsp").unit).toBe("tbsp");
  });
});

describe("formatQuantity", () => {
  it("writes cooking fractions, not floats", () => {
    expect(formatQuantity(1.5, "tbsp")).toBe("1½");
    expect(formatQuantity(0.5, "cup")).toBe("½");
    expect(formatQuantity(0.25, "tsp")).toBe("¼");
    expect(formatQuantity(0.75, "cup")).toBe("¾");
    expect(formatQuantity(2.3333333, "cup")).toBe("2⅓");
    expect(formatQuantity(4.5, "cup")).toBe("4½");
  });

  it("survives floating point noise", () => {
    expect(formatQuantity(1.5000000000000002, "tbsp")).toBe("1½");
    expect(formatQuantity(2.9999999, "tsp")).toBe("3");
  });

  it("keeps metric decimal", () => {
    expect(formatQuantity(236.588, "ml")).toBe("237");
    expect(formatQuantity(2.5, "g")).toBe("2.5");
  });

  it("formats whole numbers plainly", () => {
    expect(formatQuantity(3, "tsp")).toBe("3");
  });

  it("renders amounts with their unit label", () => {
    expect(formatAmount(1.5, "tbsp")).toBe("1½ tbsp");
    expect(formatAmount(1, "floz")).toBe("1 fl oz");
    expect(formatAmount(2, null)).toBe("2");
    expect(formatAmount(null, "cup")).toBe("");
  });
});

describe("toMeasure", () => {
  it("switches US volume to metric and back", () => {
    expect(toMeasure(1, "cup", "metric")).toEqual({ qty: 236.588237, unit: "ml" });
    expect(toMeasure(250, "ml", "us").unit).toBe("cup");
  });

  it("switches weight systems", () => {
    expect(toMeasure(1, "lb", "metric")).toEqual({ qty: 453.59237, unit: "g" });
    expect(toMeasure(500, "g", "us").unit).toBe("lb");
  });

  it("never needs a density, so it cannot fail on an unknown ingredient", () => {
    // The global US/metric toggle is safe on every recipe precisely because it
    // stays within a system. Volume never becomes weight here.
    expect(() => toMeasure(1, "cup", "metric")).not.toThrow();
    expect(toMeasure(1, "cup", "metric").unit).toBe("ml");
    expect(toMeasure(200, "g", "us").unit).not.toBe("cup");
  });

  it("normalises the result", () => {
    expect(toMeasure(2000, "ml", "metric")).toEqual({ qty: 2, unit: "l" });
    expect(toMeasure(48, "tsp", "us")).toEqual({ qty: 1, unit: "cup" });
  });

  it("is stable when already in the requested system", () => {
    expect(toMeasure(3, "tbsp", "us")).toEqual({ qty: 3, unit: "tbsp" });
  });
});
