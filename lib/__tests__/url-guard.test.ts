import { describe, expect, it } from "vitest";
import { UnsafeUrlError, assertPublicUrl, isPrivateHost } from "../url-guard";

describe("assertPublicUrl", () => {
  it("allows ordinary recipe links", () => {
    expect(assertPublicUrl("https://www.bbcgoodfood.com/recipes/dal").hostname).toBe(
      "www.bbcgoodfood.com",
    );
    expect(assertPublicUrl("http://example.org/r/1").protocol).toBe("http:");
  });

  it("rejects non-http schemes", () => {
    for (const bad of [
      "file:///etc/passwd",
      "ftp://example.com/x",
      "data:text/html,<script>",
      "javascript:alert(1)",
    ]) {
      expect(() => assertPublicUrl(bad)).toThrow(UnsafeUrlError);
    }
  });

  it("rejects loopback and private network addresses", () => {
    for (const bad of [
      "http://localhost:3000/admin",
      "http://127.0.0.1/",
      "http://0.0.0.0/",
      "http://10.0.0.5/",
      "http://192.168.1.1/",
      "http://172.16.0.1/",
      "http://172.31.255.255/",
      "http://api.internal/secrets",
      "http://db.local/",
      "http://[::1]/",
    ]) {
      expect(() => assertPublicUrl(bad), bad).toThrow(UnsafeUrlError);
    }
  });

  it("rejects the cloud metadata endpoint", () => {
    // 169.254.169.254 is where cloud providers serve instance credentials.
    expect(() => assertPublicUrl("http://169.254.169.254/latest/meta-data/")).toThrow(
      UnsafeUrlError,
    );
  });

  it("does not reject public addresses that merely look similar", () => {
    expect(() => assertPublicUrl("https://172.32.0.1/")).not.toThrow();
    expect(() => assertPublicUrl("https://11.0.0.1/")).not.toThrow();
    expect(() => assertPublicUrl("https://mylocalhost.com/")).not.toThrow();
  });

  it("rejects malformed input", () => {
    expect(() => assertPublicUrl("not a url")).toThrow(UnsafeUrlError);
    expect(() => assertPublicUrl("")).toThrow(UnsafeUrlError);
  });
});

describe("isPrivateHost", () => {
  it("catches IPv6 unique-local and link-local", () => {
    expect(isPrivateHost("fd00::1")).toBe(true);
    expect(isPrivateHost("fe80::1")).toBe(true);
    expect(isPrivateHost("[::1]")).toBe(true);
  });
});
