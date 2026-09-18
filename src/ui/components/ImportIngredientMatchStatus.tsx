import { Button, Group, Text } from '@mantine/core'
import {
  ingredientMatchesAnyIdentifier,
  type Ingredient,
} from '../../domain/ingredients/Ingredient'
import { useLocalization } from '../localization/LocalizationContext'

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
  const { t } = useLocalization()
  if (ingredientId) {
    return (
      <Group gap="xs">
        <Text size="xs" c="dimmed">
          {t('import.matched', { name: matchedLabel ?? t('import.catalogIngredient') })}
        </Text>
        <Button size="compact-xs" variant="subtle" onClick={onUnlink}>
          {t('import.unlink')}
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
        {t('import.unlinkedOk')}
      </Text>
      {identityCount > 1 ? (
        <Button size="compact-xs" variant="light" onClick={onChooseMatch}>
          {t('import.chooseMatch')}
        </Button>
      ) : null}
    </Group>
  )
}
