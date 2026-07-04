import { createBrowserClient as create } from "@supabase/ssr";

/** Browser client — RLS-bound. Safe to use in client components. */
export function createBrowserClient() {
  return create(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
