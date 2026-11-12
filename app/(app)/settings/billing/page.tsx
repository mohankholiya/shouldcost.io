import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/ui/surface";
import { PlanBadge } from "@/components/billing";
import { ManageSubscriptionButton } from "./manage-button";
import { getCurrentOrg } from "@/lib/db/orgs";
import { findActiveSubscriptionByOrg, toSnapshot } from "@/lib/db/subscriptions";
import { FREE_LAUNCH, resolvePlan, resolveEffectivePlan, getEntitlement, trialStatus } from "@/lib/entitlements";

export default async function BillingPage() {
  const org = await getCurrentOrg();
  const isDemo = Boolean(org?.organizations?.is_demo);
  const sub = org ? await findActiveSubscriptionByOrg(org.org_id) : null;
  const planInput = {
    subscription: toSnapshot(sub),
    isDemo,
    trialStartedAt: org?.organizations?.created_at,
  };
  const plan = resolveEffectivePlan(planInput);
  const e = getEntitlement(plan);
  // A trial only ever elevates an unsubscribed org, so it is billed nothing.
  const trial = trialStatus(planInput);
  const onTrial = trial.state === "active";
  const freeLaunch = FREE_LAUNCH && resolvePlan(planInput) === "free";
  const fmtDate = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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
          <PlanBadge plan={plan} trial={onTrial} freeLaunch={freeLaunch} />
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
        {trial.state === "active" && (
          <p className="text-xs text-muted-foreground">
            Free trial: every feature is unlocked for {trial.daysLeft} more day
            {trial.daysLeft === 1 ? "" : "s"}, until {fmtDate(trial.endsAt)}. No card required. After
            that the workspace moves to the Free plan unless you upgrade.
          </p>
        )}
        {trial.state === "expired" && plan === "free" && (
          <p className="text-xs text-muted-foreground">
            Your 7-day trial ended on {fmtDate(trial.endsAt)}. Your models are kept; upgrade to unlock
            export, unlimited AI drafts and unlimited models again.
          </p>
        )}
        {FREE_LAUNCH ? (
          <p className="text-xs text-muted-foreground">
            shouldcost.io is free for everyone right now — unlimited models, all templates,
            unlimited AI drafts, Excel export and every other feature. No card required.
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
