/**
 * Deterministic unit conversion and quantity formatting.
 *
 * This module never calls the AI. Once a recipe has been parsed into structured
 * ingredients, every unit change is pure arithmetic — instant, free and identical
 * every time you ask for it.
 */

export type VolumeUnit = "tsp" | "tbsp" | "floz" | "cup" | "ml" | "l";
export type WeightUnit = "g" | "kg" | "oz" | "lb";
export type Unit = VolumeUnit | WeightUnit;

export type UnitSystem = "volume" | "weight";
export type Measure = "us" | "metric";

/**
 * US volume is defined as exact multiples of one teaspoon, so that conversions
 * *within* the US system come out clean: 3 tsp is exactly 1 tbsp, not 0.99999.
 * The single irrational-ish constant is the tsp -> ml bridge.
 */
const TSP_ML = 4.92892159375;

type UnitMeta = {
  system: UnitSystem;
  measure: Measure;
  inBase: number;
  label: string;
  /**
   * Whether `normalizeUnit` may promote a quantity *into* this unit.
   * Fluid ounces are a valid target when you explicitly ask for them, but no
   * recipe writes "1½ fl oz of oil" — so they stay out of the automatic ladder.
   */
  preferred: boolean;
};

/** Base unit is ml for volume, g for weight. */
export const UNITS: Record<Unit, UnitMeta> = {
  tsp: { system: "volume", measure: "us", inBase: TSP_ML, label: "tsp", preferred: true },
  tbsp: { system: "volume", measure: "us", inBase: 3 * TSP_ML, label: "tbsp", preferred: true },
  floz: { system: "volume", measure: "us", inBase: 6 * TSP_ML, label: "fl oz", preferred: false },
  cup: { system: "volume", measure: "us", inBase: 48 * TSP_ML, label: "cup", preferred: true },
  ml: { system: "volume", measure: "metric", inBase: 1, label: "ml", preferred: true },
  l: { system: "volume", measure: "metric", inBase: 1000, label: "l", preferred: true },
  g: { system: "weight", measure: "metric", inBase: 1, label: "g", preferred: true },
  kg: { system: "weight", measure: "metric", inBase: 1000, label: "kg", preferred: true },
  oz: { system: "weight", measure: "us", inBase: 28.349523125, label: "oz", preferred: true },
  lb: { system: "weight", measure: "us", inBase: 453.59237, label: "lb", preferred: true },
};

export const ALL_UNITS = Object.keys(UNITS) as Unit[];

export function isUnit(value: string | null | undefined): value is Unit {
  return !!value && value in UNITS;
}

export function systemOf(unit: Unit): UnitSystem {
  return UNITS[unit].system;
}

/**
 * Grams per millilitre for ingredients where a volume<->weight conversion is
 * meaningful. Density is a property of the *ingredient*, not the unit, so this
 * is the only way to do it honestly. Anything not in this table simply does not
 * offer the conversion — see `convert`.
 */
const DENSITY_G_PER_ML: Record<string, number> = {
  water: 1.0,
  milk: 1.03,
  "whole milk": 1.03,
  yogurt: 1.03,
  curd: 1.03,
  "all-purpose flour": 0.53,
  "plain flour": 0.53,
  flour: 0.53,
  "bread flour": 0.55,
  "whole wheat flour": 0.51,
  atta: 0.51,
  "granulated sugar": 0.845,
  sugar: 0.845,
  "caster sugar": 0.845,
  "brown sugar": 0.93,
  "powdered sugar": 0.5,
  butter: 0.911,
  ghee: 0.91,
  "olive oil": 0.918,
  "vegetable oil": 0.918,
  oil: 0.918,
  honey: 1.42,
  "maple syrup": 1.33,
  rice: 0.85,
  "basmati rice": 0.85,
  "rolled oats": 0.38,
  oats: 0.38,
  "cocoa powder": 0.42,
  salt: 1.217,
  "table salt": 1.217,
  cornstarch: 0.48,
  "peanut butter": 1.08,
  lentils: 0.85,
  dal: 0.85,
};

/** Look up a density by loose ingredient-name match. Returns null when unknown. */
export function densityFor(item: string | null | undefined): number | null {
  if (!item) return null;
  const name = item.toLowerCase().trim();
  if (name in DENSITY_G_PER_ML) return DENSITY_G_PER_ML[name];
  // Longest matching key wins, so "brown sugar" beats "sugar".
  let best: { key: string; density: number } | null = null;
  for (const [key, density] of Object.entries(DENSITY_G_PER_ML)) {
    if (name.includes(key) && (!best || key.length > best.key.length)) {
      best = { key, density };
    }
  }
  return best ? best.density : null;
}

export class ConversionError extends Error {}

/**
 * Convert a quantity between units.
 *
 * Within a system (volume->volume, weight->weight) this is always possible.
 * Across systems it needs the ingredient's density; pass `item` and we will use
 * the density table. If the ingredient is not in the table we throw rather than
 * guess, because a confidently wrong cups-to-grams number ruins real food.
 */
