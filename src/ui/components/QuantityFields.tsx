import { Group, NumberInput, Select } from '@mantine/core'
import { QUANTITY_UNITS } from '../../domain/shared/Quantity'

const unitOptions = QUANTITY_UNITS.map((unit) => ({ value: unit, label: unit }))

interface QuantityFieldsProps {
  valueLabel?: string
  unitLabel?: string
  value: number | ''
  unit: string
  onValueChange: (value: number | '') => void
  onUnitChange: (unit: string) => void
  min?: number
}

export function QuantityFields({
  valueLabel = 'Amount',
  unitLabel = 'Unit',
  value,
  unit,
  onValueChange,
  onUnitChange,
  min = 0.001,
}: QuantityFieldsProps) {
  return (
    <Group grow align="flex-end">
      <NumberInput
        label={valueLabel}
        value={value}
        min={min}
        step={0.01}
        allowDecimal
        decimalScale={3}
        onChange={(next) => onValueChange(typeof next === 'number' ? next : '')}
      />
      <Select
        label={unitLabel}
        data={unitOptions}
        value={QUANTITY_UNITS.includes(unit as (typeof QUANTITY_UNITS)[number]) ? unit : 'piece'}
        allowDeselect={false}
        onChange={(next) => onUnitChange(next ?? unit)}
      />
    </Group>
  )
}
