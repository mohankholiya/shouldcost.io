"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { allComplete, type OnboardingStep } from "@/lib/onboarding/steps";

const DISMISS_KEY = "sc_onboarding_dismissed";

/** Dashboard get-started nudge. Hidden once all steps are done or the user dismisses it. */
export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  // Default hidden until localStorage is read on the client — avoids a dismissed-card flash.
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (dismissed || allComplete(steps)) return null;
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Surface padding="lg" radius="lg" className="mb-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">
          Get started · {doneCount}/{steps.length}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setDismissed(true);
          }}
        >
          Dismiss
        </Button>
      </div>
      <ul className="mt-3 space-y-2">
        {steps.map((s) => (
          <li key={s.id} className="flex items-center gap-3 text-sm">
            <span
              aria-hidden
              className={`flex size-5 items-center justify-center rounded-full border ${
                s.done ? "border-favor bg-favor text-white" : "border-hairline text-transparent"
              }`}
            >
              <Check className="size-3" />
            </span>
            {s.done ? (
              <span className="text-muted-foreground line-through">{s.label}</span>
            ) : (
              <Link href={s.href} className="hover:underline">
                {s.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Surface>
  );
}
