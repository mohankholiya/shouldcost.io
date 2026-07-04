/** Self-test: generate a token, hit /callback, verify a session cookie is set. Usage: npx tsx scripts/test-callback.ts [email] [origin] */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv(): void {
  for (const file of [".env.local", ".env"]) {
    try {
      const txt = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const raw of txt.split("\n")) {
        const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (!m || process.env[m[1]!]) continue;
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
const origin = process.argv[3] ?? "http://localhost:3000";

async function main(): Promise<void> {
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const hashed = data.properties?.hashed_token;
  const res = await fetch(`${origin}/callback?token_hash=${hashed}&type=magiclink`, {
    redirect: "manual",
  });
  const cookies = res.headers.getSetCookie?.() ?? [];
  const hasSession = cookies.some((c) => /sb-|supabase/i.test(c));
  console.log("callback status:", res.status);
  console.log("redirect location:", res.headers.get("location"));
  console.log("session cookie set:", hasSession, `(${cookies.length} cookies)`);
}
main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
