import type { ImportedRecipeDraft } from '../../application/recipes/ImportedRecipeDraft'
import type { RecipeFormValues } from './recipeForm'
import { emptyIngredientLine } from './recipeForm'

export const IMPORT_DRAFT_STORAGE_KEY = 'planeat.importDraft'

export type StoredImportDraft = {
  form: ImportedRecipeDraft
  hints: string[]
}

export function writeImportDraft(draft: StoredImportDraft): void {
  sessionStorage.setItem(IMPORT_DRAFT_STORAGE_KEY, JSON.stringify(draft))
}

export function readAndClearImportDraft(): StoredImportDraft | null {
  const raw = sessionStorage.getItem(IMPORT_DRAFT_STORAGE_KEY)
  if (!raw) return null
  sessionStorage.removeItem(IMPORT_DRAFT_STORAGE_KEY)
  try {
    return JSON.parse(raw) as StoredImportDraft
  } catch {
    return null
  }
}

export function importedDraftToFormValues(draft: ImportedRecipeDraft): RecipeFormValues {
  return {
    name: draft.name,
    yieldValue: draft.yieldValue,
    yieldUnit: draft.yieldUnit,
    portionValue: draft.portionValue,
    portionUnit: draft.portionUnit,
    instructions: draft.instructions,
    roles: draft.roles,
    mealTypes: draft.mealTypes,
    effort: draft.effort,
    activeTimeMinutes: draft.activeTimeMinutes,
    totalTimeMinutes: draft.totalTimeMinutes,
    reusePolicy: draft.reusePolicy,
    freezerFriendly: draft.freezerFriendly,
    freezingNotes: draft.freezingNotes,
    tagsText: draft.tagsText,
    sourceUrl: draft.sourceUrl,
    photoUrl: draft.photoUrl ?? '',
    cuisine: draft.cuisine,
    maxPreferredRepeats: draft.maxPreferredRepeats,
    notes: draft.notes,
    ingredientLines:
      draft.ingredientLines.length > 0
        ? draft.ingredientLines.map((line) => ({
            key: crypto.randomUUID(),
            name: line.name,
            quantityValue: line.quantityValue,
            quantityUnit: line.quantityUnit,
            note: line.note,
          }))
        : [emptyIngredientLine()],
  }
}
