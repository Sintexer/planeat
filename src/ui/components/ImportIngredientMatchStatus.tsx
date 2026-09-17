import { Button, Group, Text } from '@mantine/core'
import {
  ingredientMatchesAnyIdentifier,
  type Ingredient,
} from '../../domain/ingredients/Ingredient'

interface ImportIngredientMatchStatusProps {
  lineName: string
  ingredientId?: string
  matchedLabel?: string
  catalog: Ingredient[]
  onUnlink: () => void
  onChooseMatch: () => void
}

export function ImportIngredientMatchStatus({
  lineName,
  ingredientId,
  matchedLabel,
  catalog,
  onUnlink,
  onChooseMatch,
}: ImportIngredientMatchStatusProps) {
  if (ingredientId) {
    return (
      <Group gap="xs">
        <Text size="xs" c="dimmed">
          Matched: {matchedLabel ?? 'catalog ingredient'}
        </Text>
        <Button size="compact-xs" variant="subtle" onClick={onUnlink}>
          Unlink
        </Button>
      </Group>
    )
  }

  const identityCount = catalog.filter((ingredient) =>
    ingredientMatchesAnyIdentifier(ingredient, lineName),
  ).length

  return (
    <Group gap="xs">
      <Text size="xs" c="dimmed">
        Unlinked — save is allowed.
      </Text>
      {identityCount > 1 ? (
        <Button size="compact-xs" variant="light" onClick={onChooseMatch}>
          Choose catalog match
        </Button>
      ) : null}
    </Group>
  )
}
