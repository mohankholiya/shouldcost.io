import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describe("RLS integration (requires cloud project + 2 seeded test users)", () => {
  beforeAll(() => {
    if (!URL || !ANON) throw new Error("Set Supabase env vars to run integration tests");
  });

  it("user A cannot read user B's project", async () => {
    const skip = !process.env.TEST_USER_A_EMAIL || !process.env.TEST_USER_B_EMAIL;
    if (skip) return; // skip silently in CI without test users
    const a = createClient(URL, ANON);
    await a.auth.signInWithPassword({
      email: process.env.TEST_USER_A_EMAIL!,
      password: process.env.TEST_USER_A_PASSWORD!,
    });
    const { data, error } = await a.from("projects").select("*");
    expect(error).toBeNull();
    expect(data?.every((p) => p.org_id !== process.env.TEST_ORG_B_ID)).toBe(true);
  });
});
