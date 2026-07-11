import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { KpiTile } from "@/components/shared/kpi-tile";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { deriveOnboardingSteps } from "@/lib/onboarding/steps";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";

type ModelRow = {
  id: string;
  name: string;
  status: string;
  model_versions: { total_cost: number }[] | null;
};

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("cost_models")
    .select("id, name, status, model_versions(total_cost)")
    .order("created_at", { ascending: false });

  const models = (data ?? []) as ModelRow[];
  const totalMinor = models.reduce((sum, m) => sum + (m.model_versions?.[0]?.total_cost ?? 0), 0);
  const isEmpty = models.length === 0;

  // RLS-scoped quote count feeds the onboarding checklist (head-only, no rows returned).
  const { count: quoteCount } = await supabase
    .from("quotes")
    .select("id", { count: "exact", head: true });
  const onboardingSteps = deriveOnboardingSteps({
    modelCount: models.length,
    quoteCount: quoteCount ?? 0,
  });

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Your portfolio at a glance"
        actions={
          <Button asChild>
            <Link href="/projects">Open projects</Link>
          </Button>
        }
      />

      {isEmpty ? (
        <EmptyState
          title="No models yet"
          steps={[
            "Pick a category template",
            "Adjust drivers and rates",
            "Compare against supplier quotes",
          ]}
          cta={
            <Button asChild>
              <Link href="/projects">Start from a template</Link>
            </Button>
          }
        />
      ) : (
        <>
          <OnboardingChecklist steps={onboardingSteps} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiTile
              label="Addressed spend"
              valueMinor={totalMinor}
              currency="USD"
              hint={`Across ${models.length} model${models.length === 1 ? "" : "s"}`}
            />
            <Surface padding="lg" radius="lg">
              <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Cost models
              </div>
              <div className="num mt-2 text-3xl font-semibold">{models.length}</div>
              <div className="mt-2 text-xs text-muted-foreground">Active across all projects</div>
            </Surface>
            <Surface padding="lg" radius="lg">
              <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Templates
              </div>
              <div className="num mt-2 text-3xl font-semibold">17</div>
              <div className="mt-2 text-xs text-muted-foreground">
                Energy &amp; utilities categories
              </div>
            </Surface>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Demo data — illustrative values flagged for review, not certified cost audits.
          </p>
        </>
      )}
    </>
  );
}
