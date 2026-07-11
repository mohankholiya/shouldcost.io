import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/ui/surface";
import { PlanBadge } from "@/components/billing";
import { ManageSubscriptionButton } from "./manage-button";
import { getCurrentOrg } from "@/lib/db/orgs";
import { findActiveSubscriptionByOrg, toSnapshot } from "@/lib/db/subscriptions";
import { FREE_LAUNCH, resolveEffectivePlan, getEntitlement } from "@/lib/entitlements";

export default async function BillingPage() {
  const org = await getCurrentOrg();
  const isDemo = Boolean(org?.organizations?.is_demo);
  const sub = org ? await findActiveSubscriptionByOrg(org.org_id) : null;
  const plan = resolveEffectivePlan({ subscription: toSnapshot(sub), isDemo });
  const e = getEntitlement(plan);
  // In free-launch mode nobody is billed, so the price is always Free even for
  // orgs elevated to the `pro` feature set.
  const price = FREE_LAUNCH || e.price.monthly === 0 ? "Free" : `$${(e.price.monthly / 100).toFixed(0)}/mo`;

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
        {FREE_LAUNCH ? (
          <p className="text-xs text-muted-foreground">
            You&rsquo;re on the free beta — every feature is unlocked and no card is
            required. Paid plans arrive later.
          </p>
        ) : (
          <div className="flex gap-2 pt-2">
            {plan === "free" ? (
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
