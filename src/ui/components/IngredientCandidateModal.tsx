import { Button, Stack, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import type { IngredientService } from '../../application/ingredients/IngredientService'
import {
  ingredientMatchesAnyIdentifier,
  type Ingredient,
} from '../../domain/ingredients/Ingredient'
import type { Translate } from '../localization/t'

export type IngredientCandidateChoice =
  | { action: 'select'; ingredient: Ingredient }
  | { action: 'create' }
  | { action: 'leave-unlinked' }
  | { action: 'cancel' }

export type ImportedAliasChoice = 'alias' | 'link-only' | 'cancel'

/**
 * Presents an ambiguous ingredient-name match as a choice between the
 * candidates or creating a new ingredient, instead of silently linking to
 * whichever candidate happened to come back first.
 */
export function resolveIngredientCandidate(
  candidates: Ingredient[],
  rawName: string,
  labelFor: (ingredient: Ingredient) => string,
  t: Translate,
): Promise<IngredientCandidateChoice> {
  return new Promise((resolve) => {
    const id = modals.open({
      title: t('candidate.title'),
      onClose: () => resolve({ action: 'cancel' }),
      children: (
        <Stack gap="sm">
          <Text size="sm">{t('candidate.body', { name: rawName })}</Text>
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
            {t('candidate.create', { name: rawName })}
          </Button>
          <Button
            variant="default"
            fullWidth
            onClick={() => {
              modals.close(id)
              resolve({ action: 'leave-unlinked' })
            }}
          >
            {t('candidate.leaveUnlinked')}
          </Button>
        </Stack>
      ),
    })
  })
}

export function confirmImportedAlias(
  phrase: string,
  catalogLabel: string,
  t: Translate,
): Promise<ImportedAliasChoice> {
  return new Promise((resolve) => {
    const id = modals.open({
      title: t('alias.title'),
      onClose: () => resolve('cancel'),
      children: (
        <Stack gap="sm">
          <Text size="sm">{t('alias.body', { phrase, label: catalogLabel })}</Text>
          <Button
            fullWidth
            onClick={() => {
              modals.close(id)
              resolve('alias')
            }}
          >
            {t('alias.add', { phrase })}
          </Button>
          <Button
            variant="light"
            fullWidth
            onClick={() => {
              modals.close(id)
              resolve('link-only')
            }}
          >
            {t('alias.linkOnly')}
          </Button>
          <Button
            variant="default"
            fullWidth
            onClick={() => {
              modals.close(id)
              resolve('cancel')
            }}
          >
            {t('action.cancel')}
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
  t: Translate,
): Promise<Ingredient | null> {
  const linked = await ingredientService.createOrLinkByName(rawName)
  if (!linked.ok) return null
  if ('ambiguous' in linked) {
    const choice = await resolveIngredientCandidate(linked.candidates, rawName, labelFor, t)
    if (choice.action === 'select') return choice.ingredient
    if (choice.action === 'create') {
      const created = await ingredientService.createIngredientForName(rawName)
      return created.ok ? created.ingredient : null
    }
    return null
  }
  return linked.ingredient
}

export async function confirmLinkImportedIngredient(
  ingredientService: IngredientService,
  ingredient: Ingredient,
  phrase: string,
  labelFor: (candidate: Ingredient) => string,
  t: Translate,
): Promise<Ingredient | null> {
  if (ingredientMatchesAnyIdentifier(ingredient, phrase)) return ingredient
  const decision = await confirmImportedAlias(phrase, labelFor(ingredient), t)
  if (decision === 'cancel') return null
  if (decision === 'alias') {
    const result = await ingredientService.addLegacyAlias(ingredient.id, phrase)
    if (!result.ok) return null
  }
  return ingredient
}
