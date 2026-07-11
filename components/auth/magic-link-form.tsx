"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { isRateLimitError } from "@/lib/auth/rate-limit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function MagicLinkForm({ mode }: { mode: "login" | "signup" }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cooldown throttles resends so a user can't rapid-fire into Supabase's email rate limit.
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/callback` },
    });
    setPending(false);
    if (error) {
      if (isRateLimitError(error)) {
        setError("Too many email requests — try “Continue with Google” above, or wait a minute.");
        setCooldown(60);
      } else {
        setError(error.message);
      }
    } else {
      setSent(true);
      setCooldown(60);
    }
  }

  if (sent) {
    return (
      <p className="text-sm text-favor">
        Check your inbox — we sent a sign-in link to <span className="font-medium">{email}</span>.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        aria-label="Work email"
      />
      <Button type="submit" className="w-full" disabled={pending || cooldown > 0}>
        {pending
          ? "Sending…"
          : cooldown > 0
            ? `Resend in ${cooldown}s`
            : mode === "signup"
              ? "Send sign-up link"
              : "Send magic link"}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
