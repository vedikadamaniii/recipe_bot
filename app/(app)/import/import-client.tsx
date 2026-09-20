"use client";

import Link from "next/link";
import { useState } from "react";
import type { DraftRecipe, Recipe } from "@/lib/schema";
import { COMMON_CUISINES } from "@/lib/schema";
import { RecipeView } from "@/components/recipe-view";
import { saveGenerated } from "@/app/(app)/generate/actions";

type Mode = "url" | "image" | "text";

const MODES: { id: Mode; label: string; blurb: string }[] = [
  {
    id: "url",
    label: "Link",
    blurb:
      "Most recipe sites publish structured data. When they do, this is exact and instant.",
  },
  {
    id: "image",
    label: "Photo",
    blurb: "A screenshot, a cookbook page, or a handwritten card.",
  },
  { id: "text", label: "Paste", blurb: "Paste the text and it gets formatted." },
];

export function ImportClient() {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<DraftRecipe | null>(null);

  function pickImage(file: File | undefined) {
    if (!file) return;
    setImageName(file.name);
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function runImport() {
    setLoading(true);
    setError("");
    setDraft(null);
    try {
      const payload =
        mode === "url" ? { type: "url", url } :
        mode === "text" ? { type: "text", text } :
        { type: "image", image };

      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      setDraft(data.recipe);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setLoading(false);
    }
  }

  const ready =
    (mode === "url" && url.trim().length > 4) ||
    (mode === "text" && text.trim().length > 20) ||
    (mode === "image" && !!image);

  if (draft) {
    return <ReviewDraft draft={draft} onBack={() => setDraft(null)} />;
  }

  return (
    <div className="max-w-xl">
      <h1 className="display text-4xl mb-2">Add a recipe</h1>
      <p className="text-ink-soft mb-7 leading-relaxed">
        However it reaches you, it ends up in the same structured form — so it
        scales and converts like everything else.
      </p>

      <div className="flex gap-2 mb-5">
        {MODES.map((m) => (
          <button
            key={m.id}
            className="chip"
            aria-pressed={mode === m.id}
            onClick={() => {
              setMode(m.id);
              setError("");
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="rule-top pt-5">
        <p className="text-sm text-ink-soft mb-4 leading-relaxed">
          {MODES.find((m) => m.id === mode)!.blurb}
        </p>

        {mode === "url" && (
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="field mb-4"
            placeholder="https://…"
            aria-label="Recipe URL"
            inputMode="url"
          />
        )}

        {mode === "text" && (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            className="field mb-4"
            placeholder="Paste the recipe here"
            aria-label="Recipe text"
          />
        )}

        {mode === "image" && (
          <div className="mb-4">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => pickImage(e.target.files?.[0])}
              className="field"
              aria-label="Recipe image"
            />
            {imageName && (
              <p className="text-sm text-ink-soft mt-2">Selected: {imageName}</p>
            )}
          </div>
        )}

        <button
          onClick={runImport}
          className="btn btn-primary"
          disabled={loading || !ready}
        >
          {loading ? "Reading" : "Read recipe"}
        </button>

        {error && <p className="text-madder text-sm mt-4 leading-relaxed">{error}</p>}
      </div>
    </div>
  );
}

/**
 * Review before saving.
 *
 * Parsing a blurry screenshot occasionally misreads "1/2" as "12", and a
 * library full of silently wrong quantities is worse than no library — so
 * nothing is saved until it has been looked at.
 */
function ReviewDraft({ draft, onBack }: { draft: DraftRecipe; onBack: () => void }) {
  const [title, setTitle] = useState(draft.title);
  const [cuisine, setCuisine] = useState(draft.cuisine);
  const [servings, setServings] = useState(draft.baseServings);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const preview: Recipe = {
    ...draft,
    title,
    cuisine,
    baseServings: servings,
    id: "preview",
    userId: "preview",
    createdAt: new Date().toISOString(),
  };

  async function save() {
    setSaving(true);
    setError("");
    try {
      const { id } = await saveGenerated({
        ...draft,
        title,
        cuisine,
        baseServings: servings,
      });
      setSavedId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  if (savedId) {
    return (
      <div className="max-w-xl">
        <h1 className="display text-3xl mb-3">Saved</h1>
        <p className="text-ink-soft mb-6">{title} is in your library.</p>
        <div className="flex gap-2">
          <Link href={`/recipe/${savedId}`} className="btn btn-primary">
            Open it
          </Link>
          <Link href="/import" className="btn btn-quiet">
            Add another
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button onClick={onBack} className="text-sm text-ink-faint hover:text-ink mb-3">
        Back
      </button>
      <h1 className="display text-3xl mb-2">Check this before saving</h1>
      <p className="text-ink-soft mb-6 leading-relaxed max-w-prose">
        Quantities are read from the original. Scan them — a misread fraction is
        the one mistake worth catching now rather than mid-cook.
      </p>

      <div className="grid sm:grid-cols-3 gap-3 mb-7">
        <label className="block sm:col-span-2">
          <span className="block text-sm text-ink-soft mb-1">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="block text-sm text-ink-soft mb-1">Serves</span>
          <input
            type="number"
            min={1}
            max={50}
            value={servings}
            onChange={(e) => setServings(Math.max(1, Number(e.target.value) || 1))}
            className="field qty"
          />
        </label>
        <label className="block sm:col-span-3">
          <span className="block text-sm text-ink-soft mb-1">Cuisine</span>
          <select
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
            className="field"
          >
            {[cuisine, ...COMMON_CUISINES.filter((c) => c !== cuisine)].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <RecipeView recipe={preview} />

      <div className="rule-top mt-8 pt-5 flex gap-2">
        <button onClick={save} className="btn btn-primary" disabled={saving}>
          {saving ? "Saving" : "Save to library"}
        </button>
        <button onClick={onBack} className="btn btn-quiet">
          Discard
        </button>
      </div>
      {error && <p className="text-madder text-sm mt-3">{error}</p>}
    </div>
  );
}
