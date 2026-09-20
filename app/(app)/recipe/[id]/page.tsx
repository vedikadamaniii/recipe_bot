import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRecipe } from "@/lib/db";
import { RecipeDetail } from "./recipe-detail";

export default async function RecipePage({ params }: PageProps<"/recipe/[id]">) {
  // Route params are async in Next.js 16.
  const { id } = await params;

  const supabase = await createClient();
  const recipe = await getRecipe(supabase, id);
  if (!recipe) notFound();

  return (
    <div>
      <Link href="/library" className="text-sm text-ink-faint hover:text-ink">
        Library
      </Link>
      <h1 className="display text-4xl mt-3 mb-2">{recipe.title}</h1>
      <p className="text-ink-soft text-sm mb-1">
        {recipe.cuisine}
        {recipe.totalTimeMin ? ` / ${recipe.totalTimeMin} min` : ""}
      </p>
      {recipe.sourceUrl && (
        <p className="text-sm mb-1">
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo underline"
          >
            Original source
          </a>
        </p>
      )}
      {recipe.description && (
        <p className="mt-3 mb-6 leading-relaxed text-ink-soft max-w-prose">
          {recipe.description}
        </p>
      )}

      <RecipeDetail recipe={recipe} />
    </div>
  );
}
