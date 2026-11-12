import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/db/orgs";
import { createServerClient } from "@/lib/supabase/server";
import { findActiveSubscriptionByOrg, toSnapshot } from "@/lib/db/subscriptions";
import { countModelsByOrg } from "@/lib/db/models";
import { resolveEffectivePlan, trialStatus } from "@/lib/entitlements";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/command/command-palette";
import { NoWorkspace } from "@/components/layout/no-workspace";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const org = await getCurrentOrg();
  if (!org) {
    // getCurrentOrg is null for two distinct reasons. Handle them differently so an
    // authenticated-but-org-less user never gets redirected to /login — middleware would
    // bounce them straight back to /dashboard, producing ERR_TOO_MANY_REDIRECTS.
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    return <NoWorkspace />;
  }
  const orgName = org.organizations?.name ?? "My workspace";
  const isDemo = Boolean(org.organizations?.is_demo);

  // Effective plan drives the sidebar badge + quota indicator, the template
  // gate, and the model-cap check. `toSnapshot` adapts the snake_case DB row
  // so resolvePlan's currentPeriodEnd expiry check actually fires. The three
  // reads are independent, so they run in parallel rather than back to back.
  const supabase = await createServerClient();
  const [sub, modelCount, { data }] = await Promise.all([
    findActiveSubscriptionByOrg(org.org_id),
    countModelsByOrg(org.org_id),
    // Five most recent models (RLS-scoped to this org) feed the sidebar shortcut.
    supabase.from("cost_models").select("id, name").order("created_at", { ascending: false }).limit(5),
  ]);
  const planInput = {
    subscription: toSnapshot(sub),
    isDemo,
    trialStartedAt: org.organizations?.created_at,
  };
  const plan = resolveEffectivePlan(planInput);
  const trial = trialStatus(planInput);
  const trialDaysLeft = trial.state === "active" ? trial.daysLeft : null;
  const recentModels = (data ?? []) as { id: string; name: string }[];

  return (
    <div className="flex min-h-screen">
      <CommandPalette recentModels={recentModels} />
      <Sidebar
        recentModels={recentModels}
        plan={plan}
        modelCount={modelCount}
        trialDaysLeft={trialDaysLeft}
        trialExpired={trial.state === "expired" && plan === "free"}
      />
      <div className="flex flex-1 flex-col">
        <Topbar orgName={orgName} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
