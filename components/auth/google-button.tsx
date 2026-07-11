"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/** Starts Google OAuth. Supabase redirects to Google, then back to /callback (PKCE code flow). */
export function GoogleButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setPending(true);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/callback` },
    });
    if (error) {
      setError(error.message);
      setPending(false);
    }
    // On success the browser is redirected to Google; no further local state needed.
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={onClick}
        disabled={pending}
      >
        {pending ? "Redirecting…" : "Continue with Google"}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
