import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-only client that bypasses row-level security.
 *
 * The service role key must never reach the browser. Every caller is
 * responsible for checking `isUnlocked()` first: this client is the thing
 * standing between a public URL and a writable database.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Writes are disabled without it.",
    );
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
