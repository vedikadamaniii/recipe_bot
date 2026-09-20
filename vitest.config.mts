import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Load .env.local so integration tests can reach the real APIs. Unit tests do
// not need it; they stay offline.
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  // Optional — CI and fresh clones run the offline suite only.
}

export default defineConfig({
  resolve: {
    alias: {
      // `server-only` throws on import outside a React Server Component, which
      // is exactly what we want in the app and exactly what breaks tests.
      // Stub it here so the production guard on lib/gemini.ts stays real.
      "server-only": new URL("./test/stubs/server-only.ts", import.meta.url).pathname,
    },
  },
  test: {
    // Integration tests hit a rate-limited free tier; keep them patient.
    testTimeout: 90_000,
    hookTimeout: 90_000,
  },
});
