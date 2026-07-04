import { PageHeader } from "@/components/shared/page-header";

export default function ModelEditorStub() {
  return (
    <>
      <PageHeader title="Model editor" subtitle="Build and version a should-cost model" />
      <div className="rounded-md border border-dashed border-hairline p-8 text-sm text-muted-foreground">
        The cost-model editor — CBS tree, inline editing, index binding, and versioning — lands in
        Phase 1.
      </div>
    </>
  );
}
