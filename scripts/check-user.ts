/** Diagnostic: does the user exist and have an org membership? Usage: npx tsx scripts/check-user.ts [email] */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv(): void {
  for (const file of [".env.local", ".env"]) {
    try {
      const txt = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const raw of txt.split("\n")) {
        const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (!m) continue;
        if (process.env[m[1]!]) continue;
        let v = m[2]!.trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
          v = v.slice(1, -1);
        process.env[m[1]!] = v;
      }
    } catch {
      /* ignore */
    }
  }
}
loadEnv();

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const email = process.argv[2] ?? "mohan.kholiya@gmail.com";

async function main(): Promise<void> {
  const { data } = await db.auth.admin.listUsers();
  const user = data.users.find((u) => u.email === email);
  console.log("user exists:", !!user, "| id:", user?.id?.slice(0, 8) ?? "-");
  if (!user) return;
  const { data: members } = await db.from("org_members").select("org_id, role").eq("user_id", user.id);
  console.log("org_members rows:", members?.length ?? 0);
  if (members?.length) {
    const { data: orgs } = await db
      .from("organizations")
      .select("id, name")
      .in("id", members.map((m) => m.org_id));
    console.log("orgs:", orgs?.map((o) => o.name).join(", "));
  }
}
main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
