import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/entitlements";

const TONE: Record<Plan, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-accent text-accent-foreground",
  team: "bg-primary text-primary-foreground",
};

export function PlanBadge({
  plan,
  trial = false,
  freeLaunch = false,
}: {
  plan: Plan;
  trial?: boolean;
  /** Free-launch mode: the org is elevated to every feature but billed nothing. */
  freeLaunch?: boolean;
}) {
  const label = freeLaunch
    ? "Free · all features"
    : plan.charAt(0).toUpperCase() + plan.slice(1) + (trial ? " trial" : "");
  return <Badge className={cn(TONE[plan])}>{label}</Badge>;
}
