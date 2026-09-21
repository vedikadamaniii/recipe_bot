/**
 * What is in the kitchen right now.
 *
 * Deliberately not in the database. It changes daily, so maintaining it as
 * stored state was more work than retyping it. It lives in the browser purely
 * so the box is not empty next time, and so substitutions on a saved recipe
 * can still know roughly what you have.
 */

export const HAVE_STORAGE_KEY = "recipe-bot:have";

export function readHave(): string[] {
  try {
    const raw = localStorage.getItem(HAVE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
