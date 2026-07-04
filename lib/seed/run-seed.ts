/**
 * Idempotent seed runner. Run with `pnpm seed` (tsx).
 *
 * Upserts 10 indices + 24 months of values, 17 category templates, and one
 * demo org with three projects/models (keyed by code/slug/name so re-runs
 * produce no duplicates).
 *
 * Uses the service-role key directly rather than lib/supabase/admin.ts: that
 * module is guarded with `server-only`, which throws when imported from a plain
 * Node/tsx process. tsx also does not auto-load .env.local, so we load it here.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { INDICES, generateIndexValues } from "./indices";
import { ALL_TEMPLATES } from "./templates";
import { DEMO_ORG } from "./demo-org";

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
      // file absent — rely on the ambient environment
    }
  }
}

loadEnv();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set them in .env.local).",
  );
  process.exit(1);
}

const db = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });

async function main(): Promise<void> {
  // 1. Indices + 24-month values (upsert by code / by index_id+date).
  for (const i of INDICES) {
    const { data, error } = await db
      .from("indices")
      .upsert(
        {
          code: i.code,
          name: i.name,
          unit: i.unit,
          currency: i.currency,
          region: i.region,
          source_note: i.source_note,
          draft: true,
        },
        { onConflict: "code" },
      )
      .select("id")
      .single();
    if (error) throw error;
    const rows = generateIndexValues(i.code).map((v) => ({
      index_id: data!.id,
      date: v.date,
      value: v.value,
    }));
    const { error: valErr } = await db
      .from("index_values")
      .upsert(rows, { onConflict: "index_id,date" });
    if (valErr) throw valErr;
  }
  console.log(`Upserted ${INDICES.length} indices with 24-month series.`);

  // 2. Category templates (upsert by slug).
  for (const t of ALL_TEMPLATES) {
    const { error } = await db.from("category_templates").upsert(
      {
        slug: t.slug,
        industry: t.industry,
        name: t.name,
        unit: t.unit,
        description: t.description,
        cbs_json: t.cbs_json,
        practitioner_notes: t.practitioner_notes,
        is_public: t.is_public,
        draft: t.draft,
      },
      { onConflict: "slug" },
    );
    if (error) throw error;
  }
  console.log(`Upserted ${ALL_TEMPLATES.length} category templates.`);

  // 3. Demo org (idempotent by is_demo + name).
  const { data: existing } = await db
    .from("organizations")
    .select("id")
    .eq("name", DEMO_ORG.name)
    .eq("is_demo", true)
    .maybeSingle();

  if (existing) {
    console.log("Demo org already present — skipping.");
  } else {
    const { data: org, error: orgErr } = await db
      .from("organizations")
      .insert({ name: DEMO_ORG.name, plan: "team", is_demo: true })
      .select("id")
      .single();
    if (orgErr) throw orgErr;

    const templateBySlug = new Map(ALL_TEMPLATES.map((t) => [t.slug, t]));

    for (const p of DEMO_ORG.projects) {
      const { data: proj, error: projErr } = await db
        .from("projects")
        .insert({ org_id: org!.id, name: p.name })
        .select("id")
        .single();
      if (projErr) throw projErr;

      for (const m of p.models) {
        const template = templateBySlug.get(m.template_slug);
        const { data: model, error: modelErr } = await db
          .from("cost_models")
          .insert({
            project_id: proj!.id,
            name: m.name,
            currency: "USD",
            fx_rate: 1,
            status: "active",
          })
          .select("id")
          .single();
        if (modelErr) throw modelErr;

        if (m.should_cost_minor > 0) {
          const { error: verErr } = await db.from("model_versions").insert({
            model_id: model!.id,
            version_no: 1,
            snapshot_json: { seed: true, cbs: template?.cbs_json ?? null },
            total_cost: m.should_cost_minor,
            note: "Seeded baseline",
          });
          if (verErr) throw verErr;
        }

        if (m.quote_minor > 0) {
          const { error: quoteErr } = await db.from("quotes").insert({
            model_id: model!.id,
            supplier_name: m.supplier,
            currency: "USD",
            quoted_total: m.quote_minor,
          });
          if (quoteErr) throw quoteErr;
        }
      }
    }
    console.log("Demo org created.");
  }

  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
