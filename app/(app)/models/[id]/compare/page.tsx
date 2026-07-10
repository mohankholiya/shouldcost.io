import { notFound } from "next/navigation";
import { loadModel } from "@/lib/db/models";
import { loadNodes } from "@/lib/db/nodes";
import { loadQuotes } from "@/lib/db/quotes";
import { getCurrentOrg } from "@/lib/db/orgs";
import { findActiveSubscriptionByOrg, toSnapshot } from "@/lib/db/subscriptions";
import { resolvePlan, type Plan } from "@/lib/entitlements";
import { CompareView } from "@/components/quotes/compare-view";
import type { Currency } from "@/components/number/currency-select";

export default async function ComparePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = await loadModel(id);
  if (!model) notFound();
  const org = await getCurrentOrg();
  const isDemo = Boolean(org?.organizations?.is_demo);
  const sub = org ? await findActiveSubscriptionByOrg(org.org_id) : null;
  const plan: Plan = resolvePlan({ subscription: toSnapshot(sub), isDemo });
  const [nodes, quotes] = await Promise.all([loadNodes(id), loadQuotes(id)]);
  return (
    <CompareView
      modelId={model.id}
      modelName={model.name}
      currency={model.currency as Currency}
      nodes={nodes}
      quotes={quotes}
      plan={plan}
    />
  );
}
