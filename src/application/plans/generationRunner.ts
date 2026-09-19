import type {
  GenerationInput,
  WeekGenerationProposal,
} from '../../domain/plans/generation/proposal'
import { runGenerationSearch } from '../../domain/plans/generation/search'
import type { QuantityService } from '../quantities/QuantityService'

export type GenerationWorkerError = 'worker-failed'

export type GenerationSearchResult =
  { ok: true; value: WeekGenerationProposal } | { ok: false; error: GenerationWorkerError }

export type GenerationWorkerRequest = {
  type: 'run'
  requestId: string
  input: GenerationInput
}

export type GenerationWorkerResponse =
  | {
      type: 'result'
      requestId: string
      result: GenerationSearchResult
    }
  | {
      type: 'error'
      requestId: string
      error: GenerationWorkerError
    }

export type GenerationWorkerHandle = {
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
  postMessage(message: GenerationWorkerRequest): void
  terminate(): void
}

export type GenerationSearchRunner = {
  run(input: GenerationInput, requestId: string): Promise<GenerationSearchResult>
  abort(): void
}

export function createSyncGenerationRunner(quantities: QuantityService): GenerationSearchRunner {
  return {
    run(input, requestId) {
      const proposal = runGenerationSearch(input, requestId, (quantity, factor) =>
        quantities.scale(quantity, factor),
      )
      return Promise.resolve({ ok: true, value: proposal })
    },
    abort() {},
  }
}

export function createWorkerGenerationRunner(
  createWorker: () => GenerationWorkerHandle,
): GenerationSearchRunner {
  let worker = createWorker()
  const pending = new Map<string, (result: GenerationSearchResult) => void>()

  const onMessage = (event: Event) => {
    const data = (event as MessageEvent<GenerationWorkerResponse>).data
    if (!data || typeof data !== 'object' || !('requestId' in data)) return
    const resolve = pending.get(data.requestId)
    if (!resolve) return
    pending.delete(data.requestId)
    if (data.type === 'error') {
      resolve({ ok: false, error: 'worker-failed' })
      return
    }
    resolve(data.result)
  }

  let resetting = false

  const onWorkerFault = () => {
    failAllPending()
    resetWorker()
  }

  function failAllPending() {
    const resolvers = [...pending.values()]
    pending.clear()
    for (const resolve of resolvers) resolve({ ok: false, error: 'worker-failed' })
  }

  function detach(target: GenerationWorkerHandle) {
    target.removeEventListener('message', onMessage)
    target.removeEventListener('error', onWorkerFault)
    target.removeEventListener('messageerror', onWorkerFault)
  }

  function attach(target: GenerationWorkerHandle) {
    target.addEventListener('message', onMessage)
    target.addEventListener('error', onWorkerFault)
    target.addEventListener('messageerror', onWorkerFault)
  }

  function resetWorker() {
    if (resetting) return
    resetting = true
    detach(worker)
    worker.terminate()
    worker = createWorker()
    attach(worker)
    resetting = false
  }

  attach(worker)

  return {
    run(input, requestId) {
      return new Promise((resolve) => {
        pending.set(requestId, resolve)
        const payload: GenerationWorkerRequest = { type: 'run', requestId, input }
        worker.postMessage(payload)
      })
    },
    abort() {
      failAllPending()
      resetWorker()
    },
  }
}