export function convert(qty: number, from: Unit, to: Unit, item?: string | null): number {
  if (from === to) return qty;

  const fromMeta = UNITS[from];
  const toMeta = UNITS[to];

  if (fromMeta.system === toMeta.system) {
    return round(((qty * fromMeta.inBase) / toMeta.inBase) as number);
  }

  const density = densityFor(item);
  if (density === null) {
    throw new ConversionError(
      `Cannot convert ${from} to ${to}${item ? ` for "${item}"` : ""}: ` +
        `volume-to-weight depends on ingredient density, which is unknown here.`,
    );
  }

  if (fromMeta.system === "volume") {
    const ml = qty * fromMeta.inBase;
    return round((ml * density) / toMeta.inBase);
  }
  const grams = qty * fromMeta.inBase;
  return round(grams / density / toMeta.inBase);
}

/** Whether `convert` would succeed, so the UI can hide impossible toggles. */
export function canConvert(from: Unit, to: Unit, item?: string | null): boolean {
  if (UNITS[from].system === UNITS[to].system) return true;
  return densityFor(item) !== null;
}

/** Units it makes sense to offer for a given starting unit and ingredient. */
export function convertibleUnits(from: Unit, item?: string | null): Unit[] {
  return ALL_UNITS.filter((u) => u !== from && canConvert(from, u, item));
}

function round(n: number, dp = 6): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/**
 * Bulk units that cooks happily write fractions of. Nobody measures "¼ tbsp",
 * but "½ cup" is on the side of every measuring jug. This is what lets us
 * prefer `½ cup` over the arithmetically identical `8 tbsp`.
 */
const FRACTION_FRIENDLY = new Set<Unit>(["cup", "l", "kg", "lb"]);

const NICE_FRACTIONS = [0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1];

function isNiceFraction(value: number): boolean {
  const frac = value - Math.floor(value);
  return NICE_FRACTIONS.some((f) => Math.abs(frac - f) < 0.02);
}

/**
 * Pick the most readable unit for a quantity without leaving its measurement
 * system — so 48 tsp becomes 1 cup, 1500 ml becomes 1.5 l, and half a cup
 * stays half a cup instead of turning into 8 tbsp.
 */
export function normalizeUnit(qty: number, unit: Unit): { qty: number; unit: Unit } {
  const { system, measure } = UNITS[unit];
  const candidates = ALL_UNITS.filter(
    (u) =>
      UNITS[u].system === system &&
      UNITS[u].measure === measure &&
      (UNITS[u].preferred || u === unit),
  ).sort((a, b) => UNITS[a].inBase - UNITS[b].inBase);

  const base = qty * UNITS[unit].inBase;
  let chosen = candidates[0];
  for (const candidate of candidates) {
    // Step up while the quantity stays at or above 1 in the larger unit.
    if (base / UNITS[candidate].inBase >= 1) chosen = candidate;
  }

  // Then step up once more into a bulk unit if the result reads as a clean
  // fraction there — this is the "½ cup, not 8 tbsp" rule.
  for (let i = candidates.indexOf(chosen) + 1; i < candidates.length; i++) {
    const larger = candidates[i];
    const value = base / UNITS[larger].inBase;
    if (FRACTION_FRIENDLY.has(larger) && value >= 0.25 && isNiceFraction(value)) {
      chosen = larger;
    } else {
      break;
    }
  }

  return { qty: round(base / UNITS[chosen].inBase), unit: chosen };
}

const VULGAR: Array<[number, string]> = [
  [1 / 8, "⅛"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [3 / 8, "⅜"],
  [1 / 2, "½"],
  [5 / 8, "⅝"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [7 / 8, "⅞"],
];

/**
 * Format a number the way a recipe would write it: `1½` rather than
 * `1.5000000000000002`. Metric quantities stay decimal, because nobody writes
 * "⅓ ml".
 */
export function formatQuantity(qty: number, unit?: Unit | null): string {
  if (!Number.isFinite(qty)) return "";
  if (unit && UNITS[unit].measure === "metric") {
    // Grams and ml are read as round numbers; keep at most one decimal.
    const rounded = qty >= 10 ? Math.round(qty) : Math.round(qty * 10) / 10;
    return String(rounded);
  }

  const whole = Math.floor(qty + 1e-9);
  const frac = qty - whole;

  if (frac < 0.0625) return String(whole);

  let best: [number, string] | null = null;
  let bestDelta = Infinity;
  for (const [value, glyph] of VULGAR) {
    const delta = Math.abs(frac - value);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = [value, glyph];
    }
  }
  // Rounds up to the next whole number when the remainder is nearly 1.
  if (1 - frac < bestDelta) return String(whole + 1);
  if (!best || bestDelta > 0.06) {
    return String(Math.round(qty * 100) / 100);
  }
  return whole === 0 ? best[1] : `${whole}${best[1]}`;
}

/** Render a full quantity + unit, e.g. `1½ tbsp`. */
export function formatAmount(qty: number | null, unit: Unit | null): string {
  if (qty === null) return "";
  if (!unit) return formatQuantity(qty);
  return `${formatQuantity(qty, unit)} ${UNITS[unit].label}`;
}
