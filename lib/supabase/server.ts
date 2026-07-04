import { createServerClient as create } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Server client — RLS-bound, reads/writes the session cookie. Use in server components, route handlers, and server actions. */
export async function createServerClient() {
  const store = await cookies();
  return create(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // Called from a Server Component — session refresh is handled by middleware instead.
          }
        },
      },
    },
  );
}
