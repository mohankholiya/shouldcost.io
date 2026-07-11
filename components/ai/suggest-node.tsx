"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { NodeSuggestion } from "@/lib/ai/schemas";

/** Per-node "Suggest with AI" control. Nothing changes until the user clicks Apply. */
export function SuggestNode({
  nodeName,
  parentName,
  currency,
  onApply,
}: {
  nodeName: string;
  parentName?: string;
  currency: string;
  onApply: (s: NodeSuggestion) => void;
}) {
  const [s, setS] = useState<NodeSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/suggest-node", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nodeName, parentName, currency }),
      });
      if (!res.ok) {
        setError(
          res.status === 503
            ? "AI isn’t enabled yet."
            : res.status === 429
              ? "Too many AI requests — try again later."
              : "No suggestion available.",
        );
        return;
      }
      setS((await res.json()) as NodeSuggestion);
    } catch {
      setError("No suggestion available.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button size="sm" variant="ghost" onClick={run} disabled={loading}>
        {loading ? "Thinking…" : "Suggest with AI"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
      {s && (
        <div className="space-y-1 rounded-md border border-hairline p-2 text-xs">
          <div>
            <span className="font-medium">{s.driver}</span> · {s.rate_low}–{s.rate_high} {currency}/
            {s.unit}
          </div>
          <div className="text-muted-foreground">{s.rationale}</div>
          <div className="mt-1 flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => onApply(s)}>
              Apply
            </Button>
            <span className="text-muted-foreground">AI estimate — verify.</span>
          </div>
        </div>
      )}
    </div>
  );
}
