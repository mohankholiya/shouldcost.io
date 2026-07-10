import { Button } from "@/components/ui/button";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { canUseFeature, type Plan } from "@/lib/entitlements";

/**
 * Export control for the model + compare pages. Pro/Team see a download link to
 * the XLSX export route; Free sees the upgrade prompt. This is UX only — the
 * route handler re-checks the entitlement server-side, so hiding the link is
 * not a security boundary. PDF is omitted until Phase 3C ships it, so no user
 * can reach the route's 501. Passing `quoteId` exports the model-vs-quote
 * comparison; omitting it exports the should-cost model.
 *
 * Uses a plain <a> (not next/link) so the browser performs a real navigation
 * and honours the route's `Content-Disposition: attachment` download.
 */
export function ExportMenu({
  modelId,
  plan,
  quoteId,
}: {
  modelId: string;
  plan: Plan;
  quoteId?: string;
}) {
  if (!canUseFeature(plan, "export")) {
    return <UpgradePrompt title="Export is a Pro feature" requiredPlan="pro" />;
  }
  const href = `/api/models/${modelId}/export?format=xlsx${
    quoteId ? `&quoteId=${quoteId}` : ""
  }`;
  return (
    <Button asChild variant="outline" size="sm">
      <a href={href} download>
        Export XLSX
      </a>
    </Button>
  );
}
