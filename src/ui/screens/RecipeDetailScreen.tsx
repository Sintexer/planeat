import {
  ActionIcon,
  Badge,
  Button,
  Group,
  NumberInput,
  Stack,
  Text,
  Title,
  List,
  Select,
} from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useServices } from '../../app/servicesContext'
import { ScreenHeader } from '../components/ScreenHeader'
import { RecipePhotoThumb } from '../components/RecipePhotoThumb'
import { scaleFactor } from '../../domain/shared/scaleQuantity'
import { precisionStep } from '../components/quantityStep'
import { useIngredients } from '../hooks/useIngredients'
import { usePairings } from '../hooks/usePairings'
import { useRecipe } from '../hooks/useRecipe'
import { useRecipes } from '../hooks/useRecipes'
import { useSimpleFoods } from '../hooks/useSimpleFoods'
import { useTags } from '../hooks/useTags'
import { useLocalization } from '../localization/LocalizationContext'
import { useFormatQuantity } from '../localization/useFormatQuantity'
import {
  dishTypeLabel,
  effortLabel,
  kindLabel,
  mealTypeLabel,
  reuseLabel,
  roleLabel,
} from '../localization/labels'

export function RecipeDetailScreen() {
  const { recipeId } = useParams()
  const navigate = useNavigate()
  const recipe = useRecipe(recipeId)
  const ingredients = useIngredients()
  const recipes = useRecipes()
  const simpleFoods = useSimpleFoods()
  const pairings = usePairings()
  const tags = useTags()
  const { recipeService, quantityService, pairingService } = useServices()
  const formatQty = useFormatQuantity()
  const { bcp47, t } = useLocalization()

  const [scaleYieldValue, setScaleYieldValue] = useState<number | ''>('')
  const [pairingPick, setPairingPick] = useState<string | null>(null)

  const ingredientNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const ingredient of ingredients ?? []) {
      map.set(ingredient.id, ingredient.name)
    }
    return map
  }, [ingredients])

  const tagsById = useMemo(() => {
    const map = new Map<string, string>()
    for (const tag of tags ?? []) map.set(tag.id, tag.name)
    return map
  }, [tags])

  const recipePairings = useMemo(() => {
    if (!recipe || !pairings) return []
    return pairings.filter(
      (p) => p.recipeId === recipe.id || (p.target.type === 'recipe' && p.target.id === recipe.id),
    )
  }, [recipe, pairings])

  const pairingOptions = useMemo(() => {
    if (!recipe || !recipes || !simpleFoods) return []
    const linked = new Set<string>()
    for (const pairing of recipePairings) {
      if (pairing.recipeId === recipe.id) {
        linked.add(`${pairing.target.type}:${pairing.target.id}`)
      } else if (pairing.target.type === 'recipe') {
        linked.add(`recipe:${pairing.recipeId}`)
      }
    }
    const options: { value: string; label: string }[] = []
    for (const other of recipes) {
      if (other.id === recipe.id) continue
      const key = `recipe:${other.id}`
      if (linked.has(key)) continue
      options.push({
        value: key,
        label: t('detail.pairingOption', { kind: kindLabel(t, 'recipe'), name: other.name }),
      })
    }
    for (const food of simpleFoods) {
      const key = `simple-food:${food.id}`
      if (linked.has(key)) continue
      options.push({
        value: key,
        label: t('detail.pairingOption', { kind: kindLabel(t, 'simple-food'), name: food.name }),
      })
    }
    return options
  }, [recipe, recipes, simpleFoods, recipePairings, t])

  const pairingLabel = (pairing: (typeof recipePairings)[number]): string => {
    if (!recipe) return ''
    if (pairing.recipeId === recipe.id) {
      if (pairing.target.type === 'recipe') {
        return recipes?.find((r) => r.id === pairing.target.id)?.name ?? pairing.target.id
      }
      return simpleFoods?.find((f) => f.id === pairing.target.id)?.name ?? pairing.target.id
    }
    return recipes?.find((r) => r.id === pairing.recipeId)?.name ?? pairing.recipeId
  }

  if (recipe === undefined) {
    return <Text c="dimmed">{t('common.loading')}</Text>
  }

  if (recipe === null) {
    return (
      <Stack gap="md">
        <ScreenHeader title={t('detail.recipeNotFoundTitle')} fallbackTo="/recipes" />
        <Text c="dimmed">{t('detail.recipeNotFound')}</Text>
      </Stack>
    )
  }

  const targetYield =
    scaleYieldValue === '' ? recipe.yield : { value: scaleYieldValue, unit: recipe.yield.unit }
  const factor = scaleFactor(recipe.yield, targetYield) ?? 1

  const handleDelete = () => {
    modals.openConfirmModal({
      title: t('detail.deleteRecipe'),
      children: <Text>{t('detail.deleteRecipeBody', { name: recipe.name })}</Text>,
      labels: { confirm: t('action.delete'), cancel: t('action.cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const result = await recipeService.deleteRecipe(recipe.id)
        if (!result.ok) {
          notifications.show({ message: t('detail.recipeNotFound'), color: 'red' })
          return
        }
        notifications.show({ message: t('detail.recipeDeleted'), color: 'green' })
        navigate('/recipes')
      },
    })
  }

  return (
    <Stack gap="md">
      <ScreenHeader
        title={recipe.name}
        fallbackTo="/recipes"
        actions={
          <Group gap="xs">
            <Button component={Link} to={`/recipes/${recipe.id}/edit`} variant="light">
              {t('detail.edit')}
            </Button>
            <Button color="red" variant="subtle" onClick={handleDelete}>
              {t('action.delete')}
            </Button>
          </Group>
        }
      />

      {recipe.photoUrl && <RecipePhotoThumb url={recipe.photoUrl} label={recipe.name} size={96} />}

      <Text size="sm" c="dimmed">
        {t('detail.yieldPortion', {
          yield: formatQty(recipe.yield),
          portion: formatQty(recipe.defaultPortionPerPerson),
        })}
      </Text>

      <Stack gap="xs">
        <Title order={4}>{t('editor.organization')}</Title>
        <Group gap={4}>
          {recipe.roles.map((role) => (
            <Badge key={role} variant="light">
              {roleLabel(t, role)}
            </Badge>
          ))}
          {recipe.mealTypes.map((mealType) => (
            <Badge key={mealType} variant="outline">
              {mealTypeLabel(t, mealType)}
            </Badge>
          ))}
          {recipe.dishType && <Badge variant="filled">{dishTypeLabel(t, recipe.dishType)}</Badge>}
          {recipe.cuisine && <Badge variant="outline">{recipe.cuisine}</Badge>}
        </Group>

        {recipe.tagIds.length > 0 && (
          <Group gap={4}>
            {recipe.tagIds.map((tagId) => {
              const name = tagsById.get(tagId) ?? t('common.unavailableTag')
              return (
                <Badge key={tagId} variant="dot">
                  {name}
                </Badge>
              )
            })}
          </Group>
        )}
      </Stack>

      <Text size="sm">
        {t('detail.effortReuse', {
          effort: effortLabel(t, recipe.effort),
          reuse: reuseLabel(t, recipe.reusePolicy),
        })}
        {recipe.freezerFriendly ? t('detail.freezerSuffix') : ''}
      </Text>

      {(recipe.activeTimeMinutes !== undefined || recipe.totalTimeMinutes !== undefined) && (
        <Text size="sm" c="dimmed">
          {recipe.activeTimeMinutes !== undefined
            ? t('detail.activeMin', { minutes: recipe.activeTimeMinutes })
            : null}
          {recipe.activeTimeMinutes !== undefined && recipe.totalTimeMinutes !== undefined
            ? ' · '
            : null}
          {recipe.totalTimeMinutes !== undefined
            ? t('detail.totalMin', { minutes: recipe.totalTimeMinutes })
            : null}
        </Text>
      )}

      <Stack gap="xs">
        <Title order={4}>{t('detail.scale')}</Title>
        <Text size="sm" c="dimmed">
          {t('detail.scaleHelp', { unit: recipe.yield.unit })}
        </Text>
        <NumberInput
          label={t('detail.scaleTo', { unit: recipe.yield.unit })}
          min={0.001}
          step={precisionStep(scaleYieldValue === '' ? recipe.yield.value : scaleYieldValue, 3)}
          decimalScale={3}
          value={scaleYieldValue === '' ? recipe.yield.value : scaleYieldValue}
          onChange={(next) => setScaleYieldValue(typeof next === 'number' ? next : '')}
        />
        {factor !== 1 && (
          <Text size="sm">
            {t('detail.scaleFactor', {
              factor: new Intl.NumberFormat(bcp47, { maximumFractionDigits: 3 }).format(factor),
            })}
          </Text>
        )}
      </Stack>

      <Title order={4}>{t('editor.ingredients')}</Title>
      {recipe.ingredientLines.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t('detail.noIngredients')}
        </Text>
      ) : (
        <List spacing="xs">
          {recipe.ingredientLines.map((line, index) => {
            const name = line.ingredientId
              ? (ingredientNames.get(line.ingredientId) ?? line.displayText)
              : line.displayText
            const amountText = line.quantityText
              ? line.quantityText
              : (() => {
                  const scaled = quantityService.scale(line.quantity, factor)
                  return formatQty(scaled ?? null)
                })()
            return (
              <List.Item key={`${line.ingredientId ?? line.displayText}-${index}`}>
                {name}
                {` — ${amountText}`}
                {line.note ? ` (${line.note})` : ''}
                {line.sourceText ? (
                  <Text size="xs" c="dimmed">
                    {t('import.original', { text: line.sourceText })}
                  </Text>
                ) : null}
              </List.Item>
            )
          })}
        </List>
      )}

      <Title order={4}>{t('editor.instructions')}</Title>
      <Text style={{ whiteSpace: 'pre-wrap' }}>
        {recipe.instructions.trim() || t('detail.noInstructions')}
      </Text>

      {recipe.freezingNotes && (
        <>
          <Title order={4}>{t('detail.freezingNotes')}</Title>
          <Text style={{ whiteSpace: 'pre-wrap' }}>{recipe.freezingNotes}</Text>
        </>
      )}

      {recipe.notes && (
        <>
          <Title order={4}>{t('editor.notes')}</Title>
          <Text style={{ whiteSpace: 'pre-wrap' }}>{recipe.notes}</Text>
        </>
      )}

      <Title order={4}>{t('detail.pairsWell')}</Title>
      {recipePairings.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t('detail.noPairings')}
        </Text>
      ) : (
        <Stack gap={4}>
          {recipePairings.map((pairing) => (
            <Group key={pairing.id} justify="space-between" wrap="nowrap">
              <Text size="sm">{pairingLabel(pairing)}</Text>
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label={t('detail.removePairing')}
                onClick={() => {
                  void pairingService.remove(pairing.id).then((result) => {
                    if (!result.ok) {
                      notifications.show({ message: t('detail.removePairingFailed'), color: 'red' })
                    }
                  })
                }}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          ))}
        </Stack>
      )}
      <Group align="flex-end" wrap="nowrap">
        <Select
          style={{ flex: 1 }}
          placeholder={t('detail.addPairing')}
          searchable
          data={pairingOptions}
          value={pairingPick}
          onChange={setPairingPick}
        />
        <Button
          disabled={!pairingPick}
          onClick={() => {
            if (!pairingPick) return
            const [type, id] = pairingPick.split(':') as ['recipe' | 'simple-food', string]
            void pairingService.add(recipe.id, { type, id }).then((result) => {
              if (!result.ok) {
                notifications.show({
                  message:
                    result.error === 'duplicate'
                      ? t('detail.alreadyPaired')
                      : result.error === 'self-pairing'
                        ? t('detail.selfPairing')
                        : t('detail.pairingFailed'),
                  color: 'red',
                })
                return
              }
              setPairingPick(null)
              notifications.show({ message: t('detail.pairingAdded'), color: 'green' })
            })
          }}
        >
          {t('action.add')}
        </Button>
      </Group>

      {recipe.sourceUrl && (
        <Text size="sm" c="dimmed">
          {t('detail.source', { url: recipe.sourceUrl })}
        </Text>
      )}
    </Stack>
  )
}
