import { group, line, idxLine, formula, type CategoryTemplate } from "./_build";

export const PowerTransformersTemplate: CategoryTemplate = {
  slug: "power-transformers",
  industry: "Power & Utilities",
  name: "Power transformers",
  unit: "/MVA",
  description: "Should-cost per MVA — CRGO core and copper windings through test.",
  practitioner_notes:
    "Two commodities drive this: CRGO core steel and copper. Get the core weight and the conductor weight and price them against index — everything else is conversion. Beware 'design margin' padding on active materials; a 150 MVA unit has a well-known core-to-copper ratio, so an outlier bid is a red flag, not a premium.",
  is_public: true,
  draft: true,
  cbs_json: group("Power transformer (per MVA)", [
    group("Core", [idxLine("CRGO core steel", 5, 3200, "ss316")]),
    group("Windings", [idxLine("Copper windings", 3, 9500, "copper_lme")]),
    group("Oil", [line("Insulating oil", 1, 3000)]),
    group("Tank", [line("Tank fabrication", 1, 5000)]),
    group("Assembly", [line("Assembly & drying", 1, 3000)]),
    group("Testing", [line("Routine & type test", 1, 2000)]),
    group("Overhead", [formula("Manufacturing overhead", "4% margin")]),
    group("SG&A", [formula("Selling, general & admin", "4% margin")]),
    group("Margin", [formula("Supplier margin", "6% margin")]),
    group("Logistics", [line("Freight & insurance", 1, 2000)]),
  ]),
};

export const HvMvCablesTemplate: CategoryTemplate = {
  slug: "hv-mv-cables",
  industry: "Power & Utilities",
  name: "HV/MV cables",
  unit: "/m",
  description: "Should-cost per metre — conductor through drum and test.",
  practitioner_notes:
    "Conductor metal (copper or aluminium) is the cost — index it and challenge the cross-section against the electrical spec, since over-sizing is a quiet margin lever. XLPE and armour are conversion; the drum is a returnable asset and should not carry new-asset cost on every order.",
  is_public: true,
  draft: true,
  cbs_json: group("HV/MV cable (per m)", [
    group("Conductor", [idxLine("Copper conductor", 3, 9.5, "copper_lme")]),
    group("Insulation", [line("XLPE insulation", 1, 12)]),
    group("Bedding", [line("Bedding", 1, 3)]),
    group("Armoring", [idxLine("Armour wire (Al)", 1, 8, "aluminum_lme")]),
    group("Sheath", [line("Outer sheath", 1, 4)]),
    group("Drum", [line("Drum (amortized)", 1, 2)]),
    group("Testing", [line("Routine test", 1, 1.5)]),
    group("Overhead", [formula("Manufacturing overhead", "5% margin")]),
    group("SG&A", [formula("Selling, general & admin", "4% margin")]),
    group("Margin", [formula("Supplier margin", "8% margin")]),
  ]),
};

export const SwitchgearPanelsTemplate: CategoryTemplate = {
  slug: "switchgear-panels",
  industry: "Power & Utilities",
  name: "Switchgear panels",
  unit: "/panel",
  description: "Should-cost per panel — enclosure and busbar through FAT.",
  practitioner_notes:
    "Breakers and protection relays are bought-out branded items — get the OEM price and separate the panel-builder's mark-up. Copper busbar tracks LME; the enclosure is CRC sheet. Wiring labour is real but is the usual home for schedule padding, so benchmark it against points-terminated.",
  is_public: true,
  draft: true,
  cbs_json: group("Switchgear panel (per panel)", [
    group("Enclosure", [idxLine("CRC enclosure", 1, 3000, "crc_steel")]),
    group("Busbar", [idxLine("Copper busbar", 1, 8000, "copper_lme")]),
    group("Breakers", [line("Breakers (bought-out)", 1, 9000)]),
    group("Instrument transformers", [line("CT / PT", 1, 3000)]),
    group("Wiring", [line("Control wiring & labor", 1, 2500)]),
    group("Assembly", [line("Assembly", 1, 2000)]),
    group("Testing", [line("Factory acceptance test", 1, 1000)]),
    group("Overhead", [formula("Manufacturing overhead", "5% margin")]),
    group("SG&A", [formula("Selling, general & admin", "4% margin")]),
    group("Margin", [formula("Supplier margin", "8% margin")]),
    group("Logistics", [line("Freight", 1, 500)]),
  ]),
};

