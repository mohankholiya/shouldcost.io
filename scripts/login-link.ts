/**
 * Generates a one-time login link via the Supabase admin API — bypasses email
 * (useful when the free-tier email rate limit is hit). Writes the URL to
 * login-link.txt so the token doesn't land in a terminal transcript.
 *
 * Usage: npx tsx scripts/login-link.ts [email] [origin]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

function loadEnv(): void {
  for (const file of [".env.local", ".env"]) {
    try {
      const txt = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const raw of txt.split("\n")) {
        const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (!m) continue;
        const key = m[1]!;
        if (process.env[key]) continue;
        let value = m[2]!.trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    } catch {
      /* ignore */
    }
  }
}

loadEnv();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const email = process.argv[2] ?? "mohan.kholiya@gmail.com";
const origin = process.argv[3] ?? "http://localhost:3000";
const db = createClient(URL, SERVICE, { auth: { persistSession: false } });

async function main(): Promise<void> {
  const { error: cErr } = await db.auth.admin.createUser({ email, email_confirm: true });
  if (cErr && !/already|registered|exists/i.test(cErr.message)) throw cErr;

  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const hashed = data.properties?.hashed_token;
  if (!hashed) throw new Error("no hashed_token returned");

  const link = `${origin}/callback?token_hash=${hashed}&type=magiclink`;
  writeFileSync("login-link.txt", link + "\n");
  // Open the default browser straight to the login link (keeps the token out of the terminal).
  try {
    execSync(`cmd /c start "" "${link}"`);
  } catch {
    /* if auto-open fails, the URL is still in login-link.txt */
  }
  console.log(`Opened your browser to log in as ${email}. (Backup URL saved in login-link.txt.)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
