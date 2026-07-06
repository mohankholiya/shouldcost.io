import Link from "next/link";
import { getCurrentOrg } from "@/lib/db/orgs";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/ui/surface";

export default async function SettingsPage() {
  const org = await getCurrentOrg();
  const name = org?.organizations?.name ?? "—";
  const plan = org?.organizations?.plan ?? "free";

  return (
    <>
      <PageHeader title="Settings" subtitle="Organization and profile" />
      <Surface as="dl" padding="lg" className="max-w-md space-y-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Organization</dt>
          <dd className="font-medium">{name}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Plan</dt>
          <dd className="font-medium capitalize">{plan}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Billing</dt>
          <dd>
            <Link href="/settings/billing" className="font-medium text-primary hover:underline">
              Manage →
            </Link>
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Your role</dt>
          <dd className="font-medium capitalize">{org?.role ?? "—"}</dd>
        </div>
      </Surface>
    </>
  );
}
