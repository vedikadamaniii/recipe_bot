import Link from "next/link";
import { isUnlocked } from "@/lib/access";
import { Knife } from "@/components/ornaments";
import { ImportClient } from "./import-client";

/**
 * Adding a recipe costs API quota, so it is owner-only. Visitors still see the
 * page rather than a hidden nav item: a feature nobody knows exists may as
 * well not have been built.
 */
export default async function ImportPage() {
  if (await isUnlocked()) return <ImportClient />;

  return (
    <div className="max-w-xl">
      <h1 className="display text-5xl mb-2">Add a recipe</h1>
      <p className="text-bark mb-7 leading-relaxed">
        Three ways in, all ending in the same structured form, so an imported
        recipe scales and converts exactly like a generated one.
      </p>

      <div className="card p-5 mb-6">
        <ul className="space-y-4">
          <li>
            <span className="block">Link</span>
            <span className="block text-sm text-bark leading-relaxed">
              Most recipe sites publish schema.org structured data for search
              engines. Reading that is exact and instant, and uses no AI at all.
              The model is the fallback for pages that do not have it.
            </span>
          </li>
          <li>
            <span className="block">Photos</span>
            <span className="block text-sm text-bark leading-relaxed">
              Several screenshots at once, read together as a single recipe.
              Ingredients on one, method on the next. Images are downscaled in
              the browser first so a set of phone screenshots still fits in one
              request.
            </span>
          </li>
          <li>
            <span className="block">Paste</span>
            <span className="block text-sm text-bark leading-relaxed">
              Any block of text, formatted into the same shape.
            </span>
          </li>
        </ul>
      </div>

      <div className="card p-5">
        <p className="flex gap-2 items-start text-sm leading-relaxed">
          <span className="text-turmeric shrink-0 mt-0.5">
            <Knife size={16} />
          </span>
          <span className="text-bark">
            Adding is limited to the owner, since every import spends API quota
            on a shared free tier.{" "}
            <Link href="/unlock" className="text-blue underline">
              Unlock
            </Link>{" "}
            if this is your instance. Everything in the library is open to read,
            scale and convert.
          </span>
        </p>
      </div>
    </div>
  );
}
