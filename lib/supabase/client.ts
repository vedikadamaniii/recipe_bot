"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for browser code.
 *
 * Safe to expose: the publishable/anon key is designed to ship to browsers, and
 * row-level security is what actually protects the data. See
 * supabase/migrations/0001_init.sql.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
