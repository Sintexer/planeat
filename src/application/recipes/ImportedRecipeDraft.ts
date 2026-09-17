export type MeasurementStatus =
  'known' | 'ambiguous-cup' | 'ambiguous-tbsp' | 'ambiguous-oz' | 'unresolved'

export type ImportedIngredientLine = {
  name: string
  quantityValue: number | ''
  quantityUnit: string
  /** Non-numeric / unresolved amount text (e.g. "to taste", a range). */
  quantityText: string
  note: string
  /** Decoded original recipeIngredient string — always preserved. */
  originalText: string
  measurementStatus: MeasurementStatus
}

/** Application-layer draft that maps 1:1 onto RecipeFormValues in the UI. */
export type ImportedRecipeDraft = {
  name: string
  yieldValue: number | ''
  yieldUnit: string
  portionValue: number | ''
  portionUnit: string
  instructions: string
  roles: string[]
  mealTypes: string[]
  effort: string
  activeTimeMinutes: number | ''
  totalTimeMinutes: number | ''
  reusePolicy: string
  freezerFriendly: boolean
  freezingNotes: string
  sourceUrl: string
  photoUrl: string
  cuisine: string
  maxPreferredRepeats: number | ''
  notes: string
  ingredientLines: ImportedIngredientLine[]
}

export type NormalizedImport = {
  form: ImportedRecipeDraft
  hints: string[]
  displayName: string
}
