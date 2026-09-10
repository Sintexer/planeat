import type { Recipe as SchemaDtsRecipe } from 'schema-dts'
import { z } from 'zod'
import type { SchemaOrgRecipeNode } from '../../application/ports/RecipeTextExtractor'

/** Compile-time Schema.org Recipe reference; runtime validation stays on Zod. */
export type { SchemaDtsRecipe }

/** Loose Schema.org Recipe-ish node after JSON-LD walk. */
export const schemaOrgRecipeNodeSchema = z
  .object({
    '@type': z.union([z.string(), z.array(z.string())]).optional(),
    name: z.union([z.string(), z.array(z.string())]).optional(),
    recipeIngredient: z.unknown().optional(),
    ingredients: z.unknown().optional(),
    recipeInstructions: z.unknown().optional(),
    instructions: z.unknown().optional(),
    recipeYield: z.unknown().optional(),
    yield: z.unknown().optional(),
    prepTime: z.unknown().optional(),
    cookTime: z.unknown().optional(),
    totalTime: z.unknown().optional(),
    url: z.unknown().optional(),
    mainEntityOfPage: z.unknown().optional(),
    description: z.unknown().optional(),
  })
  .passthrough()

export function isRecipeType(typeValue: unknown): boolean {
  if (typeof typeValue === 'string') {
    return typeValue === 'Recipe' || typeValue.endsWith('/Recipe')
  }
  if (Array.isArray(typeValue)) {
    return typeValue.some((t) => typeof t === 'string' && (t === 'Recipe' || t.endsWith('/Recipe')))
  }
  return false
}

export type ParsedSchemaOrgRecipe = z.infer<typeof schemaOrgRecipeNodeSchema> & SchemaOrgRecipeNode
