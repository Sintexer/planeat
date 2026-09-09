/** Workload heuristic: 1 dish = 1.0, each additional batch dish +0.5. */
export function effortUnits(cookingEventCount: number): number {
  if (cookingEventCount <= 0) return 0
  return 1 + 0.5 * (cookingEventCount - 1)
}

export function formatEffortUnits(units: number): string {
  if (Number.isInteger(units)) return String(units)
  return units.toFixed(1)
}
