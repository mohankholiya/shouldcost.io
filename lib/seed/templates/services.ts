import { group, line, idxLine, formula, type CategoryTemplate } from "./_build";

export const EpcManhourRateTemplate: CategoryTemplate = {
  slug: "epc-manhour-rate",
  industry: "Services",
  name: "EPC man-hour rate buildup",
  unit: "/hr",
  description:
    "Should-cost per fully-burdened EPC man-hour. Representative buildup; country benchmarks (India, KSA, UAE, US Gulf, EU) vary the base wage and burden.",
  practitioner_notes:
    "Contractors quote an all-in rate and resist unbundling — force the base wage, statutory burden, benefits and per-diem apart, then apply a defensible productivity factor for the country. The India base anchors to the fab-labor index; KSA/UAE add mobilization and camp, US Gulf and EU add far higher base wages. The single number here is illustrative; the per-country matrix is a Phase-1 view.",
  is_public: true,
  draft: true,
  cbs_json: group("EPC man-hour (per hr, representative)", [
    group("Base wage", [idxLine("Base skilled wage", 1, 20, "fab_labor_in")]),
    group("Burden", [line("Statutory payroll burden", 1, 8)]),
    group("Benefits", [line("Benefits & insurance", 1, 5)]),
    group("Per diem", [line("Per diem & camp", 1, 4)]),
    group("Overhead", [formula("Site overhead", "10% margin")]),
    group("SG&A", [formula("Selling, general & admin", "5% margin")]),
    group("Margin", [formula("Contractor margin", "8% margin")]),
  ]),
};

export const MaintenanceShutdownTemplate: CategoryTemplate = {
  slug: "maintenance-shutdown",
  industry: "Services",
  name: "Maintenance & shutdown services",
  unit: "/event",
  description: "Should-cost per turnaround event — mobilization through subcontract.",
  practitioner_notes:
    "Direct labour hours are the swing cost — get the crew size and duration, not a lump. Equipment rental should be a day-rate pass-through; consumables track the work scope. Fuel-exposed lines move with Brent. Subcontractor scope is where scope-creep margin lives, so fix it to a defined boundary before the event.",
  is_public: true,
  draft: true,
  cbs_json: group("Maintenance / shutdown (per event)", [
    group("Mobilization", [line("Crew mobilization", 1, 15000)]),
    group("Direct labor", [idxLine("Direct labor (hours)", 1, 40000, "fab_labor_in")]),
    group("Equipment", [line("Equipment rental", 1, 20000)]),
    group("Consumables", [idxLine("Consumables (fuel-exposed)", 1, 12000, "brent")]),
    group("Subcontract", [line("Subcontractor scope", 1, 18000)]),
    group("Overhead", [formula("Site overhead", "5% margin")]),
    group("Margin", [formula("Contractor margin", "8% margin")]),
  ]),
};
