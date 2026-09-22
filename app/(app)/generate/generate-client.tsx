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

export function GenerateClient({
  unlocked,
  liveRemaining,
}: {
  unlocked: boolean;
  liveRemaining: number;
}) {
  const [have, setHave] = useState("");
  const [ask, setAsk] = useState("");
  const [intents, setIntents] = useState<string[]>([]);
  const [cuisine, setCuisine] = useState("");
  const [centerpiece, setCenterpiece] = useState("");
  const [onlyWhatIHave, setOnlyWhatIHave] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Generated[]>([]);
  const [isSavedExample, setIsSavedExample] = useState(false);

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
      setIsSavedExample(Boolean(data.saved));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }

  const haveCount = toList(have).length;

  return (
    <div>
      <h1 className="display text-5xl mb-8">What are you cooking?</h1>

      <div className="card p-5 mb-6">
        <SectionHeading icon={<Citrus />}>Fridge and pantry</SectionHeading>
        <textarea
          value={have}
          onChange={(e) => persistHave(e.target.value)}
          rows={4}
          className="field mb-3"
          placeholder={"red lentils, spinach, greek yogurt\n2 onions\n400g canned tomatoes"}
          aria-label="What is in your fridge and pantry"
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

        {!unlocked && !loading && (
          <p className="text-fade text-sm mt-3 leading-relaxed">
            {liveRemaining > 0
              ? `${liveRemaining} live generations left today. After that you get a saved example.`
              : "Today's live generations are used up. You will get a saved example."}
          </p>
        )}
        {error && <p className="text-brick text-sm mt-4 leading-relaxed">{error}</p>}
      </div>

      {isSavedExample && results.length > 0 && (
        <p className="text-sm mb-5 border-l-2 border-turmeric pl-3 leading-relaxed text-bark">
          This is a saved example from a real generation, not a fresh one.
          The daily live allowance is spent, so the recipes below will not match
          what you typed. Everything else on the site still works as normal.
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-8">
          {results.map((recipe, i) => (
            <ResultCard key={`${recipe.title}-${i}`} recipe={recipe} canSave={unlocked} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultCard({ recipe, canSave }: { recipe: Generated; canSave: boolean }) {
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
          <span className="text-sage">You have everything for this.</span>
        ) : (
          <span className="text-bark">Still need: {missing.join(", ")}</span>
        )}
      </p>

      <div className="flex flex-wrap gap-2 mt-4">
        <button className="btn btn-quiet" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide recipe" : "See recipe"}
        </button>
        {!canSave ? null : saved ? (
          <Link href={`/recipe/${saved}`} className="btn btn-quiet">
            Saved. Open it
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
