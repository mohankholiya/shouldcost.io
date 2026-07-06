import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Plan } from "@/lib/entitlements";

export function UpgradePrompt({
  title = "Upgrade to unlock",
  requiredPlan,
}: {
  title?: string;
  requiredPlan: Plan;
}) {
  return (
    <div className="rounded-md border border-hairline bg-card p-4 text-sm">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {requiredPlan === "team" ? "Team" : "Pro"} removes this limit.
      </p>
      <Button asChild size="sm" className="mt-3">
        <Link href="/settings/billing/upgrade">Upgrade</Link>
      </Button>
    </div>
  );
}
