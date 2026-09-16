import {
  Badge,
  Button,
  Chip,
  CloseButton,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import { IconAdjustments, IconAlertTriangle } from '@tabler/icons-react'
import Fuse from 'fuse.js'
import { useMemo, useState } from 'react'
import { EFFORT_LABELS, MEAL_TYPE_LABELS, RECIPE_ROLE_LABELS } from '../../domain/shared/MealEnums'
import type { TagId } from '../../domain/tags/Tag'
import { RecipePhotoThumb } from '../components/RecipePhotoThumb'
import { useFormatQuantity } from '../localization/useFormatQuantity'
import { FilterDrawer } from './FilterDrawer'
import {
  groupCatalogItems,
  itemMatchesFilters,
  uniqueTagFacets,
  type DishCatalogFilters,
  type DishCatalogItem,
} from './catalogModel'

const KIND_BADGE_LABELS: Record<'recipe' | 'simple-food', string> = {
  recipe: 'Recipe',
  'simple-food': 'Simple food',
}

const ROLE_CHIP_LABELS: Record<string, string> = {
  complete: 'Complete',
  main: 'Main',
  side: 'Side',
  vegetable: 'Veg',
  'breakfast-component': 'Breakfast bit',
}

const KIND_FILTER_LABELS: Record<'recipe' | 'simple-food', string> = {
  recipe: 'Recipes',
  'simple-food': 'Simple foods',
}

interface DishCatalogProps {
  items: DishCatalogItem[]
  leftovers?: DishCatalogItem[]
  filters: DishCatalogFilters
  onFiltersChange: (next: DishCatalogFilters) => void
  onSelect: (item: DishCatalogItem) => void
  tagNamesById: Map<TagId, string>
  disabled?: boolean
  showKindFilter?: boolean
  showSuggestedFilter?: boolean
  emptyMessage?: string
  /** Page layout grows with the screen; modal keeps a capped scroller. */
  layout?: 'modal' | 'page'
}

function activeFilterCount(filters: DishCatalogFilters, showSuggested: boolean): number {
  let count = 0
  if (showSuggested && filters.suggestedOnly) count += 1
  if (filters.kind !== 'all') count += 1
  count += filters.mealTypes.length
  count += filters.roles.length
  count += filters.tagIds.length
  if (filters.effort !== 'all') count += 1
  return count
}

function ItemRow({
  item,
  onSelect,
  disabled,
  leftover,
}: {
  item: DishCatalogItem
  onSelect: (item: DishCatalogItem) => void
  disabled?: boolean
  leftover?: boolean
}) {
  const formatQty = useFormatQuantity()
  const ineligible = Boolean(item.ineligibleReason)
  const row = (
    <UnstyledButton
      disabled={disabled || ineligible}
      onClick={() => onSelect(item)}
      w="100%"
      style={{ textAlign: 'left' }}
    >
      <Paper
        p={8}
        radius="md"
        withBorder={leftover}
        style={
          ineligible
            ? { opacity: 0.55 }
            : leftover
              ? { background: 'var(--mantine-color-teal-light)' }
              : undefined
        }
      >
        <Group wrap="nowrap" align="flex-start" gap="sm">
          <RecipePhotoThumb url={item.photoUrl} label={item.name} size={44} />
          <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
            <Text size="sm" fw={600} lineClamp={2}>
              {item.name}
            </Text>
            <Text size="xs" c="dimmed">
              {item.subtitle}
              {item.remaining ? ` · ${formatQty(item.remaining)} left` : ''}
            </Text>
            <Group gap={4}>
              {(item.kind === 'recipe' || item.kind === 'simple-food') && (
                <Badge
                  size="xs"
                  color={item.kind === 'recipe' ? 'blue' : 'grape'}
                  variant="dot"
                  radius="sm"
                >
                  {KIND_BADGE_LABELS[item.kind]}
                </Badge>
              )}
              {ineligible ? (
                <Badge
                  size="xs"
                  color="red"
                  variant="filled"
                  radius="xl"
                  leftSection={<IconAlertTriangle size={10} />}
                >
                  {item.ineligibleReason}
                </Badge>
              ) : (
                leftover && (
                  <Badge size="xs" color="teal" variant="filled" radius="xl">
                    Remaining
                  </Badge>
                )
              )}
              {item.roles.slice(0, 2).map((role) => (
                <Badge key={role} size="xs" variant="light" radius="sm">
                  {RECIPE_ROLE_LABELS[role]}
                </Badge>
              ))}
              {item.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} size="xs" variant="outline" radius="xl">
                  {tag}
                </Badge>
              ))}
            </Group>
          </Stack>
        </Group>
      </Paper>
    </UnstyledButton>
  )

  if (!ineligible) return row
  return (
    <Tooltip label={item.ineligibleReason} multiline w={220}>
      <div>{row}</div>
    </Tooltip>
  )
}

