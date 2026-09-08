import { z } from 'zod'

const recipeSchema = z.object({
  id: z.string(),
  name: z.string(),
  servings: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const settingsSchema = z.object({
  id: z.literal('app-settings'),
  householdSize: z.number(),
})

export const backupFileSchema = z
  .object({
    format: z.literal('family-menu-planner'),
    schemaVersion: z.number(),
    exportedAt: z.string(),
    data: z.object({
      recipes: z.array(recipeSchema),
      settings: z.array(settingsSchema),
    }),
  })
  .refine(
    (backup) => {
      const ids = backup.data.recipes.map((recipe) => recipe.id)
      return new Set(ids).size === ids.length
    },
    { message: 'Backup contains duplicate recipe ids', path: ['data', 'recipes'] },
  )
