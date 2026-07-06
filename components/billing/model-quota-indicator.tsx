import Link from "next/link";
import { getEntitlement } from "@/lib/entitlements";
import type { Plan } from "@/lib/entitlements";

export function ModelQuotaIndicator({ plan, used }: { plan: Plan; used: number }) {
  const max = getEntitlement(plan).maxModels;
  if (max === null) return null;
  const atCap = used >= max;
  return (
    <div className="px-4 py-2 text-xs text-muted-foreground">
      <span className="num">
        {used} / {max} models
      </span>
      {atCap && (
        <Link href="/settings/billing/upgrade" className="ml-2 font-medium text-primary">
          Upgrade
        </Link>
      )}
    </div>
  );
}
