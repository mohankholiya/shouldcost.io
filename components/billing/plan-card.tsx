"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { getEntitlement } from "@/lib/entitlements";
import type { Plan, Interval } from "@/lib/entitlements";
import { createCheckoutSessionAction } from "@/lib/actions/billing";

const LABEL: Record<Plan, string> = { free: "Free", pro: "Pro", team: "Team" };

export function PlanCard({ plan, current }: { plan: Plan; current: Plan }) {
  const e = getEntitlement(plan);
  const router = useRouter();
  const [interval, setInterval] = useState<Interval>("monthly");
  const [busy, setBusy] = useState(false);
  const isCurrent = plan === current;

  async function checkout() {
    setBusy(true);
    try {
      const { url } = await createCheckoutSessionAction({ plan, interval });
      router.push(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-hairline bg-card p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{LABEL[plan]}</h3>
        <div className="num text-lg font-semibold">
          {e.price.monthly === 0 ? "$0" : `$${(e.price[interval] / 100).toFixed(0)}`}
          {e.price.monthly !== 0 && <span className="text-xs text-muted-foreground">/{interval === "monthly" ? "mo" : "yr"}</span>}
        </div>
      </div>
      <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
        <li>{e.maxModels === null ? "Unlimited models" : `${e.maxModels} models`}</li>
        <li>{e.accessibleTemplateSlugs === null ? "All 17 templates" : `${e.maxTemplates} templates`}</li>
        <li>{e.maxSeats} seat{e.maxSeats === 1 ? "" : "s"}</li>
        {e.features.export && <li>PDF / XLSX export</li>}
        {e.features.shareLinks && <li>Share links</li>}
        {e.features.auditLog && <li>Audit log</li>}
      </ul>
      <div className="mt-4 flex items-center gap-2">
        <Button disabled={isCurrent || busy} onClick={checkout}>
          {isCurrent ? "Current" : busy ? "Redirecting…" : "Choose " + LABEL[plan]}
        </Button>
        {e.price.monthly !== 0 && (
          <select
            className="rounded-md border border-hairline bg-background px-2 py-1 text-xs"
            value={interval}
            onChange={(ev) => setInterval(ev.target.value as Interval)}
            aria-label="Billing interval"
          >
            <option value="monthly">Monthly</option>
            <option value="annual">Annual (2 months free)</option>
          </select>
        )}
      </div>
    </div>
  );
}
