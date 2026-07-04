# Seed review checklist

All seed content ships `draft: true` and must not reach a public surface until a domain
expert signs it off here. Review on the internal `/design` page. Tick each item once the
line-item structure, index bindings, benchmark rates, and practitioner notes are validated.

## Indices (10)

- [ ] `hrc_steel` — HRC hot-rolled coil ($/MT)
- [ ] `crc_steel` — Cold-rolled coil ($/MT)
- [ ] `ss316` — Stainless 316 hot-rolled ($/MT)
- [ ] `copper_lme` — Copper LME 3M ($/MT)
- [ ] `aluminum_lme` — Aluminum LME 3M ($/MT)
- [ ] `nickel_lme` — Nickel LME 3M ($/MT)
- [ ] `polysilicon` — Polysilicon spot ($/kg)
- [ ] `brent` — Brent crude ($/bbl)
- [ ] `hdpe` — HDPE blow-molding resin ($/MT)
- [ ] `fab_labor_in` — Fabricated-steel labor composite (₹/hr)

## Templates (17)

### Oil & Gas
- [ ] `octg-casing-tubing` — OCTG casing & tubing (/MT)
- [ ] `line-pipe` — Line pipe LSAW/HSAW/ERW (/MT)
- [ ] `ball-gate-valves` — Ball / gate valves (/unit)
- [ ] `wellheads-xmas-trees` — Wellheads & Christmas trees (/set)
- [ ] `centrifugal-pumps-api610` — Centrifugal pumps API 610 (/unit)
- [ ] `pressure-vessels-hx` — Pressure vessels & heat exchangers (/kg)
- [ ] `drilling-day-rates` — Drilling day rates (/day)
- [ ] `structural-steel-fabrication` — Structural steel fabrication (/MT)

### Power & Utilities
- [ ] `power-transformers` — Power transformers (/MVA)
- [ ] `hv-mv-cables` — HV/MV cables (/m)
- [ ] `switchgear-panels` — Switchgear panels (/panel)
- [ ] `solar-pv-modules` — Solar PV modules (/Wp)
- [ ] `solar-epc-bos` — Solar EPC balance-of-system (/MW)
- [ ] `wind-turbine-towers` — Wind turbine towers (/section)
- [ ] `transmission-towers` — Transmission towers (/MT)

### Services
- [ ] `epc-manhour-rate` — EPC man-hour rate buildup (/hr)
- [ ] `maintenance-shutdown` — Maintenance & shutdown services (/event)

---

Once every item above is ticked, flip `draft` to `false` for that record (or update the seed
and re-run `pnpm seed`) so Phase-3 public surfaces can consume it.
