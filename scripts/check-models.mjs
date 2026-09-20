/**
 * Lists the Gemini models your API key can actually use.
 *
 * Free-tier model availability shifts (Pro left the free tier in April 2026),
 * and Google now shows per-key limits only in AI Studio. Rather than hardcode a
 * model id that may quietly stop working, run this and set GEMINI_MODEL to
 * something this prints.
 *
 *   npm run check:models
 */
import { readFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";

// Minimal .env.local reader so this works without extra dependencies.
for (const file of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // File is optional.
  }
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error(
    "GEMINI_API_KEY is not set.\n" +
      "Get a free key at https://aistudio.google.com/apikey, then:\n" +
      "  cp .env.example .env.local   and paste it in.",
  );
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

try {
  const models = [];
  for await (const model of await ai.models.list()) {
    models.push(model);
  }

  const usable = models
    .filter((m) => (m.supportedActions ?? []).includes("generateContent"))
    .map((m) => (m.name ?? "").replace(/^models\//, ""))
    .filter(Boolean)
    .sort();

  const flash = usable.filter((n) => n.includes("flash"));

  console.log(`\n${usable.length} models support generateContent with this key.\n`);
  console.log("Flash models (these are the free-tier family):");
  for (const name of flash) console.log(`  ${name}`);

  const current = process.env.GEMINI_MODEL?.trim() || "gemini-flash-latest";
  console.log(`\nGEMINI_MODEL is currently: ${current}`);
  console.log(
    usable.includes(current)
      ? "  -> available with this key.\n"
      : "  -> NOT in the list above. Set GEMINI_MODEL to one that is.\n",
  );
} catch (err) {
  console.error("\nCould not list models:", err?.message ?? err);
  console.error("Check that the key is valid and has the Generative Language API enabled.\n");
  process.exit(1);
}
