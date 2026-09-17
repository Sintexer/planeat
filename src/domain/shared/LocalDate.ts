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

/** Weekday of a local calendar date (0 = Sunday). */
export function weekdayOf(date: LocalDate): WeekStartDay {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).getDay() as WeekStartDay
}

export const WEEKDAY_SHORT_LABELS: Record<WeekStartDay, string> = {
  0: 'S',
  1: 'M',
  2: 'T',
  3: 'W',
  4: 'T',
  5: 'F',
  6: 'S',
}

/** Ordered short weekday labels starting at `weekStartDay`. */
export function weekdayHeaders(weekStartDay: WeekStartDay): string[] {
  const headers: string[] = []
  for (let i = 0; i < 7; i++) {
    headers.push(WEEKDAY_SHORT_LABELS[((weekStartDay + i) % 7) as WeekStartDay])
  }
  return headers
}

/** Every week (Sun–Sat style per weekStartDay) that intersects the given calendar month. */
export function weeksOverlappingMonth(
  year: number,
  month: number,
  weekStartDay: WeekStartDay,
): LocalDate[][] {
  const firstOfMonth = toLocalDate(new Date(year, month - 1, 1))
  const lastOfMonth = toLocalDate(new Date(year, month, 0))
  let weekStart = startOfWeek(firstOfMonth, weekStartDay)
  const weeks: LocalDate[][] = []
  while (weekStart <= lastOfMonth) {
    weeks.push(enumeratePlanDates(weekStart, 7))
    weekStart = addDays(weekStart, 7)
  }
  return weeks
}

export function monthContainsDate(date: LocalDate, year: number, month: number): boolean {
  const [y, m] = date.split('-').map(Number)
  return y === year && m === month
}

/** Human label for a plan week relative to today (“This week”, “Last week”, …). */
export function planWeekLabel(
  weekStart: LocalDate,
  today: LocalDate,
  weekStartDay: WeekStartDay,
): string {
  const thisWeek = startOfWeek(today, weekStartDay)
  if (weekStart === thisWeek) return 'This week'
  if (weekStart === addDays(thisWeek, -7)) return 'Last week'
  if (weekStart === addDays(thisWeek, 7)) return 'Next week'
  const end = addDays(weekStart, 6)
  const [ys, ms, ds] = weekStart.split('-').map(Number)
  const [ye, me, de] = end.split('-').map(Number)
  const startText = new Date(ys, ms - 1, ds).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
  const endText = new Date(ye, me - 1, de).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
  return `${startText} – ${endText}`
}
