"use client";

import { useEffect, useRef } from "react";
import { useEditorStore } from "@/lib/stores/editor-store";
import { CbsTree } from "@/components/models/cbs-tree/cbs-tree";
import { AnimatedCounter } from "@/components/number/animated-counter";
import { SavedIndicator } from "@/components/shared/saved-indicator";
import { PageHeader } from "@/components/shared/page-header";
import { saveNodesAction } from "@/lib/actions/model";
import { IndicesProvider } from "@/components/models/indices-context";
import { VersionBar } from "@/components/models/version-bar";
import type { CostNodeRow } from "@/lib/model/types";
import type { ModelHeader } from "@/lib/db/models";
import type { IndexWithLatest } from "@/lib/db/indices";
import type { ModelVersion } from "@/lib/db/versions";

export function ModelEditor({
  model,
  nodes,
  indices,
  versions,
}: {
  model: ModelHeader;
  nodes: CostNodeRow[];
  indices: IndexWithLatest[];
  versions: ModelVersion[];
}) {
  const hydrate = useEditorStore((s) => s.hydrate);
  useEffect(() => {
    hydrate(nodes);
  }, [hydrate, nodes]);

  const total = useEditorStore((s) => s.rollup.total);
  const status = useEditorStore((s) => s.saveStatus);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = useEditorStore.subscribe(() => {
      const s = useEditorStore.getState();
      if (s.saveStatus === "saving") return; // don't reschedule mid-flight
      if (s.dirtyIds.size === 0 && s.deletedIds.length === 0) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const st = useEditorStore.getState();
        const ids = [...st.dirtyIds];
        const changed = ids.map((id) => st.nodes[id]).filter(Boolean) as CostNodeRow[];
        const deleted = [...st.deletedIds];
        st.setSaveStatus("saving");
        try {
          await saveNodesAction({ modelId: model.id, changed, deleted });
          st.markSaved(ids);
        } catch {
          st.setSaveStatus("error");
        }
      }, 800);
    });
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [model.id]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={model.name}
        subtitle="Cost-model editor"
        actions={
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] tracking-wide text-muted-foreground uppercase">
                Should-cost ({model.currency})
              </div>
              <div className="num text-2xl font-semibold">
                <AnimatedCounter valueMinor={total} />
              </div>
            </div>
            <SavedIndicator status={status} />
          </div>
        }
      />
      <IndicesProvider value={indices}>
        <CbsTree />
      </IndicesProvider>
      <VersionBar modelId={model.id} versions={versions} />
    </div>
  );
}
