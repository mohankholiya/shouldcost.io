import type { Plan } from "@/lib/entitlements";

/** Pure credit decision so the gate is unit-testable without a database. */
export function decideAiDraftAccess(
  plan: Plan,
  creditsRemaining: number,
): { allowed: boolean; reserveCredit: boolean } {
  if (plan !== "free") return { allowed: true, reserveCredit: false };
  return creditsRemaining > 0
    ? { allowed: true, reserveCredit: true }
    : { allowed: false, reserveCredit: false };
}
