import { NextResponse, type NextRequest } from "next/server";
import { UNLOCK_COOKIE, passwordMatches, unlockToken } from "@/lib/access";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Unlock this device.
 *
 * A plain form POST to a route handler rather than a Server Action, because
 * the cookie is set directly on the redirect response here. There is no
 * question of whether it survives, and the whole flow can be exercised with
 * curl against the deployed site.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const submitted = String(form.get("password") ?? "");
  const origin = new URL(request.url).origin;

  if (!passwordMatches(submitted)) {
    return NextResponse.redirect(`${origin}/unlock?wrong=1`, { status: 303 });
  }

  const response = NextResponse.redirect(`${origin}/generate`, { status: 303 });
  response.cookies.set(UNLOCK_COOKIE, unlockToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    maxAge: ONE_YEAR,
    path: "/",
  });
  return response;
}

/** Lock this device again. */
export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const response = NextResponse.redirect(`${origin}/library`, { status: 303 });
  response.cookies.delete(UNLOCK_COOKIE);
  return response;
}
