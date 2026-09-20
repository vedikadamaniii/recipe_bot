import { createClient, getUser } from "@/lib/supabase/server";
import { getTasteProfile } from "@/lib/db";
import { saveProfile } from "./actions";
import { SaveButton } from "@/app/(app)/save-button";

export default async function SettingsPage() {
  const user = await getUser();
  const supabase = await createClient();
  const profile = await getTasteProfile(supabase, user!.id);

  return (
    <div className="max-w-xl">
      <h1 className="display text-4xl mb-2">Your taste</h1>
      <p className="text-ink-soft mb-8 leading-relaxed">
        Everything here is sent with each request. The summary is background
        context; allergies and dislikes are enforced as hard rules.
      </p>

      <form action={saveProfile} className="space-y-7">
        <div>
          <label htmlFor="summary" className="block mb-1">
            How you cook
          </label>
          <p className="text-ink-faint text-sm mb-2 leading-relaxed">
            Paste the summary from your ChatGPT thread here — what you like, how
            you eat during the week, the flavours you reach for.
          </p>
          <textarea
            id="summary"
            name="summary"
            rows={12}
            defaultValue={profile.summary}
            className="field leading-relaxed"
            placeholder="I cook mostly Indian and Mediterranean food on weeknights…"
          />
        </div>

        <div className="rule-top pt-6">
          <label htmlFor="allergies" className="block mb-1">
            Never include
          </label>
          <p className="text-ink-faint text-sm mb-2 leading-relaxed">
            Allergies and hard no-gos. These are stated as absolute constraints,
            including hidden forms — fish sauce counts as fish.
          </p>
          <input
            id="allergies"
            name="allergies"
            defaultValue={profile.allergies.join(", ")}
            className="field"
            placeholder="peanuts, shellfish"
          />
        </div>

        <div>
          <label htmlFor="dislikes" className="block mb-1">
            Prefer to avoid
          </label>
          <p className="text-ink-faint text-sm mb-2 leading-relaxed">
            Avoided unless you ask for them directly.
          </p>
          <input
            id="dislikes"
            name="dislikes"
            defaultValue={profile.dislikes.join(", ")}
            className="field"
            placeholder="raw tomato, aniseed"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="spiceLevel" className="block mb-2">
              Spice level
            </label>
            <select
              id="spiceLevel"
              name="spiceLevel"
              defaultValue={profile.spiceLevel ?? ""}
              className="field"
            >
              <option value="">No preference</option>
              <option value="mild">Mild</option>
              <option value="medium">Medium</option>
              <option value="hot">Hot</option>
            </select>
          </div>
          <div>
            <label htmlFor="equipment" className="block mb-2">
              Equipment
            </label>
            <input
              id="equipment"
              name="equipment"
              defaultValue={profile.equipment.join(", ")}
              className="field"
              placeholder="gas hob, oven, blender"
            />
          </div>
        </div>

        <div className="rule-top pt-5">
          <SaveButton>Save taste profile</SaveButton>
        </div>
      </form>
    </div>
  );
}
