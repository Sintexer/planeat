import { Button, Chip, Drawer, Group, MultiSelect, NumberInput, Stack, Text } from '@mantine/core'
import { useState, type ReactNode } from 'react'
import {
  EFFORT_LABELS,
  EFFORT_LEVELS,
  MEAL_TYPE_LABELS,
  MEAL_TYPES,
  RECIPE_ROLES,
  type RecipeRole,
} from '../../domain/shared/MealEnums'
import {
  itemMatchesFilters,
  type DishCatalogFilters,
  type DishCatalogItem,
  type FilterMatchOptions,
  type IngredientFilterOption,
  type TagFacet,
} from './catalogModel'

const ROLE_CHIP_LABELS: Record<RecipeRole, string> = {
  complete: 'Complete',
  main: 'Main',
  side: 'Side',
  vegetable: 'Veg',
  'breakfast-component': 'Breakfast bit',
}

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
      label: 'Unavailable ingredient',
    })),
  ]

  return (
    <Drawer opened={opened} onClose={onClose} position="bottom" size="80%" title="Filters">
      <Stack gap="md" justify="space-between" h="100%">
        <Stack gap="sm" style={{ overflowY: 'auto' }}>
          {showKindFilter && (
            <FilterGroup label="Type">
              <Chip
                size="xs"
                radius="sm"
                checked={draft.kind === 'recipe'}
                onChange={() => setDraftPatch({ kind: draft.kind === 'recipe' ? 'all' : 'recipe' })}
              >
                Recipes
              </Chip>
              <Chip
                size="xs"
                radius="sm"
                checked={draft.kind === 'simple-food'}
                onChange={() =>
                  setDraftPatch({ kind: draft.kind === 'simple-food' ? 'all' : 'simple-food' })
                }
              >
                Simple foods
              </Chip>
            </FilterGroup>
          )}

          <FilterGroup label="Meal occasion">
            <Chip.Group
              multiple
              value={draft.mealTypes}
              onChange={(value) => setDraftPatch({ mealTypes: value as typeof draft.mealTypes })}
            >
              {MEAL_TYPES.map((meal) => (
                <Chip key={meal} size="xs" radius="sm" value={meal}>
                  {MEAL_TYPE_LABELS[meal]}
                </Chip>
              ))}
            </Chip.Group>
          </FilterGroup>

          <FilterGroup label="Meal role">
            <Chip.Group
              multiple
              value={draft.roles}
              onChange={(value) => setDraftPatch({ roles: value as typeof draft.roles })}
            >
              {RECIPE_ROLES.map((role) => (
                <Chip key={role} size="xs" radius="sm" value={role}>
                  {ROLE_CHIP_LABELS[role]}
                </Chip>
              ))}
            </Chip.Group>
          </FilterGroup>

          <FilterGroup label="Effort">
            {EFFORT_LEVELS.map((effort) => (
              <Chip
                key={effort}
                size="xs"
                radius="sm"
                checked={draft.effort === effort}
                onChange={() => setDraftPatch({ effort: draft.effort === effort ? 'all' : effort })}
              >
                {EFFORT_LABELS[effort]}
              </Chip>
            ))}
          </FilterGroup>

          <NumberInput
            label="Maximum total time (minutes)"
            description="Only recipes with a recorded total time. Missing time is not treated as zero."
            min={1}
            value={draft.maxTotalTimeMinutes}
            onChange={(next) =>
              setDraftPatch({ maxTotalTimeMinutes: typeof next === 'number' ? next : '' })
            }
          />

          {ingredientOptions.length > 0 && (
            <Stack gap="sm">
              <MultiSelect
                label="Contains ingredient"
                placeholder="Pick from catalog"
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
                label="Exclude ingredient"
                placeholder="Pick from catalog"
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
                These filters use recorded catalog ingredients only. Unlinked imported lines are
                ignored. This is not an allergy-safety guarantee.
              </Text>
            </Stack>
          )}

          {tagFacets.length > 0 && (
            <FilterGroup label="Household tags">
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
            Clear filters
          </Button>
          <Button
            onClick={() => {
              onApply(draft)
              onClose()
            }}
          >
            Show {matchCount} items
          </Button>
        </Group>
      </Stack>
    </Drawer>
  )
}
