import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

type ProjectRow = { id: string; name: string };

export default async function ProjectsPage() {
  const supabase = await createServerClient();
  const { data } = await supabase.from("projects").select("id, name").order("created_at");
  const projects = (data ?? []) as ProjectRow[];

  return (
    <>
      <PageHeader title="Projects" subtitle="Groups of related cost models" />
      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          steps={["Create a project", "Add a cost model from a template", "Invite your team"]}
        />
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-md border border-hairline">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/projects/${p.id}`} className="block px-4 py-3 hover:bg-petrol-50">
                {p.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
