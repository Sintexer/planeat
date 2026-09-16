/**
 * Step size for a NumberInput's up/down buttons, matching the value's own precision
 * (2 → step 1, 0.1 → step 0.1, 0.002 → step 0.001) instead of a fixed fraction.
 */
export function precisionStep(value: number | '', maxDecimals: number): number {
  if (value === '' || !Number.isFinite(value)) return 1
  const decimals = value.toFixed(maxDecimals).replace(/0+$/, '').split('.')[1]?.length ?? 0
  return decimals === 0 ? 1 : Number((10 ** -decimals).toFixed(decimals))
}
