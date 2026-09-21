"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UNLOCK_COOKIE, passwordMatches, unlockToken } from "@/lib/access";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function unlock(formData: FormData) {
  const submitted = String(formData.get("password") ?? "");

  if (!passwordMatches(submitted)) {
    redirect("/unlock?wrong=1");
  }

  (await cookies()).set(UNLOCK_COOKIE, unlockToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR,
    path: "/",
  });

  redirect("/generate");
}

export async function lock() {
  (await cookies()).delete(UNLOCK_COOKIE);
  redirect("/library");
}
