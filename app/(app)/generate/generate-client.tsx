"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DraftRecipe, Recipe } from "@/lib/schema";
import { COMMON_CUISINES } from "@/lib/schema";
import { RecipeMeta, RecipeView } from "@/components/recipe-view";
import { Citrus, Fork, SectionHeading, Whisk } from "@/components/ornaments";
import { HAVE_STORAGE_KEY, readHave } from "@/lib/have";
import { saveGenerated } from "./actions";

type Generated = DraftRecipe & { missingFromPantry: string[] };

const INTENTS = [
  { id: "high-protein", label: "High protein" },
  { id: "wholesome", label: "Wholesome" },
  { id: "quick", label: "Under 30 min" },
  { id: "meal-prep", label: "Meal prep" },
  { id: "comfort", label: "Comfort" },
  { id: "light", label: "Light" },
  { id: "one-pot", label: "One pot" },
  { id: "breakfast", label: "Breakfast" },
  { id: "budget", label: "Budget" },
];

/** Split the free-typed ingredient box into a clean list. */
function toList(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function GenerateClient() {
  const [have, setHave] = useState("");
  const [ask, setAsk] = useState("");
  const [intents, setIntents] = useState<string[]>([]);
  const [cuisine, setCuisine] = useState("");
  const [centerpiece, setCenterpiece] = useState("");
  const [onlyWhatIHave, setOnlyWhatIHave] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Generated[]>([]);

  // What you had in last time is a better starting point than a blank box,
  // and it lets substitutions on a saved recipe stay aware of your kitchen.
  useEffect(() => {
    setHave(readHave().join("\n"));
  }, []);

  function persistHave(value: string) {
    setHave(value);
    try {
      localStorage.setItem(HAVE_STORAGE_KEY, JSON.stringify(toList(value)));
    } catch {
      // Private browsing, blocked storage — not worth failing over.
    }
  }

  function toggleIntent(id: string) {
    setIntents((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  }

  async function generate() {
    setLoading(true);
    setError("");
    setResults([]);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ask,
          intents,
          cuisine: cuisine || null,
          centerpiece: centerpiece || null,
          have: toList(have),
          useOnlyWhatIHave: onlyWhatIHave,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed.");
      setResults(data.recipes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }

  const haveCount = toList(have).length;

  return (
    <div>
      <h1 className="display text-5xl mb-2">What are you cooking?</h1>
      <p className="text-bark mb-8 leading-relaxed max-w-prose">
        Tell it what is in the kitchen and what you feel like. It already knows
        how you eat.
      </p>

      <div className="card p-5 mb-6">
        <SectionHeading icon={<Citrus />}>What you have in</SectionHeading>
        <p className="text-fade text-sm mb-3 leading-relaxed">
          Type what is actually there right now — commas or new lines. Nothing to
          maintain; this is just for this search.
        </p>
        <textarea
          value={have}
          onChange={(e) => persistHave(e.target.value)}
          rows={4}
          className="field mb-3"
          placeholder={"red lentils, spinach, greek yogurt\n2 onions\n400g canned tomatoes"}
          aria-label="What you have in the kitchen"
        />
        {haveCount > 0 && (
          <label className="flex items-center gap-2 text-sm text-bark">
            <input
              type="checkbox"
              checked={onlyWhatIHave}
              onChange={(e) => setOnlyWhatIHave(e.target.checked)}
            />
            Stick to these {haveCount} things
          </label>
        )}
      </div>

      <div className="card p-5 mb-8">
        <SectionHeading icon={<Fork />}>What you feel like</SectionHeading>
        <textarea
          value={ask}
          onChange={(e) => setAsk(e.target.value)}
          rows={2}
          className="field mb-4 mt-1"
          placeholder="something warming I can eat cold tomorrow"
          aria-label="What you feel like eating"
        />

        <div className="flex flex-wrap gap-2 mb-4">
          {INTENTS.map((intent) => (
            <button
              key={intent.id}
              className="chip"
              aria-pressed={intents.includes(intent.id)}
              onClick={() => toggleIntent(intent.id)}
            >
              {intent.label}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-5">
          <label className="block">
            <span className="block text-sm text-bark mb-1">Cuisine</span>
            <select
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              className="field"
            >
              <option value="">Anything</option>
              {COMMON_CUISINES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm text-bark mb-1">Built around</span>
            <input
              value={centerpiece}
              onChange={(e) => setCenterpiece(e.target.value)}
              className="field"
              placeholder="aubergine"
            />
          </label>
        </div>

        <button onClick={generate} className="btn btn-primary" disabled={loading}>
          <Whisk size={17} />
          {loading ? "Working on it" : "Suggest recipes"}
        </button>

        {loading && (
          <p className="text-fade text-sm mt-3 leading-relaxed">
            Three full recipes takes around half a minute on the free tier.
          </p>
        )}
        {error && <p className="text-brick text-sm mt-4 leading-relaxed">{error}</p>}
      </div>

      {results.length > 0 && (
        <div className="space-y-8">
          {results.map((recipe, i) => (
            <ResultCard key={`${recipe.title}-${i}`} recipe={recipe} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultCard({ recipe }: { recipe: Generated }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const asRecipe: Recipe = {
    ...recipe,
    id: "preview",
    userId: "preview",
    createdAt: new Date().toISOString(),
  };

  async function save() {
    setSaving(true);
    setError("");
    try {
      const { id } = await saveGenerated(recipe);
      setSaved(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  const missing = recipe.missingFromPantry ?? [];

  return (
    <div className="card p-5">
      <h3 className="display text-3xl mb-1">{recipe.title}</h3>
      <RecipeMeta recipe={asRecipe} />
      {recipe.description && (
        <p className="mt-3 leading-relaxed text-bark">{recipe.description}</p>
      )}

      <p className="text-sm mt-4">
        {missing.length === 0 ? (
          <span className="text-blue">You have everything for this.</span>
        ) : (
          <span className="text-bark">Still need: {missing.join(", ")}</span>
        )}
      </p>

      <div className="flex flex-wrap gap-2 mt-4">
        <button className="btn btn-quiet" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide recipe" : "See recipe"}
        </button>
        {saved ? (
          <Link href={`/recipe/${saved}`} className="btn btn-quiet">
            Saved — open it
          </Link>
        ) : (
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving" : "Save to library"}
          </button>
        )}
      </div>
      {error && <p className="text-brick text-sm mt-3">{error}</p>}

      {open && (
        <div className="mt-6 pt-5 border-t border-mist">
          <RecipeView recipe={asRecipe} />
        </div>
      )}
    </div>
  );
}
