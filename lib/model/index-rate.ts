/** value: index unit price (e.g. 650 $/MT). factor: multiplier. Returns minor units. */
export function effectiveRateMinor(indexValue: number, factor: number): number {
  return Math.round(indexValue * factor * 100);
}
