"use client";

import Link from "next/link";
import { useState } from "react";
import type { DraftRecipe, Recipe } from "@/lib/schema";
import { COMMON_CUISINES } from "@/lib/schema";
import { RecipeMeta, RecipeView } from "@/components/recipe-view";
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
  { id: "budget", label: "Budget" },
];

export function GenerateClient({
  pantryCount,
  hasProfile,
  allowed,
}: {
  pantryCount: number;
  hasProfile: boolean;
  allowed: boolean;
}) {
  const [ask, setAsk] = useState("");
  const [intents, setIntents] = useState<string[]>([]);
  const [cuisine, setCuisine] = useState("");
  const [centerpiece, setCenterpiece] = useState("");
  const [pantryOnly, setPantryOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Generated[]>([]);

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
          pantryOnly,
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

  return (
    <div>
      <h1 className="display text-4xl mb-2">What are you cooking?</h1>
      <p className="text-ink-soft mb-7 leading-relaxed">
        {pantryCount > 0
          ? `Suggestions use the ${pantryCount} ${pantryCount === 1 ? "item" : "items"} in your pantry.`
          : "Add things to your pantry and suggestions will be built around them."}
      </p>

      {!hasProfile && (
        <p className="text-sm mb-6 border-l-2 border-indigo pl-3 leading-relaxed">
          Your taste profile is empty, so these will be generic.{" "}
          <Link href="/settings" className="text-indigo underline">
            Add it
          </Link>{" "}
          and every suggestion changes.
        </p>
      )}

      <div className="rule-top pt-5 mb-8">
        <textarea
          value={ask}
          onChange={(e) => setAsk(e.target.value)}
          rows={2}
          className="field mb-4"
          placeholder="something warming I can eat cold tomorrow"
          aria-label="What you feel like"
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

        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <label className="block">
            <span className="block text-sm text-ink-soft mb-1">Cuisine</span>
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
            <span className="block text-sm text-ink-soft mb-1">
              Built around
            </span>
            <input
              value={centerpiece}
              onChange={(e) => setCenterpiece(e.target.value)}
              className="field"
              placeholder="aubergine"
            />
          </label>
        </div>

        {pantryCount > 0 && (
          <label className="flex items-center gap-2 mb-5 text-sm">
            <input
              type="checkbox"
              checked={pantryOnly}
              onChange={(e) => setPantryOnly(e.target.checked)}
            />
            Only what I already have
          </label>
        )}

        <button
          onClick={generate}
          className="btn btn-primary"
          disabled={loading || !allowed}
        >
          {loading ? "Thinking" : "Suggest recipes"}
        </button>

        {!allowed && (
          <p className="text-sm text-ink-soft mt-3 leading-relaxed">
            This is a personal instance — generation is limited to its owner. You
            can still browse the library.
          </p>
        )}

        {error && <p className="text-madder text-sm mt-4 leading-relaxed">{error}</p>}
      </div>

      {results.length > 0 && (
        <div>
          <h2 className="text-sm text-ink-soft mb-4">
            {results.length} suggestions
          </h2>
          <div className="space-y-10">
            {results.map((recipe, i) => (
              <ResultCard key={`${recipe.title}-${i}`} recipe={recipe} />
            ))}
          </div>
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

  // The view component works on a full Recipe; a generated one has no id yet.
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
    <div className="rule-top pt-5">
      <h3 className="display text-2xl mb-1">{recipe.title}</h3>
      <RecipeMeta recipe={asRecipe} />
      {recipe.description && (
        <p className="mt-3 leading-relaxed text-ink-soft">{recipe.description}</p>
      )}

      {/* The single most useful signal when deciding what to cook tonight. */}
      <p className="text-sm mt-3">
        {missing.length === 0 ? (
          <span className="text-indigo">You have everything.</span>
        ) : (
          <span className="text-ink-soft">
            Need to buy: {missing.join(", ")}
          </span>
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
      {error && <p className="text-madder text-sm mt-3">{error}</p>}

      {open && (
        <div className="mt-6">
          <RecipeView recipe={asRecipe} />
        </div>
      )}
    </div>
  );
}
