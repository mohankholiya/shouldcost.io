import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { requestCache } from "@/lib/request-cache";

export type CurrentOrg = {
  org_id: string;
  role: string;
  organizations: {
    id: string;
    name: string;
    plan: string;
    is_demo: boolean;
    ai_draft_credits: number;
    created_at?: string | null;
  } | null;
};

/**
 * The calling user's org membership (personal org, auto-created on signup).
 * Memoised per request: the layout, the page and any action share one lookup.
 */
export const getCurrentOrg = requestCache(async (): Promise<CurrentOrg | null> => {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("org_members")
    .select("org_id, role, organizations(id, name, plan, is_demo, ai_draft_credits, created_at)")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data as CurrentOrg | null) ?? null;
});
