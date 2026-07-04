/** Ensures a user has a personal org + admin membership. Usage: npx tsx scripts/ensure-org.ts [email] */
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
  if (!user) throw new Error(`no user for ${email}`);

  const { data: existing } = await db.from("org_members").select("org_id").eq("user_id", user.id);
  if (existing?.length) {
    console.log("already has org membership — nothing to do");
    return;
  }
  const { data: org, error } = await db
    .from("organizations")
    .insert({ name: user.email ?? "My workspace", plan: "free" })
    .select("id")
    .single();
  if (error) throw error;
  const { error: mErr } = await db
    .from("org_members")
    .insert({ org_id: org!.id, user_id: user.id, role: "admin" });
  if (mErr) throw mErr;
  console.log(`created org + admin membership for ${email}`);
}
main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
