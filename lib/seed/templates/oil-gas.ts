import { group, line, idxLine, formula, type CategoryTemplate } from "./_build";

export const LinePipeTemplate: CategoryTemplate = {
  slug: "line-pipe",
  industry: "Oil & Gas",
  name: "Line pipe (LSAW/HSAW/ERW)",
  unit: "/MT",
  description: "Should-cost per metric ton for welded line pipe — skelp through coating.",
  practitioner_notes:
    "The steel skelp is 80%+ of the cost, so anchor it to HRC and challenge any yield above ~1.05x. Mills bundle forming, welding and hydrotest into one 'conversion' number — unbundle it; ERW conversion should sit well below SAW. 3LPE coating is a favourite margin-padding line: price it per m2 of surface, not as a lump sum.",
  is_public: true,
  draft: true,
  cbs_json: group("Line pipe (per MT)", [
    group("Material", [idxLine("HRC plate / skelp", 1.03, 650, "hrc_steel")]),
    group("Conversion", [
      line("SAW/ERW forming", 1, 90),
      line("Weld seam", 1, 60),
      line("Hydrostatic test", 1, 40),
    ]),
    group("Coating", [line("3LPE coating", 1, 70)]),
    group("Overhead", [formula("Manufacturing overhead", "10% of conversion")]),
    group("SG&A", [formula("Selling, general & admin", "5% margin")]),
    group("Margin", [formula("Supplier margin", "9% margin")]),
    group("Logistics", [line("Inland freight + port", 1, 35)]),
  ]),
};

export const BallGateValvesTemplate: CategoryTemplate = {
  slug: "ball-gate-valves",
  industry: "Oil & Gas",
  name: "Ball / gate valves",
  unit: "/unit",
  description: "Should-cost per valve — cast/forged body through actuation and test.",
  practitioner_notes:
    "Body castings track stainless; get the pour weight and challenge scrap. Trim and actuation are where suppliers hide margin — an actuator is a bought-out item with a published list price, so demand the pass-through and their mark-up separately. API 6D hydrotest is cheap; don't let it carry a four-figure line.",
  is_public: true,
  draft: true,
  cbs_json: group("Ball / gate valve (per unit)", [
    group("Material", [
      idxLine("Cast body (SS316)", 0.8, 3200, "ss316"),
      idxLine("Gate / ball trim (CRC)", 0.3, 780, "crc_steel"),
    ]),
    group("Machining", [line("Body & trim machining", 1, 600)]),
    group("Actuation", [line("Actuator + mounting kit", 1, 900)]),
    group("Assembly", [line("Assembly & seat fitting", 1, 300)]),
    group("Testing", [line("API 6D hydrotest", 1, 150)]),
    group("Coating", [line("Paint / coating", 1, 120)]),
    group("Overhead", [formula("Manufacturing overhead", "6% margin")]),
    group("SG&A", [formula("Selling, general & admin", "5% margin")]),
    group("Margin", [formula("Supplier margin", "10% margin")]),
    group("Logistics", [line("Packing + freight", 1, 200)]),
  ]),
};

export const WellheadsXmasTreesTemplate: CategoryTemplate = {
  slug: "wellheads-xmas-trees",
  industry: "Oil & Gas",
  name: "Wellheads & Christmas trees",
  unit: "/set",
  description: "Should-cost per surface wellhead + tree set — forgings through API 6A test.",
  practitioner_notes:
    "This is a forging and machining game, not a materials game — the SS316 body weight is modest but the machining hours are large, so attack the shop rate and cycle time, not the alloy. Valves are bought-out; make the supplier show the sub-vendor price. API 6A qualification testing is real cost but is often double-counted against both body and assembly.",
  is_public: true,
  draft: true,
  cbs_json: group("Wellhead & tree (per set)", [
    group("Material", [idxLine("Forged SS316 body & flanges", 15, 3200, "ss316")]),
    group("Machining", [line("CNC machining", 1, 20000)]),
    group("Forging", [line("Forging & heat treat", 1, 15000)]),
    group("Assembly", [line("Assembly & valve integration", 1, 8000)]),
    group("Testing", [line("API 6A pressure test", 1, 6000)]),
    group("Coating", [line("Coating & preservation", 1, 3000)]),
    group("Overhead", [formula("Manufacturing overhead", "6% margin")]),
    group("SG&A", [formula("Selling, general & admin", "5% margin")]),
    group("Margin", [formula("Supplier margin", "8% margin")]),
    group("Logistics", [line("Crating + freight", 1, 3000)]),
  ]),
};

