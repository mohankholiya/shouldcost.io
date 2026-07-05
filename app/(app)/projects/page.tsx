import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { NewProjectButton } from "@/components/shared/new-project-button";
import { Surface } from "@/components/ui/surface";

type ProjectRow = { id: string; name: string };

export default async function ProjectsPage() {
  const supabase = await createServerClient();
  const { data } = await supabase.from("projects").select("id, name").order("created_at");
  const projects = (data ?? []) as ProjectRow[];

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="Groups of related cost models"
        actions={<NewProjectButton />}
      />
      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          steps={["Create a project", "Add a cost model from a template", "Invite your team"]}
          cta={<NewProjectButton />}
        />
      ) : (
        <Surface as="ul" padding="none" className="divide-y divide-hairline overflow-hidden">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/projects/${p.id}`} className="block px-4 py-3 hover:bg-accent">
                {p.name}
              </Link>
            </li>
          ))}
        </Surface>
      )}
    </>
  );
}
