import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describe("editor persistence under RLS (requires cloud project + test user)", () => {
  it("creates a project/model/node and reloads it under the user's session", async () => {
    // Skip silently unless a seeded test user is configured.
    if (!process.env.TEST_USER_A_EMAIL || !URL || !ANON) return;

    const db = createClient(URL, ANON);
    const { error: signInErr } = await db.auth.signInWithPassword({
      email: process.env.TEST_USER_A_EMAIL!,
      password: process.env.TEST_USER_A_PASSWORD!,
    });
    expect(signInErr).toBeNull();

    const { data: orgs } = await db.rpc("current_user_orgs");
    const orgId = (orgs as string[] | null)?.[0];
    expect(orgId).toBeTruthy();

    const { data: project } = await db
      .from("projects")
      .insert({ org_id: orgId, name: "IT project" })
      .select("id")
      .single();
    const { data: model } = await db
      .from("cost_models")
      .insert({ project_id: project!.id, name: "IT model", currency: "USD", status: "draft" })
      .select("id")
      .single();
    await db.from("cost_nodes").insert({
      model_id: model!.id,
      name: "Line",
      node_type: "line",
      rate: 12345,
      rate_source: "manual",
      sort_order: 0,
    });

    const { data: nodes } = await db.from("cost_nodes").select("*").eq("model_id", model!.id);
    expect(nodes?.length).toBe(1);
    expect(nodes?.[0]?.rate).toBe(12345);

    // cleanup (cascades to model + nodes)
    await db.from("projects").delete().eq("id", project!.id);
  });
});
