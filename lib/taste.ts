/**
 * Your taste, as code.
 *
 * This used to be an editable settings page. It lives here instead because it
 * changes rarely and is easier to version than to re-type — edit this file and
 * every suggestion changes.
 */

import type { TasteProfile } from "./schema";

/**
 * The long-form context: what you like, how you eat, what you reach for.
 *
 * ▸ REPLACE THIS with the summary from your ChatGPT thread. Everything below
 *   works without it, but this is the single biggest lever on output quality —
 *   it is the difference between a generic recipe site and your recipe bot.
 */
export const TASTE_SUMMARY = `
I cook mostly Indian and Mediterranean food on weeknights. I like bold, sour and
spiced flavours — tamarind, lime, amchoor, sumac, pickled and fermented things.
I would rather have one assertive flavour than five polite ones.

I batch cook on Sundays and eat leftovers cold or barely reheated, so dishes
need to hold up for several days without going soggy or dull.

Weeknight cooking is 30-40 minutes, one pan where possible. I do not enjoy
sweet savoury dishes.
`.trim();

/**
 * Hard dietary rules.
 *
 * These are not preferences. They are stated to the model as absolute
 * constraints, separately from the summary above, because a model asked to
 * "bear preferences in mind" will happily write its way past a rule buried in
 * a paragraph of prose.
 */
export const DIETARY_RULES: string[] = [
  "Never use beef or pork as an ingredient. This includes veal, lamb-and-beef mixes, bacon, ham, pancetta, chorizo, prosciutto and sausages made from either.",
  "The only seafood allowed is shrimp/prawns and salmon. Never use any other fish or shellfish as an ingredient — no cod, tuna, anchovy fillets, squid, mussels, crab or scallops.",
  "Derived flavourings and condiments ARE fine even when they come from the animals above: fish sauce, shrimp paste, oyster sauce, Worcestershire sauce, bonito-based dashi, lard and gelatine are all acceptable. The rule is about what goes in as an ingredient, not about trace sources in a bottle.",
  "Chicken, lamb, goat, eggs and dairy are all fine.",
];

/** Things that must never appear. Add allergies here. */
export const NEVER_INCLUDE: string[] = [];

/** Avoided unless explicitly asked for. */
export const PREFER_TO_AVOID: string[] = ["raw tomato"];

export const SPICE_LEVEL: TasteProfile["spiceLevel"] = "medium";

export const EQUIPMENT: string[] = [
  "gas hob",
  "oven",
  "blender",
  "food processor",
];

/** Assembled profile, used by the prompt builder. */
export const TASTE: TasteProfile = {
  userId: "owner",
  summary: TASTE_SUMMARY,
  allergies: NEVER_INCLUDE,
  dislikes: PREFER_TO_AVOID,
  spiceLevel: SPICE_LEVEL,
  equipment: EQUIPMENT,
};
