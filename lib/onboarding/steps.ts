export type OnboardingStep = { id: string; label: string; done: boolean; href: string };

/** Derive onboarding progress from real portfolio counts — no dedicated tracking table. */
export function deriveOnboardingSteps({
  modelCount,
  quoteCount,
}: {
  modelCount: number;
  quoteCount: number;
}): OnboardingStep[] {
  const hasModel = modelCount > 0;
  const hasQuote = quoteCount > 0;
  return [
    { id: "create-model", label: "Create your first cost model", done: hasModel, href: "/projects" },
    { id: "add-quote", label: "Add a supplier quote", done: hasQuote, href: "/projects" },
    { id: "run-compare", label: "Run a quote comparison", done: hasQuote, href: "/projects" },
  ];
}

export function allComplete(steps: OnboardingStep[]): boolean {
  return steps.every((s) => s.done);
}
