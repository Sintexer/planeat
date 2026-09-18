/// <reference lib="webworker" />
import { QuantityService } from '../../application/quantities/QuantityService'
import { runGenerationSearch } from '../../domain/plans/generation/search'
import type {
  GenerationSearchResult,
  GenerationWorkerRequest,
  GenerationWorkerResponse,
} from '../../application/plans/generationRunner'

const quantities = new QuantityService()

self.onmessage = (event: MessageEvent<GenerationWorkerRequest>) => {
  const message = event.data
  if (message.type !== 'run') return
  const proposal = runGenerationSearch(message.input, message.requestId, (quantity, factor) =>
    quantities.scale(quantity, factor),
  )
  const result: GenerationSearchResult = { ok: true, value: proposal }
  const response: GenerationWorkerResponse = {
    type: 'result',
    requestId: message.requestId,
    result,
  }
  self.postMessage(response)
}
