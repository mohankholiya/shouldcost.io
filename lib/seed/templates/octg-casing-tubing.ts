import type { CbsGroup } from "@/lib/seed/schema";

export const OCTG_TEMPLATE = {
  slug: "octg-casing-tubing",
  industry: "Oil & Gas",
  name: "OCTG casing & tubing",
  unit: "/MT",
  description:
    "Should-cost per metric ton for API casing & tubing — billet through threading.",
  practitioner_notes:
    "Suppliers hide margin in bundled 'conversion' charges and in scrap/yield assumptions — they'll quote 1.15x billet weight when 1.08x is realistic on a modern rolling line. Threading is routinely marked up 30-40% over what independent specialist threaders charge. Tie the steel line to the HRC index times a published conversion constant, and challenge anything above 10% margin for commodity grades.",
  is_public: true,
  draft: true,
  cbs_json: {
    name: "OCTG casing & tubing (per MT)",
    node_type: "group",
    nodes: [
      {
        name: "Material",
        node_type: "group",
        nodes: [
          {
            name: "Steel billet (HRC)",
            node_type: "line",
            driver_name: "1.08 MT/MT yield",
            quantity: 1.08,
            unit: "MT",
            rate: 650,
            rate_source: "index",
            index_code: "hrc_steel",
            nodes: [],
          },
        ],
      },
      {
        name: "Conversion",
        node_type: "group",
        nodes: [
          { name: "Piercing & rolling", node_type: "line", quantity: 1, unit: "MT", rate: 280, rate_source: "benchmark", nodes: [] },
          { name: "Heat treatment (Q&T)", node_type: "line", quantity: 1, unit: "MT", rate: 150, rate_source: "benchmark", nodes: [] },
          { name: "Threading & coupling", node_type: "line", quantity: 1, unit: "MT", rate: 220, rate_source: "benchmark", nodes: [] },
          { name: "Inspection & NDT", node_type: "line", quantity: 1, unit: "MT", rate: 60, rate_source: "benchmark", nodes: [] },
        ],
      },
      {
        name: "Overhead",
        node_type: "group",
        nodes: [
          { name: "Manufacturing overhead", node_type: "line", formula: "12% of conversion", nodes: [] },
        ],
      },
      {
        name: "SG&A",
        node_type: "group",
        nodes: [
          { name: "Selling, general & admin", node_type: "line", formula: "5% of material", nodes: [] },
        ],
      },
      {
        name: "Margin",
        node_type: "group",
        nodes: [{ name: "Supplier margin", node_type: "line", formula: "9% margin", nodes: [] }],
      },
      {
        name: "Logistics",
        node_type: "group",
        nodes: [
          { name: "Inland freight + port + duty", node_type: "line", quantity: 1, unit: "MT", rate: 90, rate_source: "benchmark", nodes: [] },
        ],
      },
    ],
  } as CbsGroup,
};
