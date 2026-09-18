import type {
  ExtractRecipesError,
  RecipeTextExtractor,
  SchemaOrgRecipeNode,
} from '../ports/RecipeTextExtractor'
import type { NormalizedImport } from './ImportedRecipeDraft'
import { normalizeImportedRecipe } from './normalizeImportedRecipe'

export type RecipeImportError = ExtractRecipesError

export type ImportCandidate = {
  node: SchemaOrgRecipeNode
  normalized: NormalizedImport
}

export class RecipeImportService {
  private readonly extractor: RecipeTextExtractor

  constructor(extractor: RecipeTextExtractor) {
    this.extractor = extractor
  }

  extractAndNormalize(
    raw: string,
  ): { ok: true; candidates: ImportCandidate[] } | { ok: false; error: RecipeImportError } {
    const extracted = this.extractor.extractRecipesFromText(raw)
    if (!extracted.ok) return extracted

    const candidates = extracted.recipes.map((node) => ({
      node,
      normalized: normalizeImportedRecipe(node),
    }))
    return { ok: true, candidates }
  }
}
