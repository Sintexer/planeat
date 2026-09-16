import { NumberInput, Select, SimpleGrid } from '@mantine/core'
import { unitOptionsFor } from '../shared/unitOptions'
import { precisionStep } from './quantityStep'

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
    <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
      <NumberInput
        label={valueLabel}
        value={value}
        min={min}
        step={precisionStep(value, 3)}
        allowDecimal
        decimalScale={3}
        onChange={(next) => onValueChange(typeof next === 'number' ? next : '')}
      />
      <Select
        label={unitLabel}
        data={unitOptionsFor(unit)}
        value={unit}
        allowDeselect={false}
        onChange={(next) => onUnitChange(next ?? unit)}
      />
    </SimpleGrid>
  )
}
