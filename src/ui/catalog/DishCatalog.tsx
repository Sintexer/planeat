import {
  Badge,
  Button,
  Chip,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import {
  IconAdjustments,
  IconAlertTriangle,
  IconChevronDown,
  IconChevronUp,
} from '@tabler/icons-react'
import Fuse from 'fuse.js'
import { useMemo, useState, type ReactNode } from 'react'
import {
  EFFORT_LABELS,
  EFFORT_LEVELS,
  MEAL_TYPE_LABELS,
  MEAL_TYPES,
  RECIPE_ROLE_LABELS,
  RECIPE_ROLES,
  type Effort,
  type MealType,
  type RecipeRole,
} from '../../domain/shared/MealEnums'
import { RecipePhotoThumb } from '../components/RecipePhotoThumb'
import { useFormatQuantity } from '../localization/useFormatQuantity'
import {
  groupCatalogItems,
  itemMatchesFilters,
  uniqueTags,
  type DishCatalogFilters,
  type DishCatalogItem,
} from './catalogModel'

const KIND_BADGE_LABELS: Record<'recipe' | 'simple-food', string> = {
  recipe: 'Recipe',
  'simple-food': 'Simple food',
}

const ROLE_CHIP_LABELS: Record<RecipeRole, string> = {
  complete: 'Complete',
  main: 'Main',
  side: 'Side',
  vegetable: 'Veg',
  'breakfast-component': 'Breakfast bit',
}

interface DishCatalogProps {
  items: DishCatalogItem[]
  leftovers?: DishCatalogItem[]
  filters: DishCatalogFilters
  onFiltersChange: (next: DishCatalogFilters) => void
  onSelect: (item: DishCatalogItem) => void
  disabled?: boolean
  showKindFilter?: boolean
  showSuggestedFilter?: boolean
  emptyMessage?: string
  /** Page layout grows with the screen; modal keeps a capped scroller. */
  layout?: 'modal' | 'page'
}

function toggleMeal(current: MealType | 'all', value: MealType): MealType | 'all' {
  return current === value ? 'all' : value
}

function toggleRole(current: RecipeRole | 'all', value: RecipeRole): RecipeRole | 'all' {
  return current === value ? 'all' : value
}

function toggleEffort(current: Effort | 'all', value: Effort): Effort | 'all' {
  return current === value ? 'all' : value
}

function activeFilterCount(filters: DishCatalogFilters, showSuggested: boolean): number {
  let count = 0
  if (showSuggested && filters.suggestedOnly) count += 1
  if (filters.kind !== 'all') count += 1
  if (filters.mealType !== 'all') count += 1
  if (filters.role !== 'all') count += 1
  if (filters.effort !== 'all') count += 1
  return count
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
  layout = 'modal',
}: DishCatalogProps) {
  const [fullFiltersOpen, setFullFiltersOpen] = useState(false)
  const tags = useMemo(() => uniqueTags(items), [items])
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

  const tagChips = tags.map((tag) => (
    <Chip
      key={tag}
      size="xs"
      radius="xl"
      variant="outline"
      checked={filters.tag === tag}
      onChange={() => setFilters({ tag: filters.tag === tag ? null : tag })}
    >
      {tag}
    </Chip>
  ))

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
        <Text size="sm" c="dimmed">
          {emptyMessage}
        </Text>
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
          {tagChips}
        </Group>
        <Button
          size="compact-xs"
          variant={fullFiltersOpen ? 'light' : 'default'}
          radius="sm"
          leftSection={<IconAdjustments size={14} />}
          rightSection={
            fullFiltersOpen ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />
          }
          onClick={() => setFullFiltersOpen((open) => !open)}
        >
          {extraFilters > 0 ? `Filters (${extraFilters})` : 'Filters'}
        </Button>
      </Group>

      {fullFiltersOpen && (
        <Stack
          gap="sm"
          p="sm"
          style={{
            border: '1px solid var(--mantine-color-default-border)',
            borderRadius: 'var(--mantine-radius-md)',
          }}
        >
          {showKindFilter && (
            <FilterGroup label="Type">
              <Chip
                size="xs"
                radius="sm"
                checked={filters.kind === 'recipe'}
                onChange={() => setFilters({ kind: filters.kind === 'recipe' ? 'all' : 'recipe' })}
              >
                Recipes
              </Chip>
              <Chip
                size="xs"
                radius="sm"
                checked={filters.kind === 'simple-food'}
                onChange={() =>
                  setFilters({ kind: filters.kind === 'simple-food' ? 'all' : 'simple-food' })
                }
              >
                Simple foods
              </Chip>
            </FilterGroup>
          )}
          <FilterGroup label="Meal type">
            {MEAL_TYPES.map((meal) => (
              <Chip
                key={meal}
                size="xs"
                radius="sm"
                checked={filters.mealType === meal}
                onChange={() => setFilters({ mealType: toggleMeal(filters.mealType, meal) })}
              >
                {MEAL_TYPE_LABELS[meal]}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Dish">
            {RECIPE_ROLES.map((role) => (
              <Chip
                key={role}
                size="xs"
                radius="sm"
                checked={filters.role === role}
                onChange={() => setFilters({ role: toggleRole(filters.role, role) })}
              >
                {ROLE_CHIP_LABELS[role]}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Effort">
            {EFFORT_LEVELS.map((effort) => (
              <Chip
                key={effort}
                size="xs"
                radius="sm"
                checked={filters.effort === effort}
                onChange={() => setFilters({ effort: toggleEffort(filters.effort, effort) })}
              >
                {EFFORT_LABELS[effort]}
              </Chip>
            ))}
          </FilterGroup>
        </Stack>
      )}

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
