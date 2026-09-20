import { createClient } from "@/lib/supabase/server";
import { listPantry } from "@/lib/db";
import { formatAmount } from "@/lib/units";
import { SaveButton } from "@/app/(app)/save-button";
import { addItems, removeItem } from "./actions";

export default async function PantryPage() {
  const supabase = await createClient();
  const items = await listPantry(supabase);

  return (
    <div className="max-w-xl">
      <h1 className="display text-4xl mb-2">Pantry</h1>
      <p className="text-ink-soft mb-7 leading-relaxed">
        What you have right now. Recipes are suggested around it.
      </p>

      <form action={addItems} className="mb-9">
        <label htmlFor="items" className="block mb-2 text-sm text-ink-soft">
          Add items — one per line, or separated by commas
        </label>
        <textarea
          id="items"
          name="items"
          rows={3}
          className="field mb-3"
          placeholder={"red lentils\n2 onions\n400g canned tomatoes"}
        />
        <SaveButton>Add to pantry</SaveButton>
      </form>

      {items.length === 0 ? (
        <div className="rule-top pt-6 text-ink-soft leading-relaxed">
          Nothing in your pantry yet. Add a few staples above and the Cook page
          will start suggesting things you can actually make tonight.
        </div>
      ) : (
        <div className="rule-top">
          <div className="flex items-baseline justify-between py-3 text-sm text-ink-faint">
            <span>
              <span className="qty text-ink">{items.length}</span>{" "}
              {items.length === 1 ? "item" : "items"}
            </span>
          </div>
          <ul>
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-baseline gap-3 py-2.5 border-t border-rule"
              >
                <span className="qty w-24 shrink-0 text-right tabular-nums">
                  {formatAmount(item.qty ?? null, item.unit ?? null)}
                </span>
                <span className="flex-1">{item.name}</span>
                <form action={removeItem}>
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    type="submit"
                    className="text-sm text-ink-faint hover:text-madder"
                    aria-label={`Remove ${item.name}`}
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
