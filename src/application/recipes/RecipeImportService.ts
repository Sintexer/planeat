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

export function importErrorMessage(error: RecipeImportError): string {
  switch (error) {
    case 'empty':
      return 'Paste JSON-LD or choose a file.'
    case 'url-only':
      return 'We don’t fetch websites — paste JSON-LD or HTML that contains it.'
    case 'parse-failed':
      return 'Couldn’t parse as JSON or HTML with JSON-LD.'
    case 'no-recipe':
      return 'No Schema.org Recipe found.'
    default:
      return `Import failed (${error})`
  }
}
