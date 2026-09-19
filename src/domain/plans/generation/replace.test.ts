import { describe, expect, it } from 'vitest'
import type { CookingEvent } from '../CookingEvent'
import type { MealComponent } from '../MealComponent'
import type { MealSlot } from '../MealSlot'
import type { Plan } from '../Plan'
import type { PlanGraph } from '../PlanGraph'
import { extraProducerDependentSlots, producerSlotRequested } from './replace'

function plan(): Plan {
  return {
    id: 'plan-1',
    startDate: '2026-01-05',
    dayCount: 7,
    peopleCount: 2,
    revision: 1,
    preferences: {},
    createdAt: 0,
    updatedAt: 0,
  }
}

function slot(overrides: Partial<MealSlot>): MealSlot {
  return {
    id: 'slot',
    planId: 'plan-1',
    date: '2026-01-05',
    mealType: 'dinner',
    excluded: false,
    ...overrides,
  }
}

function event(): CookingEvent {
  return {
    id: 'event-1',
    planId: 'plan-1',
    sessionId: 'session-1',
    recipeId: 'chili',
    recipeSnapshot: {
      id: 'chili',
      name: 'Chili',
      yield: { value: 6, unit: 'serving' },
      defaultPortionPerPerson: { value: 1, unit: 'serving' },
      ingredientLines: [],
      instructions: '',
      roles: ['complete'],
      mealTypes: ['dinner'],
      effort: 'regular',
      reusePolicy: 'batch-friendly',
      freezerFriendly: false,
      tags: [],
      createdAt: 0,
      updatedAt: 0,
    },
    outputQuantity: { value: 6, unit: 'serving' },
    scheduledDate: '2026-01-05',
  }
}

function component(slotId: string, id: string): MealComponent {
  return {
    id,
    slotId,
    source: { type: 'cooking-event', cookingEventId: 'event-1' },
    allocatedQuantity: { value: 3, unit: 'serving' },
  }
}

function graph(): PlanGraph {
  return {
    plan: plan(),
    slots: [
      slot({ id: 'slot-mon', date: '2026-01-05' }),
      slot({ id: 'slot-tue', date: '2026-01-06' }),
      slot({ id: 'slot-wed', date: '2026-01-07' }),
    ],
    components: [component('slot-mon', 'c-mon'), component('slot-tue', 'c-tue')],
    cookingEvents: [event()],
    prepSessions: [],
  }
}

describe('extraProducerDependentSlots', () => {
  it('requires leftover consumers when the producer is selected', () => {
    const extras = extraProducerDependentSlots(graph(), ['slot-mon'])
    expect(extras.map((row) => row.id)).toEqual(['slot-tue'])
  })

  it('does not expand when only a leftover consumer is selected', () => {
    expect(extraProducerDependentSlots(graph(), ['slot-tue'])).toEqual([])
  })

  it('returns nothing when dependents are already in the request', () => {
    expect(extraProducerDependentSlots(graph(), ['slot-mon', 'slot-tue'])).toEqual([])
  })
})

describe('producerSlotRequested', () => {
  it('is true only when a cook-date slot for the event is requested', () => {
    const g = graph()
    const requestedProducer = new Set(['slot-mon'])
    const requestedConsumer = new Set(['slot-tue'])
    expect(producerSlotRequested(g, event(), requestedProducer)).toBe(true)
    expect(producerSlotRequested(g, event(), requestedConsumer)).toBe(false)
  })
})
