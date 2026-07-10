import { NextResponse } from "next/server";
import type { Workbook } from "exceljs";
import { getCurrentOrg } from "@/lib/db/orgs";
import { findActiveSubscriptionByOrg, toSnapshot } from "@/lib/db/subscriptions";
import { resolvePlan, EntitlementError } from "@/lib/entitlements";
import { assertCanExport } from "@/lib/export/gate";
import { loadModel } from "@/lib/db/models";
import { loadNodes } from "@/lib/db/nodes";
import { loadQuotes } from "@/lib/db/quotes";
import { buildTree } from "@/lib/model/tree";
import { rollupLive } from "@/lib/model/rollup-live";
import { buildComparison } from "@/lib/model/comparison";
import { waterfallData } from "@/lib/model/waterfall";
import { evaluateInsights } from "@/lib/model/insights";
import { buildModelXlsx } from "@/lib/export/xlsx-model";
import { buildComparisonXlsx } from "@/lib/export/xlsx-comparison";
import type { Currency } from "@/components/number/currency-select";

export const runtime = "nodejs";

const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Filename-safe slug: lowercase, non-alphanumerics → single hyphen, trimmed. */
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "model";
}

/**
 * Export a should-cost model (or a model-vs-quote comparison) as XLSX. This is
 * the single server-side entry point and the REAL entitlement gate — the client
 * `ExportMenu` is UX only. Reads run through the RLS-bound cookie client, so a
 * user can only export models their org can read. PDF is deferred to Phase 3C
 * (returns 501); the UI omits the PDF link until then, so no user hits it.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const params = new URL(req.url).searchParams;
  const format = params.get("format");
  const quoteId = params.get("quoteId") ?? undefined;

  if (format !== "xlsx" && format !== "pdf") {
    return NextResponse.json({ error: "invalid_format" }, { status: 400 });
  }

  // Auth + entitlement gate (server-side is the real boundary).
  const org = await getCurrentOrg();
  if (!org?.organizations) {
    return NextResponse.redirect(new URL("/login", req.url), 302);
  }
  const isDemo = Boolean(org.organizations.is_demo);
  const sub = await findActiveSubscriptionByOrg(org.org_id);
  const plan = resolvePlan({ subscription: toSnapshot(sub), isDemo });
  try {
    assertCanExport(plan);
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.redirect(new URL("/settings/billing/upgrade", req.url), 302);
    }
    throw err;
  }

  if (format === "pdf") {
    // Spike-gated; deferred to Phase 3C. Honest, non-crashing.
    return NextResponse.json({ error: "pdf_not_implemented" }, { status: 501 });
  }

  // RLS-scoped read — null means the org cannot see this model.
  const model = await loadModel(id);
  if (!model) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const nodes = await loadNodes(id);
  const currency = model.currency as Currency;
  const rollup = rollupLive(buildTree(nodes));

  let wb: Workbook;
  let suffix = "";
  if (quoteId) {
    const quote = (await loadQuotes(id)).find((q) => q.id === quoteId);
    if (!quote) {
      return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
    }
    const comparison = buildComparison(nodes, rollup, quote);
    wb = buildComparisonXlsx({
      modelName: model.name,
      currency,
      comparison,
      waterfall: waterfallData(comparison),
      insights: evaluateInsights(comparison, currency),
      quoteSupplier: quote.supplier_name,
    });
    suffix = "-comparison";
  } else {
    wb = buildModelXlsx({ modelName: model.name, currency, nodes, rollup });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `${slugify(model.name)}${suffix}.xlsx`;
  return new Response(buffer, {
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
