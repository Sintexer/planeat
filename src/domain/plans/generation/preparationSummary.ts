import type { LocalDate } from '../../shared/LocalDate'
import type { SlotAssignment } from './proposal'

export type PreparationSummaryAction = 'cook-for' | 'prepare' | 'reheat'

export type PreparationSummaryLine = {
  action: PreparationSummaryAction
  name: string
  dates: LocalDate[]
}

const ACTION_ORDER: Record<PreparationSummaryAction, number> = {
  'cook-for': 0,
  prepare: 1,
  reheat: 2,
}

/**
 * Short prep lines from the proposal's cooking events and components.
 * A reused main is reheating; a new side on that day is still preparation.
 */
export function preparationSummary(
  assignments: readonly SlotAssignment[],
  slotDateById: ReadonlyMap<string, LocalDate>,
): PreparationSummaryLine[] {
  const cooks = new Map<string, { name: string; dates: LocalDate[] }>()
  const lines: PreparationSummaryLine[] = []

  for (const assignment of assignments) {
    const date = slotDateById.get(assignment.slotId)
    if (!date) continue
    const newRecipes = assignment.components.filter((component) => component.type === 'recipe')
    const leftovers = assignment.components.filter((component) => component.type === 'leftover')
    const hasBatchMain = newRecipes.some((component) => component.proposedEventId)
    for (const component of newRecipes) {
      if (component.proposedEventId) {
        const row = cooks.get(component.proposedEventId) ?? {
          name: component.recipeName,
          dates: [],
        }
        row.dates.push(date)
        cooks.set(component.proposedEventId, row)
        continue
      }
      if (leftovers.length > 0 || hasBatchMain) {
        lines.push({ action: 'prepare', name: component.recipeName, dates: [date] })
      } else {
        lines.push({ action: 'cook-for', name: component.recipeName, dates: [date] })
      }
    }
    for (const component of leftovers) {
      if (component.proposedEventId) {
        const row = cooks.get(component.proposedEventId) ?? {
          name: component.recipeName,
          dates: [],
        }
        row.dates.push(date)
        cooks.set(component.proposedEventId, row)
      }
      lines.push({ action: 'reheat', name: component.recipeName, dates: [date] })
    }
  }

  for (const row of cooks.values()) {
    lines.push({
      action: 'cook-for',
      name: row.name,
      dates: [...new Set(row.dates)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    })
  }

  return lines.sort((a, b) => {
    const aDate = a.dates[0] ?? ''
    const bDate = b.dates[0] ?? ''
    if (aDate !== bDate) return aDate < bDate ? -1 : 1
    const action = ACTION_ORDER[a.action] - ACTION_ORDER[b.action]
    if (action !== 0) return action
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  })
}
