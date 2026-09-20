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

export {
  GENERATION_SCHEMA,
  SINGLE_RECIPE_SCHEMA,
  coerceRecipe,
  parseJsonResponse,
  type GeneratedRecipe,
} from "./gemini-schema";
