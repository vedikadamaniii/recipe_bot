/**
 * Who is allowed to spend money.
 *
 * The site is public to read. Generating, importing, saving and deleting all
 * cost something — API quota or the integrity of the library — so they are
 * gated behind an unlock cookie that only the owner can obtain.
 */

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

export const UNLOCK_COOKIE = "recipe-bot-unlock";

/** How many live generations visitors share per day. */
export const VISITOR_DAILY_CAP = Number(process.env.VISITOR_DAILY_CAP ?? 15);

function secret(): string {
  const value = process.env.APP_PASSWORD;
  if (!value) throw new Error("APP_PASSWORD is not set.");
  return value;
}

/**
 * The cookie value is an HMAC of the password rather than the password itself,
 * so the stored token cannot be read back out of a browser and retyped into
 * the unlock form.
 */
export function unlockToken(): string {
  return createHmac("sha256", secret()).update("unlocked").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Compare a submitted password in constant time. */
export function passwordMatches(submitted: string): boolean {
  if (!process.env.APP_PASSWORD) return false;
  return safeEqual(submitted, secret());
}

/** True when this request carries a valid unlock cookie. */
export async function isUnlocked(): Promise<boolean> {
  if (!process.env.APP_PASSWORD) {
    // No password configured, which is the local development case. Everything
    // is unlocked rather than mysteriously broken.
    return true;
  }
  const value = (await cookies()).get(UNLOCK_COOKIE)?.value;
  if (!value) return false;
  try {
    return safeEqual(value, unlockToken());
  } catch {
    return false;
  }
}
