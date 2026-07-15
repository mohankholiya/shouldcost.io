"use client";
import { useTheme } from "next-themes";
import {
  CHART_CATEGORICAL_LIGHT,
  CHART_CATEGORICAL_DARK,
  DIVERGING_LIGHT,
  DIVERGING_DARK,
} from "@/lib/chart-palette";

export function useChartColors() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return {
    categorical: dark ? CHART_CATEGORICAL_DARK : CHART_CATEGORICAL_LIGHT,
    diverging: dark ? DIVERGING_DARK : DIVERGING_LIGHT,
  };
}
