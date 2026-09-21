/**
 * Your taste, as code.
 *
 * Condensed from the long profile you had built up in ChatGPT. Three kinds of
 * thing came out of that document, and they are deliberately kept apart:
 *
 *   1. Taste and technique — the prose below. Irreplaceable, and the reason
 *      suggestions sound like you rather than like a recipe site.
 *   2. Facts — dislikes, equipment, staples. These are structured fields, so
 *      they are stated as rules instead of hoping the model notices a line in
 *      the middle of a paragraph.
 *   3. Instructions to ChatGPT about formatting and conversation — dropped.
 *      This app enforces the format through a response schema, does the
 *      scaling arithmetic itself, and is not a chat, so that material was
 *      taking up room without changing anything.
 *
 * Edit this file and every suggestion changes.
 */

import type { TasteProfile } from "./schema";

export const TASTE_SUMMARY = `
Food should taste like someone seasoned it on purpose. Build flavour in layers:
aromatics, then spices bloomed in fat, then something savoury and deep, then
acid, then heat, then a fresh finish. Do not just combine ingredients and call
it a recipe — roast or brown the garlic and mushrooms properly, crisp the tofu
instead of leaving it watery, finish curries and soups with lime or lemon, and
season vegetables rather than leaving them plain. When I say I want something
to taste good I mean assertive seasoning, real salt, umami, acidity, heat and
texture, and sauces that are not watered down.

I cook Indian, Indo-Chinese, Thai, Korean-leaning, Mexican-leaning and Italian
food. Dal, masala khichdi, pav bhaji, Manchurian, pad kra pao, gochujang
noodles, dumpling soup, fried rice, pesto pasta, stuffed shells, roasted
potatoes. Rotate between these rather than making everything Asian — especially
tofu, which does not have to mean a stir-fry.

Vegetables should feel integrated — roasted, browned, blended into a sauce,
folded into fried rice or curry — not a pile of plain veg next to a protein.
Frozen vegetables are genuinely fine; give instructions that suit them.

Proteins: chicken breast and ground chicken (brown it before liquid goes in),
tofu (extra-firm, pressed, crisped, and seasoned itself rather than relying on
sauce), paneer, cottage cheese, shrimp (often only five or six, added at the
very end), salmon (season it hard — mustard, spice, marinade, acid — so it does
not taste aggressively of salmon).

I eat calorie-consciously but never at the cost of flavour. Cut calories
through cooking method, portioning and balance, not by making food bland. Rice,
bread, pasta, potatoes and tortillas are all fine in sensible portions. Do not
moralise about food or label it good or bad, and do not bring up calories
unless I ask.

Do not reach for cream by default, and lighter swaps like cottage cheese,
yogurt or milk are welcome when they genuinely work — but if I ask for
something rich, indulgent or comforting, make it properly rich rather than
quietly handing me a lightened version. Say honestly when a substitute will
not taste like the real thing. Beans and lentils are good food and dal is a
staple; I just do not want a large bowl of beans to be the whole of dinner.

Most of what I cook is meal prep, usually three servings, eaten over three or
four days. It has to still have decent texture after reheating, and it should
not require five separate components when one dish would do. Say when something
is better made fresh.

Breakfast is two slices of sourdough, cottage cheese and a seed mix. Savoury,
fast, before work. Roasted tomatoes, mushrooms, herbs or chilli crisp on top
are welcome. Never suggest eggs unless I ask for them.

The test for any suggestion: would I actually be excited to eat this, and would
I still want the leftovers on day three?
`.trim();

/**
 * Hard dietary rules.
 *
 * Stated to the model as absolute constraints, separately from the prose above,
 * because a model asked to "bear preferences in mind" will write its way past a
 * rule buried in a paragraph.
 */
export const DIETARY_RULES: string[] = [
  "Never use beef or pork as an ingredient. This includes veal, bacon, ham, pancetta, guanciale, chorizo, prosciutto and sausages made from either.",
  "The only seafood allowed is shrimp/prawns and salmon. Never use any other fish or shellfish as an ingredient — no cod, tuna, anchovy fillets, squid, mussels, crab or scallops.",
  "Derived flavourings and condiments ARE fine even when they come from the animals above: fish sauce, shrimp paste, oyster sauce, Worcestershire sauce, bonito dashi, lard and gelatine are all acceptable. The rule is about what goes in as an ingredient, not trace sources in a bottle.",
  "Chicken, lamb, goat, eggs, dairy, tofu and paneer are all fine.",
];

/** Allergies. Nothing stated — add here if that changes. */
export const NEVER_INCLUDE: string[] = [];

/**
 * Genuinely not used. Softer tendencies — not defaulting to cream, not making
 * a dinner entirely of beans — live in the prose above instead, because
 * anything listed here gets treated as close to a ban.
 */
export const PREFER_TO_AVOID: string[] = [
  "zucchini",
  "corn",
  "stuffed vegetables",
  "eggs at breakfast",
];

/** Spicy food is a stated preference, not a tolerance. */
export const SPICE_LEVEL: TasteProfile["spiceLevel"] = "hot";

export const EQUIPMENT: string[] = [
  "air fryer (preferred for potatoes, fries, kebabs, tofu)",
  "Instant Pot (preferred for rice, dal, khichdi, pav bhaji)",
  "oven (preferred for salmon and roasted vegetables)",
  "stove",
  "grill pan",
  "immersion blender (preferred for soups and sauces)",
];

/** Reach for these first. */
export const FAVOURITES: string[] = [
  "broccoli", "green beans (frozen fine)", "mushrooms", "onions",
  "tomatoes and cherry tomatoes", "carrots", "spinach", "cabbage",
  "edamame", "tofu", "cottage cheese", "paneer", "chicken", "ground chicken",
  "shrimp", "salmon", "potatoes", "rice", "pasta", "roti, tortillas, naan",
  "dumplings", "noodles",
];

/** Usually in the cupboard, so a recipe may assume them. */
export const PANTRY_STAPLES: string[] = [
  "soy sauce", "oyster sauce", "gochujang", "chilli sauces", "Thai chillies",
  "ginger", "garlic or ginger-garlic paste", "tomato paste", "crushed tomatoes",
  "chicken bouillon", "yogurt", "cottage cheese", "tahini", "sesame seeds",
  "chilli powder", "turmeric", "garam masala", "curry powder",
  "pav bhaji masala", "Dijon mustard", "parmesan", "mozzarella", "gruyère",
  "frozen vegetables",
];

/** Assembled profile, used by the prompt builder. */
export const TASTE: TasteProfile = {
  userId: "owner",
  summary: TASTE_SUMMARY,
  allergies: NEVER_INCLUDE,
  dislikes: PREFER_TO_AVOID,
  spiceLevel: SPICE_LEVEL,
  equipment: EQUIPMENT,
  favourites: FAVOURITES,
  staples: PANTRY_STAPLES,
};
