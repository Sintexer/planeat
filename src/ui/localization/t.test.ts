import { describe, expect, it } from 'vitest'
import { enMessages } from './messages'
import { ruMessages } from './ru'
import { t, tPlural, bindT } from './t'
import { planWeekRelation, formatPlanWeekLabel, formatWeekday } from './formatDate'

describe('catalogs', () => {
  it('includes every English key in Russian', () => {
    expect(Object.keys(ruMessages).sort()).toEqual(Object.keys(enMessages).sort())
  })
})

describe('t', () => {
  it('interpolates named placeholders', () => {
    expect(t('en', 'view.saved', { name: 'Kids' })).toBe('Saved “Kids”')
  })

  it('falls back to English when the locale catalog is missing', () => {
    expect(t('fr', 'nav.plan')).toBe(enMessages['nav.plan'])
  })

  it('uses Russian when registered', () => {
    expect(t('ru', 'nav.plan')).toBe('План')
  })
})

describe('tPlural', () => {
  it('selects English one/other', () => {
    expect(tPlural('en', 'filter.showItems', 1)).toBe('Show 1 item')
    expect(tPlural('en', 'filter.showItems', 2)).toBe('Show 2 items')
  })

  it('selects Russian few/many', () => {
    expect(tPlural('ru', 'filter.showItems', 1)).toContain('1')
    expect(tPlural('ru', 'filter.showItems', 2)).toBe('Показать 2 позиции')
    expect(tPlural('ru', 'filter.showItems', 5)).toBe('Показать 5 позиций')
  })
})

describe('plan week labels', () => {
  const translate = bindT('en')

  it('labels this, last, and next week', () => {
    const today = '2026-09-16'
    expect(planWeekRelation('2026-09-14', today, 1)).toEqual({ kind: 'this' })
    expect(formatPlanWeekLabel(planWeekRelation('2026-09-07', today, 1), 'en', translate)).toBe(
      'Last week',
    )
    expect(formatPlanWeekLabel(planWeekRelation('2026-09-21', today, 1), 'en', translate)).toBe(
      'Next week',
    )
  })

  it('formats a distant week with an explicit locale', () => {
    const relation = planWeekRelation('2026-08-03', '2026-09-16', 1)
    expect(relation.kind).toBe('range')
    expect(formatPlanWeekLabel(relation, 'en', translate)).toMatch(/Aug/)
  })
})

describe('formatWeekday', () => {
  it('uses the requested locale, not the runtime default', () => {
    expect(formatWeekday(1, 'en', 'long')).toBe('Monday')
    expect(formatWeekday(1, 'ru', 'long').toLowerCase()).toContain('понедельник')
  })
})
