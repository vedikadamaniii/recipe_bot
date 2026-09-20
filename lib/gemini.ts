/**
 * Gemini client and the structured-output contract.
 *
 * Everything here runs server-side only — the API key must never reach the
 * browser. The response schema below is what forces the model to return data
 * our deterministic scaling and unit code can actually work with, instead of
 * prose we would have to re-parse.
 */

import "server-only";
import { GoogleGenAI } from "@google/genai";
import { parseJsonResponse } from "./gemini-schema";

/**
 * A moving alias that always points at the current free-tier Flash model.
 * Pinning a version number means the app breaks when that version leaves the
 * free tier; the alias does not. Override with GEMINI_MODEL if you want a
 * specific one — `npm run check:models` lists what your key can actually use.
 */
export const DEFAULT_MODEL = "gemini-flash-latest";

export function getModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

let client: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Copy .env.example to .env.local and add a key " +
        "from https://aistudio.google.com/apikey",
    );
  }
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

/**
 * Models to fall back to when the configured one is unavailable.
 *
 * Free-tier capacity is not uniform across models: `gemini-flash-latest` was
 * observed returning 503 for every large request while `gemini-3.5-flash`
 * served the identical prompt in 25s. Retrying the same model harder does not
 * help in that situation; moving to another one does.
 */
const FALLBACK_MODELS = ["gemini-3.5-flash", "gemini-3-flash-preview", "gemini-flash-latest"];

/** The configured model first, then any fallbacks not already tried. */
export function modelChain(): string[] {
  const primary = getModel();
  return [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];
}

/** Transient API failures worth retrying: capacity and rate limiting. */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

function statusOf(err: unknown): number | null {
  const message = err instanceof Error ? err.message : String(err);
  const m = message.match(/"code":\s*(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

export class GeminiUnavailableError extends Error {}

/**
 * Call Gemini with structured output, retrying transient failures.
 *
 * The free tier returns 503 "high demand" often enough that a single attempt
 * is not good enough for a user-facing request — one was observed within
 * minutes of first use. Backoff is exponential with jitter so a burst of
 * retries does not arrive in lockstep.
 */
export async function generateJson(options: {
  prompt: string | unknown[];
  systemInstruction: string;
  schema: unknown;
  /** Attempts per model before moving to the next one in the chain. */
  attempts?: number;
}): Promise<unknown> {
  const ai = getGemini();
  const attempts = options.attempts ?? 2;
  let lastError: unknown;

  for (const model of modelChain()) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: options.prompt as never,
          config: {
            systemInstruction: options.systemInstruction,
            responseMimeType: "application/json",
            responseSchema: options.schema as never,
          },
        });
        return parseJsonResponse(response.text);
      } catch (err) {
        lastError = err;
        const status = statusOf(err);
        // A 404 means this key cannot use this model at all — some models are
        // listed but not callable. Move straight on rather than retrying.
        if (status === 404) break;
        if (status === null || !RETRYABLE.has(status)) throw err;
        if (attempt < attempts - 1) {
          const backoff = 400 * 2 ** attempt + Math.random() * 300;
          await new Promise((resolve) => setTimeout(resolve, backoff));
        }
      }
    }
  }

  const status = statusOf(lastError);
  if (status !== null && (RETRYABLE.has(status) || status === 404)) {
    throw new GeminiUnavailableError(
      "Gemini is busy on every available model right now. This is usually brief " +
        "on the free tier — try again in a moment.",
    );
  }
  throw lastError;
}

export {
  GENERATION_SCHEMA,
  SINGLE_RECIPE_SCHEMA,
  coerceRecipe,
  parseJsonResponse,
  type GeneratedRecipe,
} from "./gemini-schema";
