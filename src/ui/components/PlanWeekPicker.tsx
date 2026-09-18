import { ActionIcon, Group, Paper, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import {
  monthContainsDate,
  type LocalDate,
  type WeekStartDay,
  weeksOverlappingMonth,
} from '../../domain/shared/LocalDate'
import { formatMonthTitle, formatWeekdayHeaders } from '../localization/formatDate'
import { useLocalization } from '../localization/LocalizationContext'

interface PlanWeekPickerProps {
  year: number
  month: number
  weekStartDay: WeekStartDay
  selectedWeekStart: LocalDate
  today: LocalDate
  onMonthChange: (year: number, month: number) => void
  onSelectWeek: (weekStart: LocalDate) => void
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1)
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

export function PlanWeekPicker({
  year,
  month,
  weekStartDay,
  selectedWeekStart,
  today,
  onMonthChange,
  onSelectWeek,
}: PlanWeekPickerProps) {
  const { t, bcp47 } = useLocalization()
  const headers = formatWeekdayHeaders(weekStartDay, bcp47)
  const weeks = weeksOverlappingMonth(year, month, weekStartDay)

  return (
    <Paper withBorder p={14} radius="md">
      <Group justify="space-between" mb={10}>
        <ActionIcon
          variant="subtle"
          radius="xl"
          aria-label={t('month.prev')}
          onClick={() => {
            const next = shiftMonth(year, month, -1)
            onMonthChange(next.year, next.month)
          }}
        >
          <CaretLeft size={16} />
        </ActionIcon>
        <Text size="sm" fw={600}>
          {formatMonthTitle(year, month, bcp47)}
        </Text>
        <ActionIcon
          variant="subtle"
          radius="xl"
          aria-label={t('month.next')}
          onClick={() => {
            const next = shiftMonth(year, month, 1)
            onMonthChange(next.year, next.month)
          }}
        >
          <CaretRight size={16} />
        </ActionIcon>
      </Group>

      <SimpleGrid cols={7} spacing={4} mb={4}>
        {headers.map((label, index) => (
          <Text key={`${label}-${index}`} ta="center" fz={10} c="dimmed">
            {label}
          </Text>
        ))}
      </SimpleGrid>

      <Stack gap={2}>
        {weeks.map((week) => {
          const weekStart = week[0]
          const weekEnd = week[6]
          const selected = weekStart === selectedWeekStart
          const isPast = weekEnd < today
          return (
            <UnstyledButton
              key={weekStart}
              onClick={() => onSelectWeek(weekStart)}
              px={2}
              py={3}
              style={{
                borderRadius: 10,
                background: selected ? 'var(--mantine-color-primary-light)' : undefined,
                outline: selected ? '1px solid var(--mantine-color-primary-4)' : undefined,
              }}
            >
              <SimpleGrid cols={7} spacing={4}>
                {week.map((date) => {
                  const inMonth = monthContainsDate(date, year, month)
                  const isToday = date === today
                  return (
                    <Text
                      key={date}
                      ta="center"
                      size="xs"
                      py={5}
                      fw={isToday || selected ? 600 : 400}
                      c={
                        !inMonth ? 'dimmed' : isPast ? 'gray.5' : isToday ? 'primary.7' : undefined
                      }
                      style={{
                        borderRadius: 8,
                        background:
                          isToday && inMonth ? 'var(--mantine-color-primary-light)' : undefined,
                      }}
                    >
                      {Number(date.slice(8, 10))}
                    </Text>
                  )
                })}
              </SimpleGrid>
            </UnstyledButton>
          )
        })}
      </Stack>
    </Paper>
  )
}
