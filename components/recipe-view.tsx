"use client";

import { useMemo, useState } from "react";
import type { Recipe } from "@/lib/schema";
import { SERVING_PRESETS, scaleRecipe, type ScaledIngredient } from "@/lib/scale";
import { formatAmount, formatQuantity, toMeasure, UNITS, type Measure } from "@/lib/units";
import { Chilli, Citrus, Pot, SectionHeading } from "@/components/ornaments";

type MeasurePref = "written" | Measure;

const MEASURE_OPTIONS: { value: MeasurePref; label: string }[] = [
  { value: "written", label: "As written" },
  { value: "us", label: "Cups" },
  { value: "metric", label: "Metric" },
];

/** Apply the reader's unit preference on top of the scaled amount. */
function displayAmount(ing: ScaledIngredient, pref: MeasurePref): string {
  if (ing.scaledQty === null) {
    return ing.rawAmount && !ing.qty ? "" : "";
  }
  if (!ing.scaledUnit) return formatQuantity(ing.scaledQty);

  if (pref === "written") return formatAmount(ing.scaledQty, ing.scaledUnit);

  const converted = toMeasure(ing.scaledQty, ing.scaledUnit, pref);
  return formatAmount(converted.qty, converted.unit);
}

export function RecipeView({
  recipe,
  onAskSubstitute,
}: {
  recipe: Recipe;
  onAskSubstitute?: (ingredient: string) => void;
}) {
  const [servings, setServings] = useState(recipe.baseServings);
  const [pref, setPref] = useState<MeasurePref>("written");

  const scaled = useMemo(() => scaleRecipe(recipe, servings), [recipe, servings]);
  const isScaled = scaled.factor !== 1;

  // Ingredients keep their original order but are visually grouped.
  const groups = useMemo(() => {
    const map = new Map<string, ScaledIngredient[]>();
    for (const ing of scaled.ingredients) {
      const key = ing.group?.trim() || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ing);
    }
    return [...map.entries()];
  }, [scaled]);

  const tasteChecks = scaled.ingredients.filter((i) => i.needsTasteCheck).length;

  return (
    <article>
      {/* Controls. Scaling is the signature interaction, so it sits above the
          ingredients rather than hidden in a menu. */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-sm text-bark mr-1">Servings</span>
          {SERVING_PRESETS.map((preset) => (
            <button
              key={preset.servings}
              className="chip"
              aria-pressed={servings === preset.servings}
              onClick={() => setServings(preset.servings)}
            >
              {preset.label}
            </button>
          ))}
          <label className="flex items-center gap-1.5 ml-1">
            <span className="sr-only">Custom servings</span>
            <input
              type="number"
              min={1}
              max={50}
              value={servings}
              onChange={(e) =>
                setServings(Math.min(50, Math.max(1, Number(e.target.value) || 1)))
              }
              className="field w-16 py-1 text-center qty"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-bark mr-1">Units</span>
          {MEASURE_OPTIONS.map((option) => (
            <button
              key={option.value}
              className="chip"
              aria-pressed={pref === option.value}
              onClick={() => setPref(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {isScaled && (
        <p className="text-sm mb-5 text-blue">
          Scaled from {recipe.baseServings} to {servings}{" "}
          {servings === 1 ? "serving" : "servings"}.
        </p>
      )}

      {/* The ingredient ledger: quantities align in their own column. */}
      <section className="mb-9">
        <SectionHeading icon={<Citrus />}>Ingredients</SectionHeading>
        {groups.map(([group, items]) => (
          <div key={group || "_"} className="mb-4">
            {group && (
              <h3 className="text-sm text-bark mt-4 mb-1 italic">{group}</h3>
            )}
            <ul>
              {items.map((ing, i) => (
                <li
                  key={`${group}-${i}-${ing.item}`}
                  className="flex items-baseline gap-3 py-2 border-t border-mist"
                >
                  <span
                    className={`qty w-28 shrink-0 text-right ${
                      isScaled && ing.scaledQty !== null ? "text-blue" : ""
                    }`}
                  >
                    {displayAmount(ing, pref)}
                  </span>
                  <span className="flex-1">
                    {ing.item}
                    {ing.prep && <span className="text-bark">, {ing.prep}</span>}
                    {ing.scaledQty === null && (
                      <span className="text-fade"> — to taste</span>
                    )}
                    {ing.needsTasteCheck && (
                      <span className="text-turmeric text-sm"> · taste and adjust</span>
                    )}
                  </span>
                  {onAskSubstitute && (
                    <button
                      onClick={() => onAskSubstitute(ing.item)}
                      className="text-sm text-fade hover:text-sage shrink-0"
                    >
                      Swap
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}

        {tasteChecks > 0 && (
          <p className="text-sm text-bark mt-4 leading-relaxed border-l-2 border-turmeric pl-3 flex gap-2">
            <span className="text-turmeric shrink-0 mt-0.5"><Chilli size={16} /></span>
            <span>
            {tasteChecks === 1 ? "One ingredient does" : `${tasteChecks} ingredients do`}{" "}
            not scale linearly in real cooking. The arithmetic is done, but season
            towards it rather than tipping it all in.
            </span>
          </p>
        )}
      </section>

      <section>
        <SectionHeading icon={<Pot />}>Method</SectionHeading>
        <ol>
          {scaled.steps.map((step) => (
            <li
              key={step.n}
              className="flex gap-4 py-3 border-t border-mist leading-relaxed"
            >
              <span className="qty text-fade w-6 shrink-0">{step.n}</span>
              <span className="flex-1">
                {step.text}
                {step.minutes ? (
                  <span className="text-fade"> ({step.minutes} min)</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}

/** Compact metadata line used above a recipe. */
export function RecipeMeta({ recipe }: { recipe: Recipe }) {
  const bits = [
    recipe.cuisine,
    recipe.totalTimeMin ? `${recipe.totalTimeMin} min` : null,
    `serves ${recipe.baseServings}`,
  ].filter(Boolean);

  return (
    <p className="text-bark text-sm">
      {bits.map((bit, i) => (
        <span key={bit as string}>
          {i > 0 && <span className="text-fade"> / </span>}
          {bit}
        </span>
      ))}
    </p>
  );
}

export { UNITS };
