"use client";

import Link from "next/link";
import { useState } from "react";
import type { DraftRecipe, Recipe } from "@/lib/schema";
import { COMMON_CUISINES } from "@/lib/schema";
import { RecipeView } from "@/components/recipe-view";
import { Knife } from "@/components/ornaments";
import { approximateBytes, prepareImages } from "@/lib/images";
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
    label: "Photos",
    blurb:
      "Screenshots, a cookbook page, or a handwritten card. Add as many as the " +
      "recipe takes and they are read together as one, so keep them in order.",
  },
  { id: "text", label: "Paste", blurb: "Paste the text and it gets formatted." },
];

export function ImportClient() {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [shots, setShots] = useState<{ name: string; dataUrl: string }[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<DraftRecipe | null>(null);

  async function pickImages(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    setPreparing(true);
    setError("");
    try {
      const prepared = await prepareImages(files);
      setShots((prev) => [
        ...prev,
        ...prepared.map((dataUrl, i) => ({ name: files[i].name, dataUrl })),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read those images.");
    } finally {
      setPreparing(false);
    }
  }

  function removeShot(index: number) {
    setShots((prev) => prev.filter((_, i) => i !== index));
  }

  /** Order matters: ingredients usually come before the method. */
  function moveShot(index: number, delta: number) {
    setShots((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function runImport() {
    setLoading(true);
    setError("");
    setDraft(null);
    try {
      const payload =
        mode === "url" ? { type: "url", url } :
        mode === "text" ? { type: "text", text } :
        { type: "image", images: shots.map((s) => s.dataUrl) };

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
    (mode === "image" && shots.length > 0);

  /**
   * Clear the whole form.
   *
   * "Add another" used to be a link to /import, the page it was already on,
   * so React kept the component mounted with its "Saved" state and clicking
   * it did nothing at all.
   */
  function startOver() {
    setDraft(null);
    setUrl("");
    setText("");
    setShots([]);
    setError("");
  }

  if (draft) {
    return (
      <ReviewDraft draft={draft} onBack={() => setDraft(null)} onStartOver={startOver} />
    );
  }

  return (
    <div className="max-w-xl">
      <h1 className="display text-5xl mb-7">Add a recipe</h1>

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

      <div className="card p-5">
        <p className="text-sm text-bark mb-4 leading-relaxed">
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
              multiple
              onChange={(e) => {
                void pickImages(e.target.files);
                e.target.value = "";
              }}
              className="field"
              aria-label="Recipe photos"
            />
            {preparing && (
              <p className="text-sm text-bark mt-2">Preparing images</p>
            )}

            {shots.length > 0 && (
              <>
                {shots.length > 1 && (
                  <p className="text-sm text-bark mt-4 mb-2">
                    Read in this order. The first should be where the recipe starts.
                  </p>
                )}
              <ul className="mt-2 space-y-2">
                {shots.map((shot, i) => (
                  <li
                    key={`${shot.name}-${i}`}
                    className="flex items-center gap-3 border border-mist rounded-lg p-2 bg-white"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shot.dataUrl}
                      alt=""
                      className="w-11 h-14 object-cover object-top rounded border border-mist"
                    />
                    <span
                      className="qty shrink-0 w-6 h-6 rounded-full bg-cocoa text-cream text-xs grid place-items-center"
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm truncate">{shot.name}</span>
                      <span className="block text-fade text-xs">
                        {Math.round(approximateBytes(shot.dataUrl) / 1024)} KB
                      </span>
                    </span>
                    <span className="flex gap-1 shrink-0">
                      <button
                        onClick={() => moveShot(i, -1)}
                        disabled={i === 0}
                        className="w-7 h-7 rounded border border-mist text-cocoa hover:border-bark disabled:opacity-25 disabled:hover:border-mist"
                        title="Read this one earlier"
                        aria-label={`Move ${shot.name} earlier`}
                      >
                        <span aria-hidden>{"\u2191"}</span>
                      </button>
                      <button
                        onClick={() => moveShot(i, 1)}
                        disabled={i === shots.length - 1}
                        className="w-7 h-7 rounded border border-mist text-cocoa hover:border-bark disabled:opacity-25 disabled:hover:border-mist"
                        title="Read this one later"
                        aria-label={`Move ${shot.name} later`}
                      >
                        <span aria-hidden>{"\u2193"}</span>
                      </button>
                      <button
                        onClick={() => removeShot(i)}
                        className="w-7 h-7 rounded border border-mist text-fade hover:text-brick hover:border-brick"
                        title="Remove this image"
                        aria-label={`Remove ${shot.name}`}
                      >
                        <span aria-hidden>{"\u00d7"}</span>
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              </>
            )}
          </div>
        )}

        <button
          onClick={runImport}
          className="btn btn-primary"
          disabled={loading || !ready}
        >
          <Knife size={17} />
          {loading ? "Reading" : shots.length > 1 && mode === "image" ? `Read ${shots.length} images` : "Read recipe"}
        </button>

        {error && (
          <div className="mt-4">
            <p className="text-brick text-sm leading-relaxed">{error}</p>
            {mode === "url" && (
              <div className="flex gap-2 mt-3">
                <button className="btn btn-quiet" onClick={() => { setMode("text"); setError(""); }}>
                  Paste it instead
                </button>
                <button className="btn btn-quiet" onClick={() => { setMode("image"); setError(""); }}>
                  Use a photo
                </button>
              </div>
            )}
          </div>
        )}
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
function ReviewDraft({
  draft,
  onBack,
  onStartOver,
}: {
  draft: DraftRecipe;
  onBack: () => void;
  onStartOver: () => void;
}) {
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
        <h1 className="display text-4xl mb-3">Saved</h1>
        <p className="text-bark mb-6">{title} is in your library.</p>
        <div className="flex gap-2">
          <Link href={`/recipe/${savedId}`} className="btn btn-primary">
            Open it
          </Link>
          <button onClick={onStartOver} className="btn btn-quiet">
            Add another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button onClick={onBack} className="text-sm text-fade hover:text-ink mb-3">
        Back
      </button>
      <h1 className="display text-4xl mb-2">Check this before saving</h1>
      <p className="text-bark mb-6 leading-relaxed max-w-prose">
        Quantities are read from the original. Scan them: a misread fraction is
        the one mistake worth catching now rather than mid-cook.
      </p>

      <div className="grid sm:grid-cols-3 gap-3 mb-7">
        <label className="block sm:col-span-2">
          <span className="block text-sm text-bark mb-1">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="block text-sm text-bark mb-1">Serves</span>
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
          <span className="block text-sm text-bark mb-1">Cuisine</span>
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

      <div className="mt-8 pt-5 border-t border-mist flex gap-2">
        <button onClick={save} className="btn btn-primary" disabled={saving}>
          {saving ? "Saving" : "Save to library"}
        </button>
        <button onClick={onBack} className="btn btn-quiet">
          Discard
        </button>
      </div>
      {error && <p className="text-brick text-sm mt-3">{error}</p>}
    </div>
  );
}
