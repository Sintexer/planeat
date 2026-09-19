import type { LocalDate } from '../../shared/LocalDate'
import { addDays } from '../../shared/LocalDate'

export type RecencyKind = 'main' | 'accompaniment' | 'composition' | 'recook'

export type RecencyState = {
  lastConsumed: Map<string, LocalDate>
}

export function emptyRecency(): RecencyState {
  return { lastConsumed: new Map() }
}

export function recencyKey(kind: RecencyKind, id: string): string {
  return `${kind}:${id}`
}

export function rememberUse(
  state: RecencyState,
  kind: RecencyKind,
  id: string,
  date: LocalDate,
): void {
  state.lastConsumed.set(recencyKey(kind, id), date)
}

export function lastUsedOn(
  state: RecencyState,
  kind: RecencyKind,
  id: string,
): LocalDate | undefined {
  return state.lastConsumed.get(recencyKey(kind, id))
}

/** Lower is better: never used → very old. Uses most recent consumption, not cook date. */
export function recencyPenalty(
  state: RecencyState,
  kind: RecencyKind,
  id: string,
  asOf: LocalDate,
): number {
  const last = lastUsedOn(state, kind, id)
  if (!last) return 0
  if (last >= asOf) return 8
  let days = 0
  let cursor = last
  while (cursor < asOf && days < 14) {
    cursor = addDays(cursor, 1)
    days += 1
  }
  return Math.max(0, 8 - days)
}

export function cloneRecency(state: RecencyState): RecencyState {
  return { lastConsumed: new Map(state.lastConsumed) }
}
