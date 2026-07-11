import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/** Default to Opus 4.8; a cheaper tier can be selected later via env without a code change. */
export const AI_MODEL = process.env.SHOULDCOST_AI_MODEL ?? "claude-opus-4-8";

/**
 * Resolve the Anthropic key, tolerating a few common env-var naming mistakes so the
 * feature works regardless of exact casing. Canonical name is `ANTHROPIC_API_KEY`.
 */
function resolveApiKey(): string | undefined {
  return (
    process.env.ANTHROPIC_API_KEY ||
    process.env.Anthropic ||
    process.env.ANthropic ||
    process.env.ANTHROPIC_KEY ||
    undefined
  );
}

/** True when an Anthropic key is configured. UI and routes stay inert without a key. */
export function isAiEnabled(): boolean {
  return Boolean(resolveApiKey());
}

let client: Anthropic | null = null;

/** Lazily-constructed Anthropic client. Throws if no key is configured. */
export function getAnthropic(): Anthropic {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new Error("AI is not configured (ANTHROPIC_API_KEY missing).");
  }
  client ??= new Anthropic({ apiKey });
  return client;
}