export const SolarPvModulesTemplate: CategoryTemplate = {
  slug: "solar-pv-modules",
  industry: "Power & Utilities",
  name: "Solar PV modules",
  unit: "/Wp",
  description: "Should-cost per watt-peak — polysilicon through module assembly.",
  practitioner_notes:
    "Polysilicon has fallen hard — a module price that hasn't moved with the poly index is carrying stale margin. Glass, EVA and the aluminium frame are the other real lines; wafer and cell conversion should be benchmarked per watt against tier-1 fabs, not accepted as a lump.",
  is_public: true,
  draft: true,
  cbs_json: group("Solar PV module (per Wp)", [
    group("Polysilicon", [idxLine("Polysilicon", 1, 0.06, "polysilicon")]),
    group("Wafer", [line("Wafer", 1, 0.03)]),
    group("Cell", [line("Cell processing", 1, 0.04)]),
    group("Glass", [line("Front glass", 1, 0.02)]),
    group("Encapsulant", [line("EVA / backsheet", 1, 0.02)]),
    group("Frame", [idxLine("Aluminium frame", 1, 0.025, "aluminum_lme")]),
    group("Assembly", [line("Lamination & assembly", 1, 0.015)]),
    group("Testing", [line("Flash test", 1, 0.005)]),
    group("Overhead", [formula("Manufacturing overhead", "5% margin")]),
    group("Margin", [formula("Supplier margin", "6% margin")]),
  ]),
};

export const SolarEpcBosTemplate: CategoryTemplate = {
  slug: "solar-epc-bos",
  industry: "Power & Utilities",
  name: "Solar EPC BoS",
  unit: "/MW",
  description: "Should-cost per MW balance-of-system — structures through erection.",
  practitioner_notes:
    "Modules are excluded here — this is balance-of-system. Mounting structures track aluminium and steel; inverters are branded bought-outs with published $/W. DC/AC cabling tracks copper. Civil and erection labour are local and are where an EPC hides schedule risk, so tie them to MW installed, not to a lump.",
  is_public: true,
  draft: true,
  cbs_json: group("Solar EPC BoS (per MW)", [
    group("Structures", [idxLine("Mounting structures (Al)", 1, 80000, "aluminum_lme")]),
    group("Inverters", [line("Inverters (bought-out)", 1, 90000)]),
    group("DC cabling", [idxLine("DC cabling (Cu)", 1, 40000, "copper_lme")]),
    group("AC cabling", [line("AC cabling & transformers", 1, 35000)]),
    group("Civil", [line("Civil & foundations", 1, 50000)]),
    group("Erection", [line("Erection labor", 1, 30000)]),
    group("Overhead", [formula("Site overhead", "3% margin")]),
    group("SG&A", [formula("Selling, general & admin", "3% margin")]),
    group("Margin", [formula("EPC margin", "5% margin")]),
  ]),
};

export const WindTurbineTowersTemplate: CategoryTemplate = {
  slug: "wind-turbine-towers",
  industry: "Power & Utilities",
  name: "Wind turbine towers",
  unit: "/section",
  description: "Should-cost per tower section — plate through galvanize.",
  practitioner_notes:
    "Steel plate is the cost; rolling and welding are the conversion. Anchor the plate to HRC and challenge the plate-to-tower yield. Internal platforms, flanges and coating are add-ons that suppliers like to bundle — unbundle and benchmark each against tonnage.",
  is_public: true,
  draft: true,
  cbs_json: group("Wind tower section (per section)", [
    group("Material", [idxLine("HRC plate", 2.5, 650, "hrc_steel")]),
    group("Conversion", [line("Rolling & welding", 1, 600)]),
    group("Internals", [line("Internal platforms & ladders", 1, 200)]),
    group("Flanges", [line("Flanges", 1, 300)]),
    group("Coating", [line("Coating", 1, 150)]),
    group("Finishing", [line("Galvanize", 1, 100)]),
    group("Overhead", [formula("Manufacturing overhead", "5% margin")]),
    group("Margin", [formula("Supplier margin", "8% margin")]),
    group("Logistics", [line("Freight", 1, 100)]),
  ]),
};

export const TransmissionTowersTemplate: CategoryTemplate = {
  slug: "transmission-towers",
  industry: "Power & Utilities",
  name: "Transmission towers",
  unit: "/MT",
  description: "Should-cost per MT galvanized lattice tower — angles through galvanize.",
  practitioner_notes:
    "Galvanized angle steel is the base — index it to HRC and get the galvanizing rate per MT dipped separately. Cutting, punching and assembly are conversion and should be benchmarked per MT. Bolts and hardware are catalogue items; a premium there is unjustified.",
  is_public: true,
  draft: true,
  cbs_json: group("Transmission tower (per MT)", [
    group("Material", [idxLine("Galvanized steel angles", 1.05, 650, "hrc_steel")]),
    group("Conversion", [line("Cutting & punching", 1, 150)]),
    group("Finishing", [line("Hot-dip galvanizing", 1, 200)]),
    group("Assembly", [line("Assembly & fit-up", 1, 120)]),
    group("Hardware", [line("Bolts & hardware", 1, 100)]),
    group("Inspection", [line("Inspection", 1, 40)]),
    group("Overhead", [formula("Manufacturing overhead", "6% margin")]),
    group("SG&A", [formula("Selling, general & admin", "4% margin")]),
    group("Margin", [formula("Supplier margin", "6% margin")]),
    group("Logistics", [line("Freight", 1, 40)]),
  ]),
};
