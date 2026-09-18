import { Select } from '@mantine/core'
import { shoppingSectionOptions } from '../localization/labels'
import { useLocalization } from '../localization/LocalizationContext'

export function ShoppingSectionSelect({
  value,
  onChange,
  label,
  disabled,
  size,
}: {
  value?: string
  onChange: (value: string | undefined) => void
  label?: string
  disabled?: boolean
  size?: 'xs' | 'sm' | 'md'
}) {
  const { t } = useLocalization()
  return (
    <Select
      label={label ?? t('section.label')}
      placeholder={t('section.placeholder')}
      data={shoppingSectionOptions(t, value)}
      value={value ?? null}
      onChange={(next) => onChange(next ?? undefined)}
      clearable
      disabled={disabled}
      size={size}
    />
  )
}
