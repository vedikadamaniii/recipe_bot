"use client";

import { useState } from "react";
import type { Recipe } from "@/lib/schema";
import { RecipeView } from "@/components/recipe-view";
import { readHave } from "@/lib/have";

type Swap = { name: string; amount: string; effect: string; caveat?: string | null };

export function RecipeDetail({ recipe }: { recipe: Recipe }) {
  const [target, setTarget] = useState<string | null>(null);
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function askSubstitute(ingredient: string) {
    setTarget(ingredient);
    setSwaps([]);
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/substitute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredient, recipeTitle: recipe.title, have: readHave() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not find substitutions.");
      setSwaps(data.substitutions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find substitutions.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <RecipeView recipe={recipe} onAskSubstitute={askSubstitute} />

      {target && (
        <aside className="card p-5 mt-9">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg">
              Instead of <span className="qty">{target}</span>
            </h2>
            <button
              onClick={() => setTarget(null)}
              className="text-sm text-fade hover:text-cocoa"
            >
              Close
            </button>
          </div>

          {loading && <p className="text-bark text-sm">Looking at what you have…</p>}
          {error && <p className="text-turmeric text-sm leading-relaxed">{error}</p>}

          {swaps.map((swap, i) => (
            <div key={i} className="py-3 border-t border-mist">
              <p>
                <span className="qty">{swap.amount}</span> {swap.name}
              </p>
              <p className="text-sm text-bark mt-1 leading-relaxed">{swap.effect}</p>
              {swap.caveat && (
                <p className="text-sm text-turmeric mt-1 leading-relaxed">{swap.caveat}</p>
              )}
            </div>
          ))}
        </aside>
      )}
    </>
  );
}
