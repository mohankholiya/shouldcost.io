import type { CategoryTemplate } from "./_build";
import { OCTG_TEMPLATE } from "./octg-casing-tubing";
import {
  LinePipeTemplate,
  BallGateValvesTemplate,
  WellheadsXmasTreesTemplate,
  CentrifugalPumpsTemplate,
  PressureVesselsTemplate,
  DrillingDayRatesTemplate,
  StructuralSteelTemplate,
} from "./oil-gas";
import {
  PowerTransformersTemplate,
  HvMvCablesTemplate,
  SwitchgearPanelsTemplate,
  SolarPvModulesTemplate,
  SolarEpcBosTemplate,
  WindTurbineTowersTemplate,
  TransmissionTowersTemplate,
} from "./power";
import { EpcManhourRateTemplate, MaintenanceShutdownTemplate } from "./services";

export type { CategoryTemplate } from "./_build";

export const ALL_TEMPLATES: CategoryTemplate[] = [
  OCTG_TEMPLATE,
  LinePipeTemplate,
  BallGateValvesTemplate,
  WellheadsXmasTreesTemplate,
  CentrifugalPumpsTemplate,
  PressureVesselsTemplate,
  DrillingDayRatesTemplate,
  StructuralSteelTemplate,
  PowerTransformersTemplate,
  HvMvCablesTemplate,
  SwitchgearPanelsTemplate,
  SolarPvModulesTemplate,
  SolarEpcBosTemplate,
  WindTurbineTowersTemplate,
  TransmissionTowersTemplate,
  EpcManhourRateTemplate,
  MaintenanceShutdownTemplate,
];
