export type ImportedIngredientLine = {
  name: string
  quantityValue: number | ''
  quantityUnit: string
  note: string
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
