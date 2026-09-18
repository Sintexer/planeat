import { Button, Chip, Drawer, Group, MultiSelect, NumberInput, Stack, Text } from '@mantine/core'
import { useState, type ReactNode } from 'react'
import { EFFORT_LEVELS, MEAL_TYPES, RECIPE_ROLES } from '../../domain/shared/MealEnums'
import { useLocalization } from '../localization/LocalizationContext'
import { effortLabel, mealTypeLabel, roleChipLabel } from '../localization/labels'
import {
  itemMatchesFilters,
  type DishCatalogFilters,
  type DishCatalogItem,
  type FilterMatchOptions,
  type IngredientFilterOption,
  type TagFacet,
} from './catalogModel'

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap={6}>
      <Text size="xs" fw={700} c="dimmed" tt="uppercase">
        {label}
      </Text>
      <Group gap={6} wrap="wrap">
        {children}
      </Group>
    </Stack>
  )
}

function filterIngredientOptions(
  options: IngredientFilterOption[],
  search: string,
): IngredientFilterOption[] {
  const query = search.trim().toLowerCase()
  if (!query) return options
  return options.filter((option) => option.searchText.toLowerCase().includes(query))
}

interface FilterDrawerProps {
  opened: boolean
  onClose: () => void
  appliedFilters: DishCatalogFilters
  onApply: (next: DishCatalogFilters) => void
  items: DishCatalogItem[]
  tagFacets: TagFacet[]
  showKindFilter?: boolean
  ingredientOptions?: IngredientFilterOption[]
  skipTagIds?: ReadonlySet<string>
  skipIngredientIds?: ReadonlySet<string>
}

