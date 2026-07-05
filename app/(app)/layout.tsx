import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/db/orgs";
import { createServerClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");
  const orgName = org.organizations?.name ?? "My workspace";

  // Five most recent models (RLS-scoped to this org) feed the sidebar shortcut.
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("cost_models")
    .select("id, name")
    .order("created_at", { ascending: false })
    .limit(5);
  const recentModels = (data ?? []) as { id: string; name: string }[];

  return (
    <div className="flex min-h-screen">
      <Sidebar recentModels={recentModels} />
      <div className="flex flex-1 flex-col">
        <Topbar orgName={orgName} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
