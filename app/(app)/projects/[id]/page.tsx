import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { TemplatePicker } from "@/components/indices/template-picker";
import { cn } from "@/lib/utils";
import { surfaceVariants } from "@/components/ui/surface";
import { getCurrentOrg } from "@/lib/db/orgs";
import { findActiveSubscriptionByOrg, toSnapshot } from "@/lib/db/subscriptions";
import { resolveEffectivePlan, type Plan } from "@/lib/entitlements";

type ProjectRow = { id: string; name: string };
type ModelRow = { id: string; name: string; status: string };

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await getCurrentOrg();
  const isDemo = Boolean(org?.organizations?.is_demo);
  const sub = org ? await findActiveSubscriptionByOrg(org.org_id) : null;
  const plan: Plan = resolveEffectivePlan({ subscription: toSnapshot(sub), isDemo });
  const supabase = await createServerClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  const { data } = await supabase
    .from("cost_models")
    .select("id, name, status")
    .eq("project_id", id);
  const models = (data ?? []) as ModelRow[];

  return (
    <>
      <PageHeader
        title={(project as ProjectRow | null)?.name ?? "Project"}
        subtitle="Models in this project"
        actions={<TemplatePicker projectId={id} plan={plan} />}
      />
      {models.length === 0 ? (
        <EmptyState
          title="No models in this project"
          steps={["Start from a category template", "Customize drivers", "Save a version"]}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {models.map((m) => (
            <Link
              key={m.id}
              href={`/models/${m.id}`}
              className={cn(surfaceVariants({ padding: "md", elevation: "interactive" }))}
            >
              <div className="font-medium">{m.name}</div>
              <div className="mt-2">
                <Badge variant="secondary">{m.status}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
