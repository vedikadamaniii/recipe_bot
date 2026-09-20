import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRecipe } from "../db";

describe("getRecipe", () => {
  it("treats a malformed id as a missing recipe, without hitting the database", async () => {
    // Postgres raises "invalid input syntax for type uuid" on a bad id, which
    // would surface to the user as a 500 rather than a 404.
    const from = vi.fn();
    const sb = { from } as unknown as SupabaseClient;

    for (const bad of ["abc", "", "123", "not-a-uuid", "../../etc/passwd"]) {
      await expect(getRecipe(sb, bad)).resolves.toBeNull();
    }
    expect(from).not.toHaveBeenCalled();
  });

  it("queries for a well-formed uuid", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const sb = { from } as unknown as SupabaseClient;

    await getRecipe(sb, "3f2504e0-4f89-41d3-9a0c-0305e82c3301");
    expect(from).toHaveBeenCalledWith("recipes");
  });
});
