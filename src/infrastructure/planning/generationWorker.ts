/// <reference lib="webworker" />
import { QuantityService } from '../../application/quantities/QuantityService'
import { runGenerationSearch } from '../../domain/plans/generation/search'
import type {
  GenerationWorkerRequest,
  GenerationWorkerResponse,
} from '../../application/plans/generationRunner'

const quantities = new QuantityService()

self.onmessage = (event: MessageEvent<GenerationWorkerRequest>) => {
  const message = event.data
  if (message.type !== 'run') return
  try {
    const proposal = runGenerationSearch(message.input, message.requestId, (quantity, factor) =>
      quantities.scale(quantity, factor),
    )
    const response: GenerationWorkerResponse = {
      type: 'result',
      requestId: message.requestId,
      result: { ok: true, value: proposal },
    }
    self.postMessage(response)
  } catch {
    const response: GenerationWorkerResponse = {
      type: 'error',
      requestId: message.requestId,
      error: 'worker-failed',
    }
    self.postMessage(response)
  }
}
