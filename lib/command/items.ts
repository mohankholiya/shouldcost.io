export type CommandItem = { label: string; href: string };
export type CommandGroup = { heading: string; items: CommandItem[] };

const NAV: CommandItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Projects", href: "/projects" },
  { label: "Indices", href: "/indices" },
  { label: "Settings", href: "/settings" },
];

/** Build the command-palette groups. Navigation is always present; Recent models only when non-empty. */
export function buildCommandItems({
  recentModels,
}: {
  recentModels: { id: string; name: string }[];
}): CommandGroup[] {
  const groups: CommandGroup[] = [{ heading: "Navigation", items: NAV }];
  if (recentModels.length > 0) {
    groups.push({
      heading: "Recent models",
      items: recentModels.map((m) => ({ label: m.name, href: `/models/${m.id}` })),
    });
  }
  return groups;
}
