import type { Currency } from "@/components/number/currency-select";

/** Minor = integer units of the smallest denomination (cents / paise). Always integer. */
export type Minor = number;

const DECIMALS: Record<Currency, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  SAR: 2,
  AED: 2,
  INR: 2,
};

/** Round half-up to the nearest integer (avoids float drift like 0.1 + 0.2). */
function roundHalfUp(n: number): number {
  return Math.sign(n) * Math.round(Math.abs(n));
}

export function toMinor(units: number, currency: Currency): Minor {
  return roundHalfUp(units * 10 ** DECIMALS[currency]);
}

export function fromMinor(minor: Minor, currency: Currency): number {
  return minor / 10 ** DECIMALS[currency];
}

/** Convert minor from one currency to another using fxRate = units(to) per 1 unit(from). */
export function convert(minor: Minor, _from: Currency, _to: Currency, fxRate: number): Minor {
  return roundHalfUp(minor * fxRate);
}

export function add(a: Minor, b: Minor): Minor {
  return a + b;
}

export function multiply(minor: Minor, factor: number): Minor {
  return roundHalfUp(minor * factor);
}

export function formatMinorInput(minor: Minor): string {
  return (minor / 100).toFixed(2);
}
