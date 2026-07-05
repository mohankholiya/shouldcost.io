import "server-only";
import { createServerClient } from "@/lib/supabase/server";

export type CurrentOrg = {
  org_id: string;
  role: string;
  organizations: { id: string; name: string; plan: string; is_demo: boolean } | null;
};

/** The calling user's org membership (personal org, auto-created on signup). */
export async function getCurrentOrg(): Promise<CurrentOrg | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("org_members")
    .select("org_id, role, organizations(id, name, plan, is_demo)")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data as CurrentOrg | null) ?? null;
}
