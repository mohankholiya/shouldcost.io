"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";

/** Streams a Claude-written negotiation brief for the selected quote. Read-only. */
export function ExplainGapPanel({ modelId, quoteId }: { modelId: string; quoteId: string }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setText("");
    try {
      const res = await fetch("/api/ai/explain-gap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ modelId, quoteId }),
      });
      if (!res.ok || !res.body) {
        setError(
          res.status === 503
            ? "AI isn’t enabled yet."
            : res.status === 429
              ? "Too many AI requests — try again later."
              : "Couldn’t generate an explanation.",
        );
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setText((t) => t + dec.decode(value, { stream: true }));
      }
    } catch {
      setError("Couldn’t generate an explanation.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Surface padding="lg" radius="lg" className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">AI gap analysis</div>
        <Button size="sm" variant="outline" onClick={run} disabled={loading}>
          {loading ? "Analysing…" : "Explain with AI"}
        </Button>
      </div>
      {text && <p className="text-sm whitespace-pre-wrap">{text}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {text && (
        <p className="text-xs text-muted-foreground">AI-generated estimate — verify before use.</p>
      )}
    </Surface>
  );
}
