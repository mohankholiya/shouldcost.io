"use client";

import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Shown when a user is authenticated but has no org membership. Rendering a page
 * here (rather than redirecting to /login) is deliberate: middleware bounces an
 * authenticated user from /login back to /dashboard, so redirecting would create
 * an infinite loop (ERR_TOO_MANY_REDIRECTS).
 */
export function NoWorkspace() {
  const router = useRouter();

  async function signOut() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold">Setting up your workspace</h1>
        <p className="text-sm text-muted-foreground">
          You’re signed in, but your account doesn’t have a workspace yet. This is usually
          momentary — try refreshing. If it persists, sign out and back in, or contact support.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={() => router.refresh()}>Refresh</Button>
          <Button variant="outline" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>
    </main>
  );
}
