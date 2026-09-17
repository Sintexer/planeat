import { SegmentedControl, Text } from '@mantine/core'
import type { RecipeFormIngredientLine } from '../recipes/recipeForm'
import { measurementStatusForUnit } from '../recipes/recipeForm'

interface ImportLineMeasurementProps {
  line: RecipeFormIngredientLine
  onChange: (patch: Partial<RecipeFormIngredientLine>) => void
}

const CUP_OPTIONS = [
  { label: 'Keep unspecified', value: 'cup' },
  { label: 'US cup', value: 'cup-us' },
  { label: 'Metric cup', value: 'cup-metric' },
]

const OZ_OPTIONS = [
  { label: 'Unspecified', value: 'oz' },
  { label: 'Weight (oz)', value: 'oz-mass' },
  { label: 'Fluid (fl oz)', value: 'oz-fl' },
  { label: 'Leave unresolved', value: 'unresolved' },
]

function ozControlValue(line: RecipeFormIngredientLine): string {
  if (line.quantityMode === 'text' || line.measurementStatus === 'unresolved') return 'unresolved'
  if (
    line.quantityUnit === 'oz-mass' ||
    line.quantityUnit === 'oz-fl' ||
    line.quantityUnit === 'oz'
  ) {
    return line.quantityUnit
  }
  return 'oz'
}

export function ImportLineMeasurement({ line, onChange }: ImportLineMeasurementProps) {
  const showCup =
    line.quantityUnit === 'cup' ||
    line.quantityUnit === 'cup-us' ||
    line.quantityUnit === 'cup-metric' ||
    line.measurementStatus === 'ambiguous-cup'
  const showTbsp = line.quantityUnit === 'tbsp' || line.measurementStatus === 'ambiguous-tbsp'
  const showOz =
    line.measurementStatus === 'ambiguous-oz' ||
    line.quantityUnit === 'oz' ||
    line.quantityUnit === 'oz-mass' ||
    line.quantityUnit === 'oz-fl'

  return (
    <>
      {line.sourceText ? (
        <Text size="xs" c="dimmed">
          Original: {line.sourceText}
        </Text>
      ) : null}
      {showCup && line.quantityMode === 'amount' ? (
        <SegmentedControl
          size="xs"
          fullWidth
          data={CUP_OPTIONS}
          value={
            line.quantityUnit === 'cup-us' || line.quantityUnit === 'cup-metric'
              ? line.quantityUnit
              : 'cup'
          }
          onChange={(next) =>
            onChange({
              quantityUnit: next,
              measurementStatus: measurementStatusForUnit(next),
              quantityMode: 'amount',
            })
          }
        />
      ) : null}
      {showTbsp && line.quantityMode === 'amount' ? (
        <Text size="xs" c="dimmed">
          Tablespoon convention is unspecified. Keep as-is, or pick a known unit.
        </Text>
      ) : null}
      {showOz ? (
        <SegmentedControl
          size="xs"
          fullWidth
          data={OZ_OPTIONS}
          value={ozControlValue(line)}
          onChange={(next) => {
            if (next === 'unresolved') {
              const quantityText =
                line.quantityText.trim() ||
                line.sourceText ||
                (line.quantityValue === '' ? 'oz' : `${line.quantityValue} oz`)
              onChange({
                quantityMode: 'text',
                quantityText,
                measurementStatus: 'unresolved',
              })
              return
            }
            onChange({
              quantityMode: 'amount',
              quantityUnit: next,
              measurementStatus: measurementStatusForUnit(next),
            })
          }}
        />
      ) : null}
    </>
  )
}
