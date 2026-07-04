import type { Currency } from "@/components/number/currency-select";

const LOCALE: Record<Currency, string> = {
  USD: "en-US",
  EUR: "en-IE",
  GBP: "en-GB",
  SAR: "en-SA",
  AED: "en-AE",
  INR: "en-IN",
};

export function formatCurrency(minor: number, currency: Currency): string {
  const units = minor / 100;
  return new Intl.NumberFormat(LOCALE[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(units);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function formatIndexValue(value: number, unit: string): string {
  return `${formatNumber(value)} ${unit}`;
}
