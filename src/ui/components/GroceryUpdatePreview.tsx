import { Button, Radio, Stack, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import { useMemo, useState, type ReactNode } from 'react'
import { useServices } from '../../app/servicesContext'
import type {
  GroceryQuantityChoice,
  GroceryQuantityChange,
  GroceryUpdateChoices,
  GroceryUpdatePreview as GroceryUpdatePreviewModel,
} from '../../application/groceries/GroceryService'
import { useFormatQuantity } from '../localization/useFormatQuantity'
import { useLocalization } from '../localization/LocalizationContext'

interface GroceryUpdatePreviewProps {
  listTitle: string
  revisionDrift: boolean
  preview: GroceryUpdatePreviewModel
  onUpdate: (choices: GroceryUpdateChoices) => void
  onCreateNew: () => void
}

export function GroceryUpdatePreview({
  listTitle,
  revisionDrift,
  preview,
  onUpdate,
  onCreateNew,
}: GroceryUpdatePreviewProps) {
  const { t } = useLocalization()
  const formatQty = useFormatQuantity()
  const { quantityService } = useServices()
  const [choices, setChoices] = useState<Record<string, GroceryQuantityChoice>>({})

  const willUncheck = useMemo(() => {
    const rows: GroceryQuantityChange[] = []
    for (const row of preview.changed) {
      if (row.checked && quantityService.compare(row.to, row.from) === 1) {
        rows.push(row)
      }
    }
    for (const row of preview.overrides) {
      const choice = choices[row.key] ?? 'keep'
      const to = choice === 'keep' ? row.current : row.planned
      if (row.checked && quantityService.compare(to, row.current) === 1) {
        rows.push({
          key: row.key,
          label: row.label,
          from: row.current,
          to,
          checked: true,
        })
      }
    }
    return rows
  }, [choices, preview.changed, preview.overrides, quantityService])

  const hasLineDiffs =
    preview.added.length > 0 ||
    preview.removed.length > 0 ||
    preview.changed.length > 0 ||
    preview.overrides.length > 0

  return (
    <Stack gap="sm">
      <Text size="sm">
        {t('grocery.updateLinked')} “{listTitle}”.
        {revisionDrift ? ` ${t('grocery.updatePlanChanged')}` : ''}
      </Text>
      {!hasLineDiffs && (
        <Text size="sm" c="dimmed">
          {t('grocery.updateNoLineDiffs')}
        </Text>
      )}
      {preview.added.length > 0 && (
        <PreviewSection title={t('grocery.updateAdded')}>
          {preview.added.map((line) => (
            <QuantityRow key={line.key} label={line.label} quantity={formatQty(line.quantity)} />
          ))}
        </PreviewSection>
      )}
      {preview.changed.length > 0 && (
        <PreviewSection title={t('grocery.updateChanged')}>
          {preview.changed.map((row) => (
            <QuantityRow
              key={row.key}
              label={row.label}
              quantity={`${formatQty(row.from)} → ${formatQty(row.to)}`}
            />
          ))}
        </PreviewSection>
      )}
      {preview.removed.length > 0 && (
        <PreviewSection title={t('grocery.updateRemoved')}>
          {preview.removed.map((line) => (
            <QuantityRow key={line.key} label={line.label} quantity={formatQty(line.quantity)} />
          ))}
        </PreviewSection>
      )}
      {preview.overrides.length > 0 && (
        <PreviewSection title={t('grocery.updateOverrides')}>
          {preview.overrides.map((row) => {
            const choice = choices[row.key] ?? 'keep'
            return (
              <Stack key={row.key} gap={4}>
                <QuantityRow
                  label={row.label}
                  quantity={`${formatQty(row.current)} → ${formatQty(row.planned)}`}
                />
                <Radio.Group
                  value={choice}
                  onChange={(value) =>
                    setChoices((current) => ({
                      ...current,
                      [row.key]: value as GroceryQuantityChoice,
                    }))
                  }
                >
                  <Stack gap={4}>
                    <Radio value="keep" label={t('grocery.updateKeepQuantity')} />
                    <Radio value="use-plan" label={t('grocery.updateUsePlanned')} />
                  </Stack>
                </Radio.Group>
              </Stack>
            )
          })}
        </PreviewSection>
      )}
      {willUncheck.length > 0 && (
        <PreviewSection title={t('grocery.updateWillUncheck')}>
          {willUncheck.map((row) => (
            <QuantityRow
              key={row.key}
              label={row.label}
              quantity={`${formatQty(row.from)} → ${formatQty(row.to)}`}
            />
          ))}
        </PreviewSection>
      )}
      <Text size="sm" c="dimmed">
        {t('grocery.updateManualKept')}
        {preview.manualKeptCount > 0 ? ` (${preview.manualKeptCount})` : ''}
      </Text>
      <Button
        onClick={() =>
          onUpdate({
            quantityChoices: Object.fromEntries(
              preview.overrides.map((row) => [row.key, choices[row.key] ?? 'keep']),
            ),
          })
        }
      >
        {t('grocery.updateExisting')}
      </Button>
      <Button variant="light" onClick={onCreateNew}>
        {t('grocery.createNew')}
      </Button>
      <Button variant="default" onClick={() => modals.closeAll()}>
        {t('grocery.updateCancel')}
      </Button>
    </Stack>
  )
}

function PreviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap={4}>
      <Text size="sm" fw={600}>
        {title}
      </Text>
      {children}
    </Stack>
  )
}

function QuantityRow({ label, quantity }: { label: string; quantity: string }) {
  return (
    <Text size="sm">
      {label}
      {'  '}
      {quantity}
    </Text>
  )
}
