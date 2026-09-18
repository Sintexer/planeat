import { SegmentedControl, Text } from '@mantine/core'
import type { RecipeFormIngredientLine } from '../recipes/recipeForm'
import { measurementStatusForUnit } from '../recipes/recipeForm'
import { useLocalization } from '../localization/LocalizationContext'

interface ImportLineMeasurementProps {
  line: RecipeFormIngredientLine
  onChange: (patch: Partial<RecipeFormIngredientLine>) => void
}

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
  const { t } = useLocalization()
  const cupOptions = [
    { label: t('import.keepUnspecified'), value: 'cup' },
    { label: t('import.usCup'), value: 'cup-us' },
    { label: t('import.metricCup'), value: 'cup-metric' },
  ]
  const ozOptions = [
    { label: t('import.unspecifiedOz'), value: 'oz' },
    { label: t('import.weightOz'), value: 'oz-mass' },
    { label: t('import.fluidOz'), value: 'oz-fl' },
    { label: t('import.leaveUnresolved'), value: 'unresolved' },
  ]
  const showCup =
    line.quantityUnit === 'cup' ||
    line.quantityUnit === 'cup-us' ||
    line.quantityUnit === 'cup-metric' ||
    line.measurementStatus === 'ambiguous-cup'
  const showOz =
    line.measurementStatus === 'ambiguous-oz' ||
    line.quantityUnit === 'oz' ||
    line.quantityUnit === 'oz-mass' ||
    line.quantityUnit === 'oz-fl'

  return (
    <>
      {line.sourceText ? (
        <Text size="xs" c="dimmed">
          {t('import.original', { text: line.sourceText })}
        </Text>
      ) : null}
      {showCup && line.quantityMode === 'amount' ? (
        <SegmentedControl
          size="xs"
          fullWidth
          data={cupOptions}
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
      {showOz ? (
        <SegmentedControl
          size="xs"
          fullWidth
          data={ozOptions}
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
