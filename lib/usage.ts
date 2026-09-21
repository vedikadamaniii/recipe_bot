import "server-only";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "@supabase/supabase-js";

/**
 * The shared daily generation budget for visitors.
 *
 * Counted in the database rather than in memory: serverless instances are
 * recycled constantly, so a module-level counter resets on every cold start
 * and would cap nothing at all.
 */

/** Today's count without incrementing. Safe to call with the public key. */
export async function usageToday(): Promise<number> {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data, error } = await sb.rpc("usage_today");
    if (error) return 0;
    return typeof data === "number" ? data : 0;
  } catch {
    return 0;
  }
}

/**
 * Claim one generation. Returns the new total.
 *
 * Incrementing in the database is what makes the cap hold under concurrent
 * requests; a read-then-write in the application would race.
 */
export async function claimGeneration(): Promise<number> {
  const sb = createAdminClient();
  const { data, error } = await sb.rpc("bump_usage");
  if (error) throw new Error(`Could not record usage: ${error.message}`);
  return typeof data === "number" ? data : 0;
}
