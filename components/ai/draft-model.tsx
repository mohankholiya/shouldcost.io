"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createModelFromDraftAction } from "@/lib/actions/model";
import type { ModelDraft } from "@/lib/ai/schemas";

/** "Draft with AI": describe a part/service → Claude drafts an editable cost model (USD). */
export function DraftModel({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/draft-model", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description, currency: "USD" }),
      });
      if (!res.ok) {
        setError(
          res.status === 503
            ? "AI isn’t enabled yet."
            : res.status === 429
              ? "Too many AI requests — try again later."
              : "Couldn’t draft a model. Try rephrasing.",
        );
        return;
      }
      const draft = (await res.json()) as ModelDraft;
      const created = await createModelFromDraftAction({ projectId, draft });
      if ("error" in created) {
        setError("Model limit reached for this workspace.");
        return;
      }
      router.push(`/models/${created.id}`);
    } catch {
      setError("Couldn’t draft a model. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe a part or service — e.g. “CNC-machined steel valve body, ~12 kg, low volume”"
        rows={3}
      />
      <div className="flex items-center gap-3">
        <Button onClick={run} disabled={loading || !description.trim()}>
          {loading ? "Drafting…" : "Draft with AI"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Creates an editable draft in USD — all values are AI estimates to verify.
        </span>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
