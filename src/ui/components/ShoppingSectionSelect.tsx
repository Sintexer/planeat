import { Select } from '@mantine/core'
import { shoppingSectionSelectOptions } from '../../domain/groceries/shoppingSections'

export function ShoppingSectionSelect({
  value,
  onChange,
  label = 'Shopping section',
  disabled,
  size,
}: {
  value?: string
  onChange: (value: string | undefined) => void
  label?: string
  disabled?: boolean
  size?: 'xs' | 'sm' | 'md'
}) {
  return (
    <Select
      label={label}
      placeholder="None — shown under Other"
      data={shoppingSectionSelectOptions(value)}
      value={value ?? null}
      onChange={(next) => onChange(next ?? undefined)}
      clearable
      disabled={disabled}
      size={size}
    />
  )
}
