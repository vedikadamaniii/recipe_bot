import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listCuisines, listRecipes } from "@/lib/db";
import { Bowl } from "@/components/ornaments";

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
      <h1 className="display text-5xl mb-2">Library</h1>
      <p className="text-bark mb-6 leading-relaxed">
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
        <div className="card p-8 text-bark leading-relaxed text-center">
          <span className="inline-block text-mist mb-3"><Bowl size={44} /></span>
          <div className="max-w-sm mx-auto">
          {cuisine || search ? (
            <>Nothing matches that. Clear the filters to see everything.</>
          ) : (
            <>
              Saved recipes land here, grouped by cuisine.{" "}
              <Link href="/generate" className="text-blue underline">
                Ask for a suggestion
              </Link>{" "}
              or{" "}
              <Link href="/import" className="text-blue underline">
                add one you already have
              </Link>
              .
            </>
          )}
          </div>
        </div>
      ) : (
        <ul className="card divide-y divide-mist px-4">
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <Link href={`/recipe/${recipe.id}`} className="block py-3.5 group">
                <span className="group-hover:text-blue">{recipe.title}</span>
                {/* Everything measurable about the recipe sits on one line, so
                    no figure is left floating without a label. Ingredient
                    count is worth showing: it is the best quick read on how
                    much faff a recipe is. */}
                <span className="block text-sm text-fade mt-0.5">
                  {recipe.cuisine}
                  {recipe.totalTimeMin ? ` / ${recipe.totalTimeMin} min` : ""}
                  {` / serves ${recipe.baseServings}`}
                  {` / ${recipe.ingredients.length} ingredient${
                    recipe.ingredients.length === 1 ? "" : "s"
                  }`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
