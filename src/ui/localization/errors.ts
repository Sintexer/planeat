import type { RecipeImportError } from '../../application/recipes/RecipeImportService'
import type { MessageId } from './messages'
import type { Translate } from './t'

const PLAN_ERRORS: Record<string, MessageId> = {
  'over-allocated': 'error.overAllocated',
  'reuse-forbidden': 'error.reuseForbidden',
  'before-prep': 'error.beforePrep',
  'incompatible-quantity': 'error.incompatibleQuantity',
  'invalid-quantity': 'error.invalidQuantity',
  'favorite-missing-ref': 'error.favoriteMissing',
}

const GENERATION_ERRORS: Record<string, MessageId> = {
  'no-eligible-candidates': 'generation.noEligible',
  'slot-not-empty': 'generation.slotNotEmpty',
  'slot-excluded': 'generation.slotExcluded',
  'stale-proposal': 'generation.stale',
}

export function planErrorMessage(t: Translate, error: string): string {
  const id = PLAN_ERRORS[error]
  if (id) return t(id)
  return t('error.planGeneric', { error })
}

export function generationErrorMessage(t: Translate, error: string): string {
  const id = GENERATION_ERRORS[error] ?? PLAN_ERRORS[error]
  if (id) return t(id)
  return t('error.planGeneric', { error })
}

export function addComponentErrorMessage(t: Translate, error: string): string {
  const id = PLAN_ERRORS[error]
  if (id) return t(id)
  return t('error.addComponent', { error })
}

export function importErrorCopy(t: Translate, error: RecipeImportError): string {
  if (error === 'empty') return t('import.error.empty')
  if (error === 'url-only') return t('import.error.urlOnly')
  if (error === 'parse-failed') return t('import.error.parseFailed')
  if (error === 'no-recipe') return t('import.error.noRecipe')
  return t('import.error.generic', { error })
}

export function restoreErrorCopy(
  t: Translate,
  error: 'invalid' | 'unsupported-version' | 'write-failed',
  foundVersion: number | undefined,
  supportedVersion: number,
): string {
  if (error === 'unsupported-version') {
    return t('backup.error.unsupportedVersion', {
      found: foundVersion === undefined ? 'unknown' : String(foundVersion),
      supported: supportedVersion,
    })
  }
  if (error === 'write-failed') return t('backup.error.writeFailed')
  return t('backup.error.invalid')
}
