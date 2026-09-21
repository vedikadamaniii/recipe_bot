import { isUnlocked } from "@/lib/access";
import { lock, unlock } from "./actions";

export default async function UnlockPage({ searchParams }: PageProps<"/unlock">) {
  const params = await searchParams;
  const wrong = "wrong" in params;
  const already = await isUnlocked();

  if (already) {
    return (
      <div className="max-w-sm">
        <h1 className="display text-4xl mb-3">Unlocked</h1>
        <p className="text-bark leading-relaxed mb-6">
          This device can generate, import and save.
        </p>
        <form action={lock}>
          <button className="btn btn-quiet">Lock this device</button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-sm">
      <h1 className="display text-4xl mb-3">Unlock</h1>
      <p className="text-bark leading-relaxed mb-6">
        Generating, importing and saving are limited to the owner. Everything
        else is open to read.
      </p>
      <form action={unlock}>
        <label htmlFor="password" className="block text-sm text-bark mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="field mb-4"
          required
        />
        <button type="submit" className="btn btn-primary">
          Unlock
        </button>
        {wrong && (
          <p className="text-brick text-sm mt-4">That password is not right.</p>
        )}
      </form>
    </div>
  );
}
