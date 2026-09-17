import { Button, Stack, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import type { IngredientService } from '../../application/ingredients/IngredientService'
import type { Ingredient } from '../../domain/ingredients/Ingredient'

export type IngredientCandidateChoice =
  { action: 'select'; ingredient: Ingredient } | { action: 'create' } | { action: 'cancel' }

/**
 * Presents an ambiguous ingredient-name match as a choice between the
 * candidates or creating a new ingredient, instead of silently linking to
 * whichever candidate happened to come back first.
 */
export function resolveIngredientCandidate(
  candidates: Ingredient[],
  rawName: string,
  labelFor: (ingredient: Ingredient) => string,
): Promise<IngredientCandidateChoice> {
  return new Promise((resolve) => {
    const id = modals.open({
      title: 'Which ingredient did you mean?',
      onClose: () => resolve({ action: 'cancel' }),
      children: (
        <Stack gap="sm">
          <Text size="sm">
            “{rawName}” matches more than one ingredient. Choose one, or create a new ingredient.
          </Text>
          <Stack gap={6}>
            {candidates.map((candidate) => (
              <Button
                key={candidate.id}
                variant="light"
                fullWidth
                onClick={() => {
                  modals.close(id)
                  resolve({ action: 'select', ingredient: candidate })
                }}
              >
                {labelFor(candidate)}
              </Button>
            ))}
          </Stack>
          <Button
            variant="subtle"
            fullWidth
            onClick={() => {
              modals.close(id)
              resolve({ action: 'create' })
            }}
          >
            Create new ingredient “{rawName}”
          </Button>
        </Stack>
      ),
    })
  })
}

/**
 * Resolves a typed ingredient name to a single `Ingredient`, prompting the
 * user to disambiguate when more than one candidate matches. Returns `null`
 * if the name is empty, creation fails, or the user cancels disambiguation.
 */
export async function linkOrCreateIngredient(
  ingredientService: IngredientService,
  rawName: string,
  labelFor: (ingredient: Ingredient) => string,
): Promise<Ingredient | null> {
  const linked = await ingredientService.createOrLinkByName(rawName)
  if (!linked.ok) return null
  if ('ambiguous' in linked) {
    const choice = await resolveIngredientCandidate(linked.candidates, rawName, labelFor)
    if (choice.action === 'select') return choice.ingredient
    if (choice.action === 'create') {
      const created = await ingredientService.createIngredientForName(rawName)
      return created.ok ? created.ingredient : null
    }
    return null
  }
  return linked.ingredient
}
