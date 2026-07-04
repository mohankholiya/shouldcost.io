import { getCurrentOrg } from "@/lib/db/orgs";
import { PageHeader } from "@/components/shared/page-header";

export default async function SettingsPage() {
  const org = await getCurrentOrg();
  const name = org?.organizations?.name ?? "—";
  const plan = org?.organizations?.plan ?? "free";

  return (
    <>
      <PageHeader title="Settings" subtitle="Organization and profile" />
      <dl className="max-w-md space-y-4 rounded-md border border-hairline bg-card p-5 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Organization</dt>
          <dd className="font-medium">{name}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Plan</dt>
          <dd className="font-medium capitalize">{plan}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Your role</dt>
          <dd className="font-medium capitalize">{org?.role ?? "—"}</dd>
        </div>
      </dl>
    </>
  );
}