export const CentrifugalPumpsTemplate: CategoryTemplate = {
  slug: "centrifugal-pumps-api610",
  industry: "Oil & Gas",
  name: "Centrifugal pumps (API 610)",
  unit: "/unit",
  description: "Should-cost per API 610 pump — casing casting through string test.",
  practitioner_notes:
    "The mechanical seal and the driver are bought-out and often the biggest single lines — insist on the seal (John Crane / Flowserve) and motor list prices and treat everything above as documented mark-up. Casing casting tracks stainless; impeller trim is where efficiency claims hide, so tie any premium to a witnessed performance test.",
  is_public: true,
  draft: true,
  cbs_json: group("API 610 pump (per unit)", [
    group("Material", [
      idxLine("Casing casting (SS316)", 3, 3200, "ss316"),
      idxLine("Impeller / trim (CRC)", 2.5, 780, "crc_steel"),
    ]),
    group("Casting", [line("Casting & finishing", 1, 3000)]),
    group("Machining", [line("Machining", 1, 5000)]),
    group("Seal", [line("Mechanical seal (bought-out)", 1, 2500)]),
    group("Motor", [line("API motor / driver (bought-out)", 1, 6000)]),
    group("Assembly", [line("Assembly", 1, 1500)]),
    group("Testing", [line("Performance / string test", 1, 1000)]),
    group("Overhead", [formula("Manufacturing overhead", "5% margin")]),
    group("SG&A", [formula("Selling, general & admin", "5% margin")]),
    group("Margin", [formula("Supplier margin", "8% margin")]),
    group("Logistics", [line("Packing + freight", 1, 800)]),
  ]),
};

export const PressureVesselsTemplate: CategoryTemplate = {
  slug: "pressure-vessels-hx",
  industry: "Oil & Gas",
  name: "Pressure vessels & heat exchangers",
  unit: "/kg",
  description: "Should-cost per kg fabricated — plate through PWHT and hydrotest.",
  practitioner_notes:
    "Price this per fabricated kg, not per vessel — that is how you compare bids across geometries. Welding hours dominate; benchmark deposition rate and reject any 'complexity factor' that isn't tied to joint count and thickness. PWHT and NDT are fixed-ish and get inflated on thin shells.",
  is_public: true,
  draft: true,
  cbs_json: group("Pressure vessel (per kg fabricated)", [
    group("Material", [idxLine("HRC plate", 1.1, 1.0, "hrc_steel")]),
    group("Forming", [line("Plate cutting & forming", 1, 1.5)]),
    group("Welding", [line("Welding (labor hours)", 1, 2.5)]),
    group("Nozzles", [line("Nozzles & internals", 1, 0.8)]),
    group("NDT", [line("Radiography / NDT", 1, 0.5)]),
    group("PWHT", [line("Post-weld heat treatment", 1, 0.4)]),
    group("Testing", [line("Hydrotest", 1, 0.3)]),
    group("Overhead", [formula("Manufacturing overhead", "8% margin")]),
    group("SG&A", [formula("Selling, general & admin", "5% margin")]),
    group("Margin", [formula("Supplier margin", "9% margin")]),
  ]),
};

export const DrillingDayRatesTemplate: CategoryTemplate = {
  slug: "drilling-day-rates",
  industry: "Oil & Gas",
  name: "Drilling day rates",
  unit: "/day",
  description: "Should-cost per operating day — rig amortization through fuel and crew.",
  practitioner_notes:
    "Break the day rate into its cost blocks and stop negotiating a single number. Rig capital is a sunk amortization — hold the contractor to a defensible utilization (days/year) rather than their inflated recovery. Fuel should be a transparent pass-through indexed to Brent, not a fixed line that pockets the spread when oil falls.",
  is_public: true,
  draft: true,
  cbs_json: group("Drilling day rate (per day)", [
    group("Rig CAPEX", [line("Rig capital amortization", 1, 12000)]),
    group("Crew", [line("Crew wages & rotation", 1, 6000)]),
    group("Consumables", [line("Mud, bits & consumables", 1, 3000)]),
    group("Fuel", [idxLine("Fuel & power (Brent-linked)", 1, 4000, "brent")]),
    group("Maintenance", [line("Maintenance & spares", 1, 2000)]),
    group("SG&A", [formula("Selling, general & admin", "5% margin")]),
    group("Margin", [formula("Contractor margin", "8% margin")]),
  ]),
};

export const StructuralSteelTemplate: CategoryTemplate = {
  slug: "structural-steel-fabrication",
  industry: "Oil & Gas",
  name: "Structural steel fabrication",
  unit: "/MT",
  description: "Should-cost per MT fabricated structural steel — sections through coating.",
  practitioner_notes:
    "Sections track HRC; fab labor tracks the local welder rate (here India), so a bid from a high-cost yard should be challenged on hours, not on steel. Galvanizing is priced per MT dipped and is frequently marked up — get the zinc consumption and the local dipping rate.",
  is_public: true,
  draft: true,
  cbs_json: group("Structural steel (per MT)", [
    group("Material", [idxLine("HRC sections", 1.05, 650, "hrc_steel")]),
    group("Conversion", [
      line("Cut & drill", 1, 120),
      idxLine("Weld (fab labor)", 1, 150, "fab_labor_in"),
    ]),
    group("Finishing", [line("Galvanize / paint", 1, 200)]),
    group("Inspection", [line("Dimensional & NDT", 1, 40)]),
    group("Overhead", [formula("Manufacturing overhead", "8% of conversion")]),
    group("SG&A", [formula("Selling, general & admin", "5% margin")]),
    group("Margin", [formula("Supplier margin", "6% margin")]),
    group("Logistics", [line("Freight", 1, 40)]),
  ]),
};