export function DishCatalog({
  items,
  leftovers = [],
  filters,
  onFiltersChange,
  onSelect,
  disabled,
  showKindFilter = true,
  showSuggestedFilter = false,
  emptyMessage = 'No matching dishes.',
  tagNamesById,
  layout = 'modal',
}: DishCatalogProps) {
  const [filterDrawerOpened, setFilterDrawerOpened] = useState(false)
  const tagFacets = useMemo(() => uniqueTagFacets(items, tagNamesById), [items, tagNamesById])
  const extraFilters = activeFilterCount(filters, showSuggestedFilter)

  const visibleLeftovers = useMemo(() => {
    const q = filters.query.trim()
    if (!q) return leftovers
    const fuse = new Fuse(leftovers, { keys: ['name', 'tags', 'subtitle'], threshold: 0.4 })
    return fuse.search(q).map((result) => result.item)
  }, [leftovers, filters.query])

  const filtered = useMemo(() => {
    const matched = items.filter((item) => itemMatchesFilters(item, filters))
    const q = filters.query.trim()
    if (!q) {
      return [...matched].sort(
        (a, b) => (b.score ?? 0) - (a.score ?? 0) || a.name.localeCompare(b.name),
      )
    }
    const fuse = new Fuse(matched, {
      keys: ['name', 'tags', 'subtitle'],
      threshold: 0.4,
    })
    return fuse.search(q).map((result) => result.item)
  }, [items, filters])

  const groups = useMemo(
    () => groupCatalogItems(filtered, filters.query.trim().length > 0),
    [filtered, filters.query],
  )

  const setFilters = (patch: Partial<DishCatalogFilters>) => {
    onFiltersChange({ ...filters, ...patch })
  }

  const clearFilters = () => {
    setFilters({ kind: 'all', mealTypes: [], roles: [], effort: 'all', tagIds: [] })
  }

  const appliedChips: { key: string; label: string; onRemove: () => void }[] = []
  if (filters.kind !== 'all') {
    appliedChips.push({
      key: `kind:${filters.kind}`,
      label: KIND_FILTER_LABELS[filters.kind],
      onRemove: () => setFilters({ kind: 'all' }),
    })
  }
  for (const mealType of filters.mealTypes) {
    appliedChips.push({
      key: `meal:${mealType}`,
      label: MEAL_TYPE_LABELS[mealType],
      onRemove: () => setFilters({ mealTypes: filters.mealTypes.filter((m) => m !== mealType) }),
    })
  }
  for (const role of filters.roles) {
    appliedChips.push({
      key: `role:${role}`,
      label: ROLE_CHIP_LABELS[role],
      onRemove: () => setFilters({ roles: filters.roles.filter((r) => r !== role) }),
    })
  }
  if (filters.effort !== 'all') {
    appliedChips.push({
      key: `effort:${filters.effort}`,
      label: EFFORT_LABELS[filters.effort],
      onRemove: () => setFilters({ effort: 'all' }),
    })
  }
  for (const tagId of filters.tagIds) {
    appliedChips.push({
      key: `tag:${tagId}`,
      label: tagNamesById.get(tagId) ?? tagId,
      onRemove: () => setFilters({ tagIds: filters.tagIds.filter((id) => id !== tagId) }),
    })
  }

  const list = (
    <Stack gap="md">
      {visibleLeftovers.length > 0 && (
        <Stack gap={8}>
          <Text size="xs" fw={700} tt="uppercase" c="teal">
            Remaining this week
          </Text>
          {visibleLeftovers.map((item) => (
            <ItemRow key={item.key} item={item} leftover onSelect={onSelect} disabled={disabled} />
          ))}
        </Stack>
      )}

      {groups.length === 0 && visibleLeftovers.length === 0 && (
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            {extraFilters > 0 ? 'No dishes match your filters.' : emptyMessage}
          </Text>
          {extraFilters > 0 && (
            <Button size="compact-xs" variant="subtle" onClick={clearFilters} w="fit-content">
              Clear filters
            </Button>
          )}
        </Stack>
      )}

      {groups.map((group) => (
        <Stack key={group.id} gap={8}>
          {group.title !== 'Results' && (
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">
              {group.title}
            </Text>
          )}
          {group.items.map((item) => (
            <ItemRow key={item.key} item={item} onSelect={onSelect} disabled={disabled} />
          ))}
        </Stack>
      ))}
    </Stack>
  )

  return (
    <Stack gap="sm">
      <TextInput
        placeholder="Search dishes, tags…"
        value={filters.query}
        onChange={(event) => setFilters({ query: event.currentTarget.value })}
        data-autofocus={layout === 'modal'}
      />

      <Group gap="xs" justify="space-between" wrap="nowrap" align="center">
        <Group gap={6} wrap="wrap" style={{ flex: 1, minWidth: 0 }}>
          {showSuggestedFilter && (
            <Chip
              size="xs"
              radius="sm"
              checked={filters.suggestedOnly}
              onChange={() => setFilters({ suggestedOnly: !filters.suggestedOnly })}
            >
              Suggested
            </Chip>
          )}
          {appliedChips.map((chip) => (
            <Badge
              key={chip.key}
              size="sm"
              variant="light"
              radius="xl"
              rightSection={
                <CloseButton
                  size={12}
                  variant="transparent"
                  aria-label={`Remove ${chip.label} filter`}
                  onClick={chip.onRemove}
                />
              }
            >
              {chip.label}
            </Badge>
          ))}
          {extraFilters > 0 && (
            <Button size="compact-xs" variant="subtle" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </Group>
        <Button
          size="compact-xs"
          variant="default"
          radius="sm"
          leftSection={<IconAdjustments size={14} />}
          onClick={() => setFilterDrawerOpened(true)}
        >
          {extraFilters > 0 ? `Filters (${extraFilters})` : 'Filters'}
        </Button>
      </Group>

      <FilterDrawer
        opened={filterDrawerOpened}
        onClose={() => setFilterDrawerOpened(false)}
        appliedFilters={filters}
        onApply={onFiltersChange}
        items={items}
        tagFacets={tagFacets}
        showKindFilter={showKindFilter}
      />

      {layout === 'page' ? (
        list
      ) : (
        <ScrollArea.Autosize mah={360} type="hover" offsetScrollbars>
          {list}
        </ScrollArea.Autosize>
      )}
    </Stack>
  )
}
