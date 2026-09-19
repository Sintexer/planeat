import type { LocalDate } from '../../shared/LocalDate'
import { weekdayOf } from '../../shared/LocalDate'
import type { MealType } from '../../shared/MealEnums'
import type { MealSlotId } from '../MealSlot'
import type { CapabilityInventory } from './capabilities'
import { DEFAULT_GENERATION_SOFT_PREFS } from './scoring'
import type { DayLoad, GenerationInput, RequestedGenerationSlot } from './proposal'

export type StructuredSlot = {
  row: RequestedGenerationSlot
  load: DayLoad
  potentialAnchor: boolean
  potentialReuseFrom: MealSlotId[]
  shape: 'main-plus-accompaniment' | 'standalone' | 'breakfast-pattern' | 'simple'
}

export type WeekStructure = {
  slots: StructuredSlot[]
  loadByDate: Map<LocalDate, DayLoad>
}

export function resolveDayLoad(date: LocalDate, input: GenerationInput): DayLoad {
  const overlay = input.dayLoad?.[date]
  if (overlay) return overlay
  const prefs = input.softPrefs ?? DEFAULT_GENERATION_SOFT_PREFS
  const weekday = weekdayOf(date)
  if (prefs.quickMealsOnlyDays.includes(weekday)) return 'busy'
  if (prefs.preferredBatchPrepDays.includes(weekday)) return 'free'
  return 'free'
}

export function defaultDayLoadForDates(
  dates: readonly LocalDate[],
  input: Pick<GenerationInput, 'softPrefs'>,
): Record<string, DayLoad> {
  const prefs = input.softPrefs ?? DEFAULT_GENERATION_SOFT_PREFS
  const out: Record<string, DayLoad> = {}
  for (const date of dates) {
    const weekday = weekdayOf(date)
    if (prefs.quickMealsOnlyDays.includes(weekday)) out[date] = 'busy'
    else if (prefs.preferredBatchPrepDays.includes(weekday)) out[date] = 'free'
    else out[date] = 'free'
  }
  return out
}

function mealShape(mealType: MealType, capabilities: CapabilityInventory): StructuredSlot['shape'] {
  if (mealType === 'breakfast') return 'breakfast-pattern'
  if (capabilities.mainsNeedingAccompaniment.length > 0) return 'main-plus-accompaniment'
  return 'standalone'
}

export function buildWeekStructure(
  input: GenerationInput,
  capabilities: CapabilityInventory,
): WeekStructure {
  const loadByDate = new Map<LocalDate, DayLoad>()
  const slots: StructuredSlot[] = input.requestedSlots.map((row) => {
    const load = resolveDayLoad(row.slot.date, input)
    loadByDate.set(row.slot.date, load)
    const potentialAnchor =
      load === 'free' &&
      !row.slot.excluded &&
      (input.generationMode === 'replace' || row.componentCount === 0)
    return {
      row,
      load,
      potentialAnchor,
      potentialReuseFrom: [],
      shape: mealShape(row.slot.mealType, capabilities),
    }
  })

  for (const slot of slots) {
    if (slot.row.slot.mealType === 'breakfast') continue
    for (const earlier of slots) {
      if (earlier.row.slot.id === slot.row.slot.id) continue
      if (earlier.row.slot.date > slot.row.slot.date) continue
      if (earlier.row.slot.date === slot.row.slot.date && earlier.row.slot.id >= slot.row.slot.id) {
        continue
      }
      if (!earlier.potentialAnchor) continue
      slot.potentialReuseFrom.push(earlier.row.slot.id)
    }
  }

  return { slots, loadByDate }
}
