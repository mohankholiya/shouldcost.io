export type DemoModel = {
  name: string;
  template_slug: string;
  should_cost_minor: number;
  quote_minor: number;
  supplier: string;
};

export type DemoProject = { name: string; models: DemoModel[] };

/**
 * A masked demo org so the Phase-0 dashboard already tells a story: an OCTG
 * model at ~$1,760/MT should-cost challenged against a $2,150/MT quote, plus a
 * transformer model and an in-flight EPC rate library. Flagged is_demo — not
 * counted against free-tier limits.
 */
export const DEMO_ORG: { name: string; is_demo: boolean; projects: DemoProject[] } = {
  name: "Westmark Energy",
  is_demo: true,
  projects: [
    {
      name: "OCTG — Annual Framework",
      models: [
        {
          name: 'OCTG Casing 9-5/8" L80',
          template_slug: "octg-casing-tubing",
          should_cost_minor: 176021,
          quote_minor: 215000,
          supplier: "Supplier A",
        },
      ],
    },
    {
      name: "Substation Build-out",
      models: [
        {
          name: "Power transformer 150 MVA",
          template_slug: "power-transformers",
          should_cost_minor: 6792400,
          quote_minor: 0,
          supplier: "",
        },
      ],
    },
    {
      name: "EPC Rate Library",
      models: [
        {
          name: "Man-hour rates (representative)",
          template_slug: "epc-manhour-rate",
          should_cost_minor: 4600,
          quote_minor: 0,
          supplier: "",
        },
      ],
    },
  ],
};
