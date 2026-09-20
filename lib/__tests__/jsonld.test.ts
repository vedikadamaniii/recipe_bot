import { describe, expect, it } from "vitest";
import { extractJsonLdBlocks, findRecipeNode, recipeFromHtml, stripHtml } from "../jsonld";

const page = (jsonld: string) =>
  `<!DOCTYPE html><html><head><title>x</title>
   <script type="application/ld+json">${jsonld}</script>
   </head><body><p>content</p></body></html>`;

const RECIPE = {
  "@context": "https://schema.org",
  "@type": "Recipe",
  name: "Weeknight Dal",
  description: "A quick <b>lentil</b> stew.",
  recipeCuisine: "indian",
  recipeCategory: "Main",
  keywords: "lentils, high protein, weeknight",
  recipeYield: "4 servings",
  totalTime: "PT35M",
  image: ["https://example.com/dal.jpg"],
  recipeIngredient: [
    "1 cup red lentils",
    "1 large onion, finely chopped",
    "½ tsp turmeric",
    "Salt to taste",
  ],
  recipeInstructions: [
    { "@type": "HowToStep", text: "Rinse the lentils." },
    { "@type": "HowToStep", text: "Simmer until soft." },
  ],
};

describe("extractJsonLdBlocks", () => {
  it("finds embedded payloads", () => {
    expect(extractJsonLdBlocks(page(JSON.stringify(RECIPE)))).toHaveLength(1);
  });

  it("skips invalid JSON rather than failing the whole import", () => {
    const html = page("{ not valid json ,,, }") + page(JSON.stringify(RECIPE));
    expect(extractJsonLdBlocks(html)).toHaveLength(1);
  });

  it("returns nothing for a page without structured data", () => {
    expect(extractJsonLdBlocks("<html><body>hi</body></html>")).toHaveLength(0);
  });
});

describe("findRecipeNode", () => {
  it("finds a Recipe inside an @graph", () => {
    const payload = { "@graph": [{ "@type": "WebPage" }, RECIPE] };
    expect(findRecipeNode(payload)).toMatchObject({ name: "Weeknight Dal" });
  });

  it("finds a Recipe inside a top-level array", () => {
    expect(findRecipeNode([{ "@type": "Organization" }, RECIPE])).toBeTruthy();
  });

  it("handles a @type given as an array", () => {
    expect(findRecipeNode({ ...RECIPE, "@type": ["Recipe", "NewsArticle"] })).toBeTruthy();
  });

  it("returns null when there is no Recipe", () => {
    expect(findRecipeNode({ "@type": "WebPage" })).toBeNull();
  });

  it("does not hang on a circular structure", () => {
    const a: Record<string, unknown> = { "@type": "WebPage" };
    a.self = a;
    expect(findRecipeNode(a)).toBeNull();
  });
});

describe("recipeFromHtml", () => {
  it("imports a full recipe with no AI call", () => {
    const recipe = recipeFromHtml(page(JSON.stringify(RECIPE)), "https://example.com/dal");
    expect(recipe).not.toBeNull();
    expect(recipe!.title).toBe("Weeknight Dal");
    expect(recipe!.cuisine).toBe("Indian");
    expect(recipe!.baseServings).toBe(4);
    expect(recipe!.totalTimeMin).toBe(35);
    expect(recipe!.sourceType).toBe("link");
    expect(recipe!.sourceUrl).toBe("https://example.com/dal");
    expect(recipe!.imageUrl).toBe("https://example.com/dal.jpg");
  });

  it("parses the ingredients into structured, scalable form", () => {
    const recipe = recipeFromHtml(page(JSON.stringify(RECIPE)))!;
    expect(recipe.ingredients).toHaveLength(4);
    expect(recipe.ingredients[0]).toMatchObject({ qty: 1, unit: "cup", item: "red lentils" });
    // The size adjective is kept: the recipe said "large onion", and throwing
    // that away would lose real information. Pantry matching is fuzzy separately.
    expect(recipe.ingredients[1]).toMatchObject({ item: "large onion", prep: "finely chopped" });
    expect(recipe.ingredients[2]).toMatchObject({ qty: 0.5, unit: "tsp", scaling: "manual" });
    expect(recipe.ingredients[3].qty).toBeNull();
  });

  it("numbers the steps", () => {
    const recipe = recipeFromHtml(page(JSON.stringify(RECIPE)))!;
    expect(recipe.steps).toEqual([
      { n: 1, text: "Rinse the lentils." },
      { n: 2, text: "Simmer until soft." },
    ]);
  });

  it("strips markup out of description and titles", () => {
    const recipe = recipeFromHtml(page(JSON.stringify(RECIPE)))!;
    expect(recipe.description).toBe("A quick lentil stew.");
  });

  it("handles instructions given as one blob of text", () => {
    const blob = { ...RECIPE, recipeInstructions: "Rinse well.\nSimmer gently.\nSeason." };
    const recipe = recipeFromHtml(page(JSON.stringify(blob)))!;
    expect(recipe.steps).toHaveLength(3);
    expect(recipe.steps[2].text).toBe("Season.");
  });

  it("handles HowToSection nesting", () => {
    const sectioned = {
      ...RECIPE,
      recipeInstructions: [
        {
          "@type": "HowToSection",
          name: "Prep",
          itemListElement: [{ "@type": "HowToStep", text: "Chop the onion." }],
        },
        { "@type": "HowToStep", text: "Cook it." },
      ],
    };
    const recipe = recipeFromHtml(page(JSON.stringify(sectioned)))!;
    expect(recipe.steps.map((s) => s.text)).toEqual(["Chop the onion.", "Cook it."]);
  });

  it("falls back to defaults for missing optional fields", () => {
    const sparse = {
      "@type": "Recipe",
      name: "Toast",
      recipeIngredient: ["2 slices bread"],
    };
    const recipe = recipeFromHtml(page(JSON.stringify(sparse)))!;
    expect(recipe.cuisine).toBe("Other");
    expect(recipe.baseServings).toBe(4);
    expect(recipe.totalTimeMin).toBeNull();
    expect(recipe.steps).toEqual([]);
  });

  it("returns null when the page is not a recipe, so we can fall back to the model", () => {
    expect(recipeFromHtml("<html><body>a blog post</body></html>")).toBeNull();
    const notARecipe = page(JSON.stringify({ "@type": "Recipe", name: "No ingredients" }));
    expect(recipeFromHtml(notARecipe)).toBeNull();
  });
});

describe("stripHtml", () => {
  it("removes tags and decodes entities", () => {
    expect(stripHtml("<p>Salt &amp; pepper</p>")).toBe("Salt & pepper");
    expect(stripHtml("a&nbsp;&nbsp;b")).toBe("a b");
  });
});
