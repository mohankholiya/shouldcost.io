/** True when a Supabase auth error is a rate-limit (HTTP 429 or an email-send-limit message). */
export function isRateLimitError(
  error: { status?: number; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.status === 429) return true;
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes("rate limit") || msg.includes("rate_limit");
}
