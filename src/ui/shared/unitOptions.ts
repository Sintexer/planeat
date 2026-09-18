import { selectableUnitDefinitions, type UnitFamily } from '../../domain/shared/UnitRegistry'
import type { MessageId } from '../localization/messages'
import { unitDisplayLabel } from '../localization/labels'
import type { Translate } from '../localization/t'

const FAMILY_IDS: Record<UnitFamily, MessageId> = {
  volume: 'unitFamily.volume',
  mass: 'unitFamily.mass',
  count: 'unitFamily.count',
}

const FAMILIES: UnitFamily[] = ['volume', 'mass', 'count']

export function unitOptionsFor(currentUnit: string, t: Translate) {
  const unitSelectGroups = FAMILIES.map((family) => ({
    group: t(FAMILY_IDS[family]),
    items: selectableUnitDefinitions()
      .filter((definition) => definition.family === family)
      .map((definition) => ({
        value: definition.key,
        label: unitDisplayLabel(t, definition.key),
      })),
  }))
  const isSelectable = unitSelectGroups.some((group) =>
    group.items.some((item) => item.value === currentUnit),
  )
  if (isSelectable) return unitSelectGroups
  return [
    {
      group: t('unitFamily.current'),
      items: [{ value: currentUnit, label: unitDisplayLabel(t, currentUnit) }],
    },
    ...unitSelectGroups,
  ]
}