export function FilterDrawer({
  opened,
  onClose,
  appliedFilters,
  onApply,
  items,
  tagFacets,
  showKindFilter = true,
  ingredientOptions = [],
  skipTagIds,
  skipIngredientIds,
}: FilterDrawerProps) {
  const { t, tPlural } = useLocalization()
  const [draft, setDraft] = useState<DishCatalogFilters>(appliedFilters)
  const [wasOpened, setWasOpened] = useState(opened)
  if (opened !== wasOpened) {
    setWasOpened(opened)
    if (opened) setDraft(appliedFilters)
  }

  const setDraftPatch = (patch: Partial<DishCatalogFilters>) => {
    setDraft((current) => ({ ...current, ...patch }))
  }

  const matchOptions: FilterMatchOptions = { skipTagIds, skipIngredientIds }
  const matchCount = items.filter((item) => itemMatchesFilters(item, draft, matchOptions)).length

  const clearDraft = () => {
    setDraft((current) => ({
      ...current,
      kind: 'all',
      mealTypes: [],
      roles: [],
      effort: 'all',
      tagIds: [],
      maxTotalTimeMinutes: '',
      containsIngredientIds: [],
      excludeIngredientIds: [],
    }))
  }

  const knownIngredientIds = new Set(ingredientOptions.map((option) => option.id))
  const extraIngredientIds = [...draft.containsIngredientIds, ...draft.excludeIngredientIds].filter(
    (id) => !knownIngredientIds.has(id),
  )
  const ingredientSelectData = [
    ...ingredientOptions.map((option) => ({
      value: option.id,
      label: option.label,
    })),
    ...[...new Set(extraIngredientIds)].map((id) => ({
      value: id,
      label: t('common.unavailableIngredient'),
    })),
  ]

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="bottom"
      size="80%"
      title={t('catalog.filters')}
    >
      <Stack gap="md" justify="space-between" h="100%">
        <Stack gap="sm" style={{ overflowY: 'auto' }}>
          {showKindFilter && (
            <FilterGroup label={t('filter.type')}>
              <Chip
                size="xs"
                radius="sm"
                checked={draft.kind === 'recipe'}
                onChange={() => setDraftPatch({ kind: draft.kind === 'recipe' ? 'all' : 'recipe' })}
              >
                {t('kind.recipes')}
              </Chip>
              <Chip
                size="xs"
                radius="sm"
                checked={draft.kind === 'simple-food'}
                onChange={() =>
                  setDraftPatch({ kind: draft.kind === 'simple-food' ? 'all' : 'simple-food' })
                }
              >
                {t('kind.simpleFoods')}
              </Chip>
            </FilterGroup>
          )}

          <FilterGroup label={t('filter.occasion')}>
            <Chip.Group
              multiple
              value={draft.mealTypes}
              onChange={(value) => setDraftPatch({ mealTypes: value as typeof draft.mealTypes })}
            >
              {MEAL_TYPES.map((meal) => (
                <Chip key={meal} size="xs" radius="sm" value={meal}>
                  {mealTypeLabel(t, meal)}
                </Chip>
              ))}
            </Chip.Group>
          </FilterGroup>

          <FilterGroup label={t('filter.role')}>
            <Chip.Group
              multiple
              value={draft.roles}
              onChange={(value) => setDraftPatch({ roles: value as typeof draft.roles })}
            >
              {RECIPE_ROLES.map((role) => (
                <Chip key={role} size="xs" radius="sm" value={role}>
                  {roleChipLabel(t, role)}
                </Chip>
              ))}
            </Chip.Group>
          </FilterGroup>

          <FilterGroup label={t('filter.effort')}>
            {EFFORT_LEVELS.map((effort) => (
              <Chip
                key={effort}
                size="xs"
                radius="sm"
                checked={draft.effort === effort}
                onChange={() => setDraftPatch({ effort: draft.effort === effort ? 'all' : effort })}
              >
                {effortLabel(t, effort)}
              </Chip>
            ))}
          </FilterGroup>

          <NumberInput
            label={t('filter.maxTime')}
            description={t('filter.maxTimeHelp')}
            min={1}
            value={draft.maxTotalTimeMinutes}
            onChange={(next) =>
              setDraftPatch({ maxTotalTimeMinutes: typeof next === 'number' ? next : '' })
            }
          />

          {ingredientOptions.length > 0 && (
            <Stack gap="sm">
              <MultiSelect
                label={t('filter.containsIngredient')}
                placeholder={t('filter.pickCatalog')}
                searchable
                data={ingredientSelectData}
                value={draft.containsIngredientIds}
                onChange={(value) => setDraftPatch({ containsIngredientIds: value })}
                filter={({ options, search }) => {
                  const allowed = new Set(
                    filterIngredientOptions(ingredientOptions, search).map((option) => option.id),
                  )
                  return options.filter((option) => 'value' in option && allowed.has(option.value))
                }}
              />
              <MultiSelect
                label={t('filter.excludeIngredient')}
                placeholder={t('filter.pickCatalog')}
                searchable
                data={ingredientSelectData}
                value={draft.excludeIngredientIds}
                onChange={(value) => setDraftPatch({ excludeIngredientIds: value })}
                filter={({ options, search }) => {
                  const allowed = new Set(
                    filterIngredientOptions(ingredientOptions, search).map((option) => option.id),
                  )
                  return options.filter((option) => 'value' in option && allowed.has(option.value))
                }}
              />
              <Text size="xs" c="dimmed">
                {t('filter.ingredientDisclaimer')}
              </Text>
            </Stack>
          )}

          {tagFacets.length > 0 && (
            <FilterGroup label={t('filter.tags')}>
              <Chip.Group
                multiple
                value={draft.tagIds}
                onChange={(value) => setDraftPatch({ tagIds: value as typeof draft.tagIds })}
              >
                {tagFacets.map((tag) => (
                  <Chip key={tag.id} size="xs" radius="xl" value={tag.id}>
                    {tag.name}
                  </Chip>
                ))}
              </Chip.Group>
            </FilterGroup>
          )}
        </Stack>

        <Group gap="sm" grow>
          <Button variant="subtle" onClick={clearDraft}>
            {t('catalog.clearFilters')}
          </Button>
          <Button
            onClick={() => {
              onApply(draft)
              onClose()
            }}
          >
            {tPlural('filter.showItems', matchCount)}
          </Button>
        </Group>
      </Stack>
    </Drawer>
  )
}
