/**
 * Guard for user-supplied URLs that the server will fetch.
 *
 * The recipe importer takes a link and fetches it server-side. Without this
 * check, that endpoint would fetch internal addresses on behalf of whoever
 * asked — the classic SSRF shape, where a public form becomes a window onto
 * a private network.
 */

export class UnsafeUrlError extends Error {}

const PRIVATE_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.internal$/i,
  /\.local$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./, // link-local, includes cloud metadata endpoints
];

export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "::1" || h === "0.0.0.0") return true;
  // IPv6 unique-local and link-local.
  if (/^(fc|fd|fe80)/.test(h) && h.includes(":")) return true;
  return PRIVATE_HOST_PATTERNS.some((re) => re.test(h));
}

/** Returns the parsed URL, or throws when it must not be fetched. */
export function assertPublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new UnsafeUrlError("That does not look like a URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http and https links can be imported.");
  }

  if (isPrivateHost(url.hostname)) {
    throw new UnsafeUrlError("That address is not reachable from here.");
  }

  return url;
}
