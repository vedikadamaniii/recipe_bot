import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 *
 * Note `await cookies()` — request APIs are fully async in Next.js 16, and the
 * synchronous form was removed.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies cannot be written.
            // The proxy refreshes the session instead, so this is safe to skip.
          }
        },
      },
    },
  );
}

/**
 * The signed-in user, or null.
 *
 * Always use this rather than `getSession()` on the server: getUser revalidates
 * the token with Supabase, whereas a session read trusts a cookie the browser
 * could have tampered with.
 */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** True when this user is allowed to spend Gemini quota. */
export function canGenerate(email: string | undefined | null): boolean {
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  // An empty allowlist means "nobody", not "everybody" — this app is public.
  if (allowed.length === 0) return false;
  return !!email && allowed.includes(email.toLowerCase());
}
