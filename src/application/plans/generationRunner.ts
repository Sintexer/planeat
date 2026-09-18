import type {
  GenerationInput,
  WeekGenerationProposal,
} from '../../domain/plans/generation/proposal'
import { runGenerationSearch } from '../../domain/plans/generation/search'
import type { QuantityService } from '../quantities/QuantityService'

export type GenerationSearchResult =
  { ok: true; value: WeekGenerationProposal } | { ok: false; error: 'no-eligible-candidates' }

export type GenerationWorkerRequest = {
  type: 'run'
  requestId: string
  input: GenerationInput
}

export type GenerationWorkerResponse = {
  type: 'result'
  requestId: string
  result: GenerationSearchResult
}

export type GenerationSearchRunner = {
  run(input: GenerationInput, requestId: string): Promise<GenerationSearchResult>
}

export function createSyncGenerationRunner(quantities: QuantityService): GenerationSearchRunner {
  return {
    run(input, requestId) {
      const proposal = runGenerationSearch(input, requestId, (quantity, factor) =>
        quantities.scale(quantity, factor),
      )
      if (proposal.assignments.length === 0) {
        return Promise.resolve({ ok: false, error: 'no-eligible-candidates' })
      }
      return Promise.resolve({ ok: true, value: proposal })
    },
  }
}

export function createWorkerGenerationRunner(worker: Worker): GenerationSearchRunner {
  return {
    run(input, requestId) {
      return new Promise((resolve) => {
        const onMessage = (event: MessageEvent<GenerationWorkerResponse>) => {
          if (event.data.requestId !== requestId) return
          worker.removeEventListener('message', onMessage)
          resolve(event.data.result)
        }
        worker.addEventListener('message', onMessage)
        const payload: GenerationWorkerRequest = { type: 'run', requestId, input }
        worker.postMessage(payload)
      })
    },
  }
}
