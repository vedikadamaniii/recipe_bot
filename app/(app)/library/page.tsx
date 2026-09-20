import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listCuisines, listRecipes } from "@/lib/db";

export default async function LibraryPage({ searchParams }: PageProps<"/library">) {
  // Request APIs are async in Next.js 16.
  const params = await searchParams;
  const cuisine = typeof params.cuisine === "string" ? params.cuisine : null;
  const search = typeof params.q === "string" ? params.q : null;

  const supabase = await createClient();
  const [recipes, cuisines] = await Promise.all([
    listRecipes(supabase, { cuisine, search }),
    listCuisines(supabase),
  ]);

  return (
    <div>
      <h1 className="display text-4xl mb-2">Library</h1>
      <p className="text-ink-soft mb-6 leading-relaxed">
        {recipes.length === 0 && !cuisine && !search
          ? "Nothing saved yet."
          : `${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"}`}
      </p>

      <form className="mb-5">
        <label htmlFor="q" className="sr-only">
          Search recipes
        </label>
        <input
          id="q"
          name="q"
          defaultValue={search ?? ""}
          className="field"
          placeholder="Search by name"
        />
        {cuisine && <input type="hidden" name="cuisine" value={cuisine} />}
      </form>

      {cuisines.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-7">
          <Link href={search ? `/library?q=${encodeURIComponent(search)}` : "/library"}>
            <span className="chip inline-block" aria-pressed={!cuisine}>
              All
            </span>
          </Link>
          {cuisines.map((c) => {
            const query = new URLSearchParams();
            query.set("cuisine", c);
            if (search) query.set("q", search);
            return (
              <Link key={c} href={`/library?${query}`}>
                <span className="chip inline-block" aria-pressed={cuisine === c}>
                  {c}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {recipes.length === 0 ? (
        <div className="rule-top pt-6 text-ink-soft leading-relaxed">
          {cuisine || search ? (
            <>Nothing matches that. Clear the filters to see everything.</>
          ) : (
            <>
              Saved recipes land here, grouped by cuisine.{" "}
              <Link href="/generate" className="text-indigo underline">
                Ask for a suggestion
              </Link>{" "}
              or{" "}
              <Link href="/import" className="text-indigo underline">
                add one you already have
              </Link>
              .
            </>
          )}
        </div>
      ) : (
        <ul className="rule-top">
          {recipes.map((recipe) => (
            <li key={recipe.id} className="border-b border-rule">
              <Link
                href={`/recipe/${recipe.id}`}
                className="flex items-baseline gap-4 py-3.5 group"
              >
                <span className="flex-1">
                  <span className="group-hover:text-indigo">{recipe.title}</span>
                  <span className="block text-sm text-ink-faint mt-0.5">
                    {recipe.cuisine}
                    {recipe.totalTimeMin ? ` / ${recipe.totalTimeMin} min` : ""}
                    {` / serves ${recipe.baseServings}`}
                  </span>
                </span>
                <span className="qty text-sm text-ink-faint shrink-0">
                  {recipe.ingredients.length}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
