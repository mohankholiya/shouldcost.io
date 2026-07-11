import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/** Default to Opus 4.8; a cheaper tier can be selected later via env without a code change. */
export const AI_MODEL = process.env.SHOULDCOST_AI_MODEL ?? "claude-opus-4-8";

/** True when an Anthropic key is configured. UI and routes stay inert without a key. */
export function isAiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;

/** Lazily-constructed Anthropic client. Throws if no key is configured. */
export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("AI is not configured (ANTHROPIC_API_KEY missing).");
  }
  client ??= new Anthropic();
  return client;
}
