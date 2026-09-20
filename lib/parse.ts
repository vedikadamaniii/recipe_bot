/**
 * Parsing free-text ingredient lines into the structured `Ingredient` shape.
 *
 * Recipe sites and pasted text give us lines like "1 1/2 cups all-purpose flour,
 * sifted". Most of those are regular enough to parse deterministically, which
 * means the common case costs no AI quota and always produces the same result.
 * The model is the fallback for lines this cannot handle, not the first resort.
 */

import type { Ingredient } from "./schema";
import { isUnit, type Unit } from "./units";
import { inferScalingBehavior } from "./scale";

const UNICODE_FRACTIONS: Record<string, number> = {
  "¼": 1 / 4,
  "½": 1 / 2,
  "¾": 3 / 4,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 1 / 8,
  "⅜": 3 / 8,
  "⅝": 5 / 8,
  "⅞": 7 / 8,
};

/** Spellings that map onto our canonical units. */
const UNIT_SYNONYMS: Record<string, Unit> = {
  tsp: "tsp",
  tsps: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tbsp: "tbsp",
  tbsps: "tbsp",
  tbs: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  cup: "cup",
  cups: "cup",
  c: "cup",
  g: "g",
  gram: "g",
  grams: "g",
  gramme: "g",
  grammes: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
};

/** Phrases that mean "no fixed amount". */
const TO_TASTE = /\b(to taste|as needed|as required|for serving|for garnish)\b/i;

/**
 * Parse a numeric quantity from the start of a string.
 * Handles "2", "1.5", "1/2", "1 1/2", "½", "1½" and ranges like "2-3".
 */
export function parseQuantity(input: string): { qty: number | null; rest: string } {
  let s = input.trim();

  // Ranges ("2-3 onions"): take the lower bound, which is the safe reading.
  const range = s.match(/^(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s+/);
  if (range) {
    return { qty: parseFloat(range[1]), rest: s.slice(range[0].length) };
  }

  // Order matters: a mixed number ("1 1/2") and a bare fraction ("1/2") must
  // both be tried before the plain-integer matcher, or the "1" in "1/2" gets
  // eaten on its own and the line reads as a whole 1.
  const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)\s*/);
  if (mixed) {
    const denominator = parseFloat(mixed[3]);
    if (denominator !== 0) {
      const value = parseFloat(mixed[1]) + parseFloat(mixed[2]) / denominator;
      return { qty: roundQty(value), rest: s.slice(mixed[0].length).trim() };
    }
  }

  const fraction = s.match(/^(\d+)\s*\/\s*(\d+)\s*/);
  if (fraction) {
    const denominator = parseFloat(fraction[2]);
    if (denominator !== 0) {
      return {
        qty: roundQty(parseFloat(fraction[1]) / denominator),
        rest: s.slice(fraction[0].length).trim(),
      };
    }
  }

  let total = 0;
  let matched = false;

  // Leading whole number, which may be followed by a glyph fraction ("1½").
  const whole = s.match(/^(\d+(?:\.\d+)?)\s*/);
  if (whole) {
    total += parseFloat(whole[1]);
    s = s.slice(whole[0].length);
    matched = true;
  }

  const glyph = s[0];
  if (glyph && glyph in UNICODE_FRACTIONS) {
    total += UNICODE_FRACTIONS[glyph];
    s = s.slice(1).trim();
    matched = true;
  }

  if (!matched) return { qty: null, rest: input.trim() };
  return { qty: roundQty(total), rest: s.trim() };
}

function roundQty(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/** Parse a unit token from the start of a string, if there is one. */
export function parseUnit(input: string): { unit: Unit | null; rest: string } {
  const s = input.trim();
  const token = s.match(/^([a-zA-Z]+)\.?\s+/);
  if (!token) return { unit: null, rest: s };

  const word = token[1].toLowerCase();
  const canonical = UNIT_SYNONYMS[word];
  if (canonical && isUnit(canonical)) {
    return { unit: canonical, rest: s.slice(token[0].length).trim() };
  }

  // "fl oz" is two tokens.
  const flOz = s.match(/^fl\.?\s*(oz|ounces?)\.?\s+/i);
  if (flOz) return { unit: "floz", rest: s.slice(flOz[0].length).trim() };

  return { unit: null, rest: s };
}

/**
 * Parse a single ingredient line.
 *
 * Always returns something usable — an unparseable line becomes an item with no
 * quantity and its original text preserved in `rawAmount`, so nothing is lost.
 */
export function parseIngredientLine(line: string): Ingredient {
  const original = line.trim().replace(/\s+/g, " ");
  if (!original) {
    return { qty: null, unit: null, item: "", scaling: "linear" };
  }

  const { qty, rest: afterQty } = parseQuantity(original);
  const { unit, rest: afterUnit } = qty === null ? { unit: null, rest: afterQty } : parseUnit(afterQty);

  let item = afterUnit;
  let prep: string | null = null;

  // Everything after the first comma is preparation: "onion, finely chopped".
  const comma = item.indexOf(",");
  if (comma !== -1) {
    prep = item.slice(comma + 1).trim() || null;
    item = item.slice(0, comma).trim();
  }

  // Trailing parenthetical is also preparation: "garlic (minced)".
  const paren = item.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (paren) {
    item = paren[1].trim();
    prep = prep ? `${paren[2].trim()}, ${prep}` : paren[2].trim();
  }

  const toTaste = TO_TASTE.test(original);
  if (toTaste && qty === null) {
    item = item.replace(TO_TASTE, "").replace(/[,\s]+$/, "").trim();
  }

  return {
    qty,
    unit,
    item,
    prep,
    scaling: inferScalingBehavior(original),
    rawAmount: qty === null ? original : null,
  };
}

/** Parse a block of ingredient lines, skipping blanks and section headings. */
export function parseIngredientLines(lines: string[]): Ingredient[] {
  return lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map(parseIngredientLine)
    .filter((i) => i.item.length > 0);
}

/** Convert an ISO 8601 duration ("PT1H30M") to minutes. */
export function parseIsoDuration(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!m) return null;
  const [, d, h, min, sec] = m;
  const total =
    (d ? parseInt(d, 10) * 1440 : 0) +
    (h ? parseInt(h, 10) * 60 : 0) +
    (min ? parseInt(min, 10) : 0) +
    (sec ? Math.round(parseFloat(sec) / 60) : 0);
  return total > 0 ? total : null;
}

/** Pull a serving count out of schema.org's very loose `recipeYield`. */
export function parseYield(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const text = Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
  const m = text.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}
