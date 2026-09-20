"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="flex-1 grid place-items-center px-5 py-16">
      <div className="w-full max-w-sm">
        <h1 className="display text-5xl mb-3">Recipe Bot</h1>
        <p className="text-ink-soft mb-8 leading-relaxed">
          A recipe assistant that already knows how you cook — your pantry, your
          tastes, and every recipe you have saved.
        </p>

        {status === "sent" ? (
          <div className="rule-top pt-5">
            <p className="mb-2">
              <span className="qty">Check your email.</span>
            </p>
            <p className="text-ink-soft text-sm leading-relaxed">
              We sent a sign-in link to {email}. It expires in an hour. You can
              close this tab.
            </p>
          </div>
        ) : (
          <form onSubmit={sendLink} className="rule-top pt-5">
            <label htmlFor="email" className="block mb-2 text-sm text-ink-soft">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field mb-4"
              placeholder="you@example.com"
            />
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={status === "sending" || !email.trim()}
            >
              {status === "sending" ? "Sending link" : "Send sign-in link"}
            </button>
            <p className="text-ink-faint text-xs mt-3 leading-relaxed">
              No password. We email you a link that signs you in.
            </p>
            {status === "error" && (
              <p className="text-madder text-sm mt-4">{message}</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
