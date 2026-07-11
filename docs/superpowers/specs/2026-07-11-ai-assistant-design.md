# AI Should-Cost Assistant — Design Spec

**Status:** Approved (2026-07-11) — proceed autonomously through plan → implement. Pause only to collect `ANTHROPIC_API_KEY` before live testing against Claude.
**Date:** 2026-07-11
**Plan:** `docs/superpowers/plans/2026-07-11-ai-assistant.md` (next)

## 1. Goal

Add an AI assistant that helps users **build and interrogate should-cost models**, running on
Claude, across three touchpoints: draft a model from a description, suggest a node's driver/rate,
and explain a supplier-quote gap. Every AI number is a **labelled draft for review** — never
presented as certified. Deployable with the feature inert until the API key is set.

## 2. Non-negotiable guardrails (credibility-first — from CLAUDE.md)

- **AI output is always a draft.** Every AI-generated value/narrative carries a visible
  "AI-generated estimate — verify before use" label. AI never silently writes committed numbers;
  the user reviews/accepts.
- **No fake precision.** AI rates are approximate ranges/round figures, consistent with the
  existing "illustrative values, flagged for review" framing. No fabricated client names.
- **Server-side only.** `ANTHROPIC_API_KEY` is never exposed to the client. All calls go through
  `/api/ai/*` route handlers (`runtime="nodejs"`).
- **Cost safety.** Input length caps, request timeout, and light per-org rate limiting (free-launch
  puts everyone on `pro`, so a cap protects against runaway spend).

## 3. Shared backend (built once, first)

- `lib/ai/client.ts` — Anthropic client factory. **Guarded on `ANTHROPIC_API_KEY`**: exposes
  `isAiEnabled()` (server) so UI can hide/disable AI affordances when the key is absent; throws a
  clean 503-style error if a route is hit without a key. Default model =
  **Claude Opus 4.8** (`claude-opus-4-8`) per claude-api guidance (don't downgrade for
  cost without the user asking); a `SHOULDCOST_AI_MODEL` env override allows a cheaper
  tier later. Uses `@anthropic-ai/sdk`: `messages.parse` + `zodOutputFormat` for
  structured drafts/suggestions, `messages.stream` for the gap explainer, adaptive
  thinking on the drafter.
- `lib/ai/schemas.ts` — Zod schemas for structured outputs (CBS draft, node suggestion). Claude
  returns structured JSON via tool-use; the raw response is Zod-validated before any DB write.
- `lib/ai/rate-limit.ts` — pure `checkRateLimit(orgId, now, hits)` helper (in-memory/token-bucket
  style; simple and testable). Returns allow/deny + retry-after.
- Route handlers: `/api/ai/explain-gap`, `/api/ai/suggest-node`, `/api/ai/draft-model`. Each:
  auth (org required), rate-limit, validate input (Zod), call Claude, validate output, respond.

## 4. Feature C — Explain the gap / negotiation brief (first slice, lowest risk)

- Entry: "Explain with AI" button on `/models/[id]/compare` (only when a quote is selected).
- Server reads the already-computed comparison + waterfall + insights for the active quote and asks
  Claude for a narrative: where the quote is high/low vs should-cost, likely reasons, negotiation
  levers. **Read-only — no model mutation.**
- Response streamed as text into a panel/dialog. Carries the AI-estimate label.
- `components/ai/explain-gap-panel.tsx`.

## 5. Feature B — Suggest driver/rate for a node (second slice)

- Entry: per-node "Suggest with AI" in the model editor.
- Sends node context (name, parent path, model name/currency) → Claude returns
  `{ driver: string, rate_low: number, rate_high: number, unit: string, rationale: string }`
  (Zod-validated). User **accepts** (fills the node fields) or dismisses. Nothing changes until
  accept.
- `components/ai/suggest-node.tsx`; integrates with the existing node-edit flow.

## 6. Feature A — Draft a model from a description (third slice, biggest)

- Entry: "Draft with AI" alongside the template picker (project → new model).
- User describes the part/service → Claude returns a structured CBS: an array of nodes
  `{ name, category, driver, quantity, unit, rate_minor, note }` covering material, process/machining,
  labour, overhead, margin. Zod-validated.
- Creates a **new draft cost model** + nodes via the existing model/node creation paths; every value
  tagged as an AI estimate for review; opens in the editor. No auto-finalisation.
- `components/ai/draft-model.tsx`; reuses `lib/actions/model.ts` + node insert.

## 7. What the user provides

- `ANTHROPIC_API_KEY` → Vercel (Production + Preview) + local `.env.local`. Only new dependency.
  Build ships with it absent (AI affordances hidden); features activate once the key is added.

## 8. Testing

- Unit: Zod output parsing/validation (valid + malformed Claude responses), `checkRateLimit`
  allow/deny, `isAiEnabled` guard. Keep the existing suite green.
- Manual (post-key): each AI surface returns sensible output, label present, key never in client
  bundle, rate limit trips after N calls.

## 9. Release

No DB migration. Merge `phase-ai-assistant` → `phase-0-foundation`, rebuild, `vercel --prod` +
promote. AI is inert until `ANTHROPIC_API_KEY` is set, so shipping is safe before the key exists.

## 10. Out of scope (later)

Fine-tuning, retrieval over past models, multi-turn chat, auto-accepting AI numbers, non-Claude
providers.
