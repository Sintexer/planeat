import {
  addDays,
  startOfWeek,
  type LocalDate,
  type WeekStartDay,
} from '../../domain/shared/LocalDate'
import type { MessageId } from './messages'
import type { Translate } from './t'

export type PlanWeekRelation =
  | { kind: 'this' }
  | { kind: 'last' }
  | { kind: 'next' }
  | { kind: 'range'; start: LocalDate; end: LocalDate }

export function planWeekRelation(
  weekStart: LocalDate,
  today: LocalDate,
  weekStartDay: WeekStartDay,
): PlanWeekRelation {
  const thisWeek = startOfWeek(today, weekStartDay)
  if (weekStart === thisWeek) return { kind: 'this' }
  if (weekStart === addDays(thisWeek, -7)) return { kind: 'last' }
  if (weekStart === addDays(thisWeek, 7)) return { kind: 'next' }
  return { kind: 'range', start: weekStart, end: addDays(weekStart, 6) }
}

export function formatWeekday(
  day: WeekStartDay,
  locale: string,
  weekday: 'long' | 'short' | 'narrow' = 'long',
): string {
  const date = new Date(2020, 0, 5 + day)
  return new Intl.DateTimeFormat(locale, { weekday }).format(date)
}

export function formatWeekdayHeaders(weekStartDay: WeekStartDay, locale: string): string[] {
  return Array.from({ length: 7 }, (_, index) =>
    formatWeekday(((weekStartDay + index) % 7) as WeekStartDay, locale, 'short'),
  )
}

export function formatMonthTitle(year: number, month: number, locale: string): string {
  return new Date(year, month - 1, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  })
}

export function formatLocalDateShort(date: LocalDate, locale: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

export function formatWeekdayOfDate(
  date: LocalDate,
  locale: string,
  weekday: 'long' | 'short' = 'short',
): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(locale, { weekday })
}

export function formatPlanWeekLabel(
  relation: PlanWeekRelation,
  locale: string,
  t: Translate,
): string {
  if (relation.kind === 'this') return t('week.this')
  if (relation.kind === 'last') return t('week.last')
  if (relation.kind === 'next') return t('week.next')
  return `${formatLocalDateShort(relation.start, locale)} – ${formatLocalDateShort(relation.end, locale)}`
}

export function formatPlanDayHeading(date: LocalDate, locale: string): string {
  return `${formatWeekdayOfDate(date, locale, 'short')} ${date}`
}

export function formatDateTime(timestamp: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(timestamp),
  )
}

export const WEEK_RELATION_MESSAGE: Record<'this' | 'last' | 'next', MessageId> = {
  this: 'week.this',
  last: 'week.last',
  next: 'week.next',
}
