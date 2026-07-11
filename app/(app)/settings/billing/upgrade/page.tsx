import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/ui/surface";
import { PlanCard } from "@/components/billing";
import { getCurrentOrg } from "@/lib/db/orgs";
import { findActiveSubscriptionByOrg, toSnapshot } from "@/lib/db/subscriptions";
import { FREE_LAUNCH, resolvePlan, getEntitlement } from "@/lib/entitlements";
import type { Plan } from "@/lib/entitlements";

// Carry-forward #1 (Option A): the free plan is rendered as a separate static
// card. `PlanCard` wires its CTA to `createCheckoutSessionAction`, whose Zod
// schema accepts only "pro" | "team" — checking out the free plan is not a
// valid flow (downgrade happens through the billing portal's Manage button).
// So we render a visually-matching static card for "free" and keep PlanCard
// for the interactive paid plans, preserving the three-card comparison layout.
const PAID_PLANS: Plan[] = ["pro", "team"];

export default async function UpgradePage() {
  // No paid plans to choose during the free-launch beta — everything is already
  // unlocked, so send the user back to the (informational) billing page.
  if (FREE_LAUNCH) redirect("/settings/billing");

  const org = await getCurrentOrg();
  const isDemo = Boolean(org?.organizations?.is_demo);
  const sub = org ? await findActiveSubscriptionByOrg(org.org_id) : null;
  const current = resolvePlan({ subscription: toSnapshot(sub), isDemo });
  const free = getEntitlement("free");
  const isFreeCurrent = current === "free";

  return (
    <>
      <PageHeader title="Upgrade" subtitle="Choose a plan — switch or cancel anytime" />
      <div className="grid gap-4 md:grid-cols-3">
        <Surface padding="md" className="flex flex-col">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">Free</h3>
            <div className="num text-lg font-semibold">$0</div>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            <li>{free.maxModels} models</li>
            <li>{free.maxTemplates} templates</li>
            <li>{free.maxSeats} seat{free.maxSeats === 1 ? "" : "s"}</li>
          </ul>
          <div className="mt-4">
            <Button disabled>
              {isFreeCurrent ? "Current" : "Included"}
            </Button>
          </div>
        </Surface>
        {PAID_PLANS.map((p) => (
          <PlanCard key={p} plan={p} current={current} />
        ))}
      </div>
    </>
  );
}
