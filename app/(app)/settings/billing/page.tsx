import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/ui/surface";
import { PlanBadge } from "@/components/billing";
import { ManageSubscriptionButton } from "./manage-button";
import { getCurrentOrg } from "@/lib/db/orgs";
import { findActiveSubscriptionByOrg, toSnapshot } from "@/lib/db/subscriptions";
import {
  FREE_LAUNCH,
  resolvePlan,
  resolveEffectivePlan,
  getEntitlement,
  isInTrial,
  trialEndsAt,
} from "@/lib/entitlements";

export default async function BillingPage() {
  const org = await getCurrentOrg();
  const isDemo = Boolean(org?.organizations?.is_demo);
  const sub = org ? await findActiveSubscriptionByOrg(org.org_id) : null;
  const plan = resolveEffectivePlan({
    subscription: toSnapshot(sub),
    isDemo,
    trialStartedAt: org?.organizations?.created_at,
  });
  const e = getEntitlement(plan);
  // A trial only ever elevates an unsubscribed org, so it is billed nothing.
  const onTrial =
    resolvePlan({ subscription: toSnapshot(sub), isDemo }) === "free" &&
    isInTrial(org?.organizations?.created_at);
  const trialEnd = onTrial ? trialEndsAt(org?.organizations?.created_at) : null;
  const daysLeft = trialEnd ? Math.max(1, Math.ceil((trialEnd.getTime() - Date.now()) / 86_400_000)) : 0;
  // In free-launch mode nobody is billed, so the price is always Free even for
  // orgs elevated to the `pro` feature set.
  const price =
    FREE_LAUNCH || onTrial || e.price.monthly === 0 ? "Free" : `$${(e.price.monthly / 100).toFixed(0)}/mo`;

  return (
    <>
      <PageHeader title="Billing" subtitle="Plan, subscription, and invoicing" />
      <Surface padding="lg" className="max-w-md space-y-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Current plan</span>
          <PlanBadge plan={plan} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Price</span>
          <span className="num font-medium">{price}</span>
        </div>
        {isDemo && (
          <p className="text-xs text-muted-foreground">
            This is a demo workspace — all features are unlocked and no card is on file.
          </p>
        )}
        {trialEnd && (
          <p className="text-xs text-muted-foreground">
            Free trial: every feature is unlocked for {daysLeft} more day{daysLeft === 1 ? "" : "s"}, until{" "}
            {trialEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}. No card
            required. After that the workspace moves to the Free plan unless you upgrade.
          </p>
        )}
        {FREE_LAUNCH ? (
          <p className="text-xs text-muted-foreground">
            You&rsquo;re on the free beta — every feature is unlocked and no card is
            required. Paid plans arrive later.
          </p>
        ) : (
          <div className="flex gap-2 pt-2">
            {plan === "free" || onTrial ? (
              <Button asChild>
                <Link href="/settings/billing/upgrade">Upgrade</Link>
              </Button>
            ) : (
              <ManageSubscriptionButton />
            )}
          </div>
        )}
      </Surface>
    </>
  );
}
