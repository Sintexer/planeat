import { describe, expect, it } from 'vitest'
import {
  createWorkerGenerationRunner,
  type GenerationWorkerHandle,
  type GenerationWorkerRequest,
  type GenerationWorkerResponse,
} from './generationRunner'
import type { GenerationInput } from '../../domain/plans/generation/proposal'
import { DEFAULT_GENERATION_HARD_POLICY } from '../../domain/plans/generation/constraints'
import { DEFAULT_GENERATION_SOFT_PREFS } from '../../domain/plans/generation/scoring'

function stubInput(): GenerationInput {
  return {
    planId: 'plan-1',
    planRevision: 1,
    peopleCount: 2,
    recipes: [],
    requestedSlots: [],
    seed: 'seed-1',
    policy: DEFAULT_GENERATION_HARD_POLICY,
    fixedMeals: [],
    catalogs: { recipeIds: [], tagIds: [], ingredientIds: [] },
    softPrefs: DEFAULT_GENERATION_SOFT_PREFS,
    previousWeekRecipeIds: [],
    tagNamesById: {},
    generationSessionId: 'session-test',
  }
}

class FakeWorker implements GenerationWorkerHandle {
  terminated = false
  messages: GenerationWorkerRequest[] = []
  private readonly listeners = new Map<string, Set<EventListener>>()

  addEventListener(type: string, listener: EventListener) {
    let set = this.listeners.get(type)
    if (!set) {
      set = new Set()
      this.listeners.set(type, set)
    }
    set.add(listener)
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener)
  }

  postMessage(message: GenerationWorkerRequest) {
    this.messages.push(message)
  }

  terminate() {
    this.terminated = true
  }

  emit(type: string, event: Event) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event)
  }

  emitResponse(response: GenerationWorkerResponse) {
    this.emit('message', { data: response } as MessageEvent)
  }
}

describe('createWorkerGenerationRunner', () => {
  it('resolves worker-failed when the worker posts an error', async () => {
    const workers: FakeWorker[] = []
    const runner = createWorkerGenerationRunner(() => {
      const worker = new FakeWorker()
      workers.push(worker)
      return worker
    })
    const pending = runner.run(stubInput(), 'req-1')
    workers[0]?.emitResponse({ type: 'error', requestId: 'req-1', error: 'worker-failed' })
    expect(await pending).toEqual({ ok: false, error: 'worker-failed' })
  })

  it('resolves worker-failed on a worker error event', async () => {
    const workers: FakeWorker[] = []
    const runner = createWorkerGenerationRunner(() => {
      const worker = new FakeWorker()
      workers.push(worker)
      return worker
    })
    const pending = runner.run(stubInput(), 'req-1')
    workers[0]?.emit('error', new Event('error'))
    expect(await pending).toEqual({ ok: false, error: 'worker-failed' })
    expect(workers[0]?.terminated).toBe(true)
    expect(workers).toHaveLength(2)
  })

  it('aborts by terminating and recreating so a later run still works', async () => {
    const workers: FakeWorker[] = []
    const runner = createWorkerGenerationRunner(() => {
      const worker = new FakeWorker()
      workers.push(worker)
      return worker
    })
    const first = runner.run(stubInput(), 'req-1')
    runner.abort()
    expect(await first).toEqual({ ok: false, error: 'worker-failed' })
    expect(workers[0]?.terminated).toBe(true)

    const second = runner.run(stubInput(), 'req-2')
    workers[0]?.emitResponse({
      type: 'result',
      requestId: 'req-1',
      result: { ok: false, error: 'worker-failed' },
    })
    const later = workers[1]
    expect(later?.messages[0]?.requestId).toBe('req-2')
    later?.emitResponse({
      type: 'error',
      requestId: 'req-2',
      error: 'worker-failed',
    })
    expect(await second).toEqual({ ok: false, error: 'worker-failed' })
  })
})
