import { canUseFeature, EntitlementError, type Plan } from "@/lib/entitlements";

/**
 * Server-side export entitlement gate. The route handler calls this on EVERY
 * request — the client `UpgradePrompt` is UX only, this is the real boundary.
 * Throws `EntitlementError("FEATURE_LOCKED", "pro")` for plans without the
 * `export` feature (Free); Pro/Team (and demo, which resolves to `team`
 * upstream) pass. Pure — no I/O.
 */
export function assertCanExport(plan: Plan): void {
  if (!canUseFeature(plan, "export")) {
    throw new EntitlementError(
      "FEATURE_LOCKED",
      "pro",
      "Exporting requires a Pro or Team plan.",
    );
  }
}
