/** Every empty screen teaches the next 3 steps rather than showing a blank. */
export function EmptyState({
  title,
  steps,
  cta,
}: {
  title: string;
  steps: string[];
  cta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      <ol className="space-y-1 text-sm text-muted-foreground">
        {steps.map((s, i) => (
          <li key={i}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      {cta}
    </div>
  );
}
