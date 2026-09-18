import {
  selectableUnitDefinitions,
  unitLabel,
  type UnitFamily,
} from '../../domain/shared/UnitRegistry'

const FAMILY_GROUP_LABELS: Record<UnitFamily, string> = {
  volume: 'Volume',
  mass: 'Mass',
  count: 'Count',
}

function optionsForFamily(family: UnitFamily) {
  return selectableUnitDefinitions()
    .filter((definition) => definition.family === family)
    .map((definition) => ({ value: definition.key, label: definition.label }))
}

const unitSelectGroups = (['volume', 'mass', 'count'] as const).map((family) => ({
  group: FAMILY_GROUP_LABELS[family],
  items: optionsForFamily(family),
}))

/**
 * Grouped unit Select data for `currentUnit`. If the stored unit isn't in the
 * selectable list (a legacy `cup`, or any unrecognized string), a one-off
 * option is prepended so it displays and stays selected faithfully — never
 * coerced to another unit, and never offered to a row that doesn't already have it.
 */
export function unitOptionsFor(currentUnit: string) {
  const isSelectable = unitSelectGroups.some((group) =>
    group.items.some((item) => item.value === currentUnit),
  )
  if (isSelectable) return unitSelectGroups
  return [
    { group: 'Current', items: [{ value: currentUnit, label: unitLabel(currentUnit) }] },
    ...unitSelectGroups,
  ]
}
