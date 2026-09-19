import type { LocalDate } from '../../shared/LocalDate'
import { effortUnits } from '../prepEffort'
import type { GenerationInput } from './proposal'
import { DEFAULT_GENERATION_SOFT_PREFS } from './scoring'
import type { DayLoad } from './proposal'
import { resolveDayLoad } from './structure'

export type CapacityLedger = {
  cooksByDate: Map<LocalDate, number>
  demandingByDate: Map<LocalDate, number>
  remainingRequested: number
}

export function emptyLedger(remainingRequested: number): CapacityLedger {
  return {
    cooksByDate: new Map(),
    demandingByDate: new Map(),
    remainingRequested,
  }
}

export function cloneLedger(ledger: CapacityLedger): CapacityLedger {
  return {
    cooksByDate: new Map(ledger.cooksByDate),
    demandingByDate: new Map(ledger.demandingByDate),
    remainingRequested: ledger.remainingRequested,
  }
}

export function recordCooks(
  ledger: CapacityLedger,
  date: LocalDate,
  cooks: number,
  demanding: number,
): void {
  if (cooks > 0) ledger.cooksByDate.set(date, (ledger.cooksByDate.get(date) ?? 0) + cooks)
  if (demanding > 0) {
    ledger.demandingByDate.set(date, (ledger.demandingByDate.get(date) ?? 0) + demanding)
  }
}

export function dailyEffort(ledger: CapacityLedger, date: LocalDate): number {
  return effortUnits(ledger.cooksByDate.get(date) ?? 0)
}

export function remainingSlotReserve(ledger: CapacityLedger): number {
  return Math.max(0, ledger.remainingRequested) * 0.5
}

export function capacityIsTight(
  ledger: CapacityLedger,
  input: GenerationInput,
  date: LocalDate,
): boolean {
  const prefs = input.softPrefs ?? DEFAULT_GENERATION_SOFT_PREFS
  const next = effortUnits((ledger.cooksByDate.get(date) ?? 0) + 1)
  const reserve = remainingSlotReserve(ledger)
  if (next + reserve > prefs.maxBatchPrepUnits + 1) return true
  const load: DayLoad = resolveDayLoad(date, input)
  if (load === 'busy' && next > 1) return true
  return next > prefs.maxBatchPrepUnits
}
