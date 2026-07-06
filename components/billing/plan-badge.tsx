import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/entitlements";

const TONE: Record<Plan, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-accent text-accent-foreground",
  team: "bg-primary text-primary-foreground",
};

export function PlanBadge({ plan }: { plan: Plan }) {
  const label = plan.charAt(0).toUpperCase() + plan.slice(1);
  return <Badge className={cn("capitalize", TONE[plan])}>{label}</Badge>;
}
