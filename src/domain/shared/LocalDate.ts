/** Local calendar date, e.g. "2026-09-08". Never a UTC timestamp — see CLAUDE.md dates conventions. */
export type LocalDate = string

/** 0 = Sunday … 6 = Saturday (matches `Date.getDay()`). */
export type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isLocalDate(value: string): value is LocalDate {
  if (!LOCAL_DATE_RE.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

export function todayLocalDate(): LocalDate {
  return toLocalDate(new Date())
}

export function toLocalDate(date: Date): LocalDate {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseLocalDate(date: LocalDate): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const next = parseLocalDate(date)
  next.setDate(next.getDate() + days)
  return toLocalDate(next)
}

export function startOfWeek(date: LocalDate, weekStartDay: WeekStartDay): LocalDate {
  const parsed = parseLocalDate(date)
  const day = parsed.getDay()
  const delta = (day - weekStartDay + 7) % 7
  return addDays(date, -delta)
}

export function enumeratePlanDates(startDate: LocalDate, dayCount: number): LocalDate[] {
  const dates: LocalDate[] = []
  for (let i = 0; i < dayCount; i++) {
    dates.push(addDays(startDate, i))
  }
  return dates
}

export const WEEKDAY_LABELS: Record<WeekStartDay, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
}
