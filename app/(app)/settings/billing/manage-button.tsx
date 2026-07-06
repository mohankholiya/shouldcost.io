"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createPortalSessionAction } from "@/lib/actions/billing";

export function ManageSubscriptionButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const { url } = await createPortalSessionAction();
      router.push(url);
    } catch {
      // Carry-forward #2: do not fail silently — surface the portal error to the user.
      toast.error("Could not open the billing portal. Please try again.");
      setBusy(false);
    }
  }
  return (
    <Button variant="secondary" disabled={busy} onClick={go}>
      {busy ? "Opening…" : "Manage subscription"}
    </Button>
  );
}
