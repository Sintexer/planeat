import {
  Badge,
  Button,
  Checkbox,
  Chip,
  CloseButton,
  Group,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import { IconAdjustments, IconAlertTriangle } from '@tabler/icons-react'
import Fuse from 'fuse.js'
import { useEffect, useMemo, useState } from 'react'
import type { TagId } from '../../domain/tags/Tag'
import { RecipePhotoThumb } from '../components/RecipePhotoThumb'
import { useFormatQuantity } from '../localization/useFormatQuantity'
import { useLocalization } from '../localization/LocalizationContext'
import {
  catalogGroupHeading,
  catalogGroupOptions,
  catalogSortOptions,
  cleanupLabel,
  effortLabel,
  kindLabel,
  mealTypeLabel,
  roleChipLabel,
  roleLabel,
} from '../localization/labels'
import { formatWeekday } from '../localization/formatDate'
import { FilterDrawer } from './FilterDrawer'
import {
  groupCatalogItems,
  itemMatchesFilters,
  sortCatalogItems,
  uniqueTagFacets,
  type CatalogGroup,
  type CatalogSort,
  type DishCatalogFilters,
  type DishCatalogItem,
  type IngredientFilterOption,
} from './catalogModel'
import { leftoverBatchWeekday } from './pickerWhyThis'

interface DishCatalogProps {
  items: DishCatalogItem[]
  leftovers?: DishCatalogItem[]
  filters: DishCatalogFilters
  onFiltersChange: (next: DishCatalogFilters) => void
  onSelect: (item: DishCatalogItem) => void
  tagNamesById: Map<TagId, string>
  sort: CatalogSort
  onSortChange: (next: CatalogSort) => void
  group?: CatalogGroup
  onGroupChange?: (next: CatalogGroup) => void
  showGroupControl?: boolean
  disabled?: boolean
  showKindFilter?: boolean
  showSuggestedFilter?: boolean
  emptyMessage?: string
  /** Page layout grows with the screen; modal keeps a capped scroller. */
  layout?: 'modal' | 'page'
  ingredientOptions?: IngredientFilterOption[]
  /** Meal-picker context: group by suggestion reason for contextual sections. */
  pickerSections?: boolean
  /** Archived tags stay out of the filter drawer unless already applied. */
  archivedTagIds?: ReadonlySet<TagId>
  skipTagIds?: ReadonlySet<TagId>
  skipIngredientIds?: ReadonlySet<string>
  selectionMode?: boolean
  selectedKeys?: ReadonlySet<string>
  onToggleSelect?: (item: DishCatalogItem) => void
  onVisibleItemsChange?: (items: DishCatalogItem[]) => void
}

function activeFilterCount(filters: DishCatalogFilters, showSuggested: boolean): number {
  let count = 0
  if (showSuggested && filters.suggestedOnly) count += 1
  if (filters.kind !== 'all') count += 1
  count += filters.mealTypes.length
  count += filters.roles.length
  count += filters.tagIds.length
  if (filters.effort !== 'all') count += 1
  if (filters.maxTotalTimeMinutes !== '') count += 1
  count += filters.containsIngredientIds.length
  count += filters.excludeIngredientIds.length
  return count
}

function ItemRow({
  item,
  onSelect,
  disabled,
  leftover,
  selectionMode,
  selected,
}: {
  item: DishCatalogItem
  onSelect: (item: DishCatalogItem) => void
  disabled?: boolean
  leftover?: boolean
  selectionMode?: boolean
  selected?: boolean
}) {
  const formatQty = useFormatQuantity()
  const { t, bcp47 } = useLocalization()
  const ineligible = Boolean(item.ineligibleReason)
  const leftoverSubtitle =
    leftover && item.cookingEvent
      ? t('picker.leftoverBatch', {
          weekday: formatWeekday(
            leftoverBatchWeekday(item.cookingEvent.scheduledDate),
            bcp47,
            'long',
          ),
        })
      : item.subtitle
  const ineligibleLabel = item.ineligibleReason
    ? t('picker.sameDayIneligible', { date: item.cookingEvent?.scheduledDate ?? '' })
    : undefined
  const remainingText = item.remaining
    ? ` · ${formatQty(item.remaining)} ${t('quantity.left')}`
    : ''
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
        withBorder={leftover || selected}
        style={
          ineligible
            ? { opacity: 0.55 }
            : leftover
              ? { background: 'var(--mantine-color-teal-light)' }
              : undefined
        }
      >
        <Group wrap="nowrap" align="flex-start" gap="sm">
          {selectionMode && (
            <Checkbox
              checked={selected}
              readOnly
              tabIndex={-1}
              mt={4}
              aria-hidden
              styles={{ input: { pointerEvents: 'none' } }}
            />
          )}
          <RecipePhotoThumb url={item.photoUrl} label={item.name} size={44} />
          <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
            <Text size="sm" fw={600} lineClamp={2}>
              {item.name}
            </Text>
            <Text size="xs" c="dimmed">
              {leftoverSubtitle}
              {remainingText}
            </Text>
            <Group gap={4}>
              {(item.kind === 'recipe' || item.kind === 'simple-food') && (
                <Badge
                  size="xs"
                  color={item.kind === 'recipe' ? 'blue' : 'grape'}
                  variant="dot"
                  radius="sm"
                >
                  {kindLabel(t, item.kind)}
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
                  {ineligibleLabel}
                </Badge>
              ) : (
                leftover && (
                  <Badge size="xs" color="teal" variant="filled" radius="xl">
                    {t('catalog.remainingBadge')}
                  </Badge>
                )
              )}
              {item.roles.slice(0, 2).map((role) => (
                <Badge key={role} size="xs" variant="light" radius="sm">
                  {roleLabel(t, role)}
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
    <Tooltip label={ineligibleLabel} multiline w={220}>
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
  tagNamesById,
  sort,
  onSortChange,
  group,
  onGroupChange,
  showGroupControl = false,
  disabled,
  showKindFilter = true,
  showSuggestedFilter = false,
  emptyMessage,
  layout = 'modal',
  ingredientOptions = [],
  pickerSections = false,
  archivedTagIds,
  skipTagIds,
  skipIngredientIds,
  selectionMode = false,
  selectedKeys,
  onToggleSelect,
  onVisibleItemsChange,
}: DishCatalogProps) {
  const { t, bcp47 } = useLocalization()
  const [filterDrawerOpened, setFilterDrawerOpened] = useState(false)
  const tagFacets = useMemo(
    () =>
      uniqueTagFacets(items, tagNamesById, {
        excludeIds: archivedTagIds,
        retainIds: filters.tagIds,
      }),
    [items, tagNamesById, archivedTagIds, filters.tagIds],
  )
  const extraFilters = activeFilterCount(filters, showSuggestedFilter)

  const visibleLeftovers = useMemo(() => {
    const q = filters.query.trim()
    if (!q) return leftovers
    const fuse = new Fuse(leftovers, { keys: ['name', 'tags', 'subtitle'], threshold: 0.4 })
    return fuse.search(q).map((result) => result.item)
  }, [leftovers, filters.query])

  const filtered = useMemo(() => {
    const matched = items.filter((item) =>
      itemMatchesFilters(item, filters, { skipTagIds, skipIngredientIds }),
    )
    const q = filters.query.trim()
    if (!q) {
      return [...matched].sort(
        (a, b) => (b.score ?? 0) - (a.score ?? 0) || a.name.localeCompare(b.name, bcp47),
      )
    }
    const fuse = new Fuse(matched, {
      keys: ['name', 'tags', 'subtitle'],
      threshold: 0.4,
    })
    return fuse.search(q).map((result) => result.item)
  }, [items, filters, skipTagIds, skipIngredientIds, bcp47])

  const searching = filters.query.trim().length > 0

  const sortedItems = useMemo(
    () => sortCatalogItems(filtered, sort, bcp47),
    [filtered, sort, bcp47],
  )

  const groups = useMemo(
    () =>
      groupCatalogItems(sortedItems, {
        searching,
        suggestedFirst: showSuggestedFilter,
        mode: showGroupControl ? (group ?? 'none') : 'none',
        pickerSections,
      }),
    [sortedItems, searching, showSuggestedFilter, showGroupControl, group, pickerSections],
  )

  useEffect(() => {
    onVisibleItemsChange?.(sortedItems)
  }, [sortedItems, onVisibleItemsChange])

  const setFilters = (patch: Partial<DishCatalogFilters>) => {
    onFiltersChange({ ...filters, ...patch })
  }

  const clearFilters = () => {
    setFilters({
      kind: 'all',
      mealTypes: [],
      roles: [],
      effort: 'all',
      tagIds: [],
      maxTotalTimeMinutes: '',
      containsIngredientIds: [],
      excludeIngredientIds: [],
    })
  }

  const appliedChips: { key: string; label: string; onRemove: () => void }[] = []
  if (filters.kind !== 'all') {
    appliedChips.push({
      key: `kind:${filters.kind}`,
      label: filters.kind === 'recipe' ? t('kind.recipes') : t('kind.simpleFoods'),
      onRemove: () => setFilters({ kind: 'all' }),
    })
  }
  for (const mealType of filters.mealTypes) {
    appliedChips.push({
      key: `meal:${mealType}`,
      label: mealTypeLabel(t, mealType),
      onRemove: () => setFilters({ mealTypes: filters.mealTypes.filter((m) => m !== mealType) }),
    })
  }
  for (const role of filters.roles) {
    appliedChips.push({
      key: `role:${role}`,
      label: roleChipLabel(t, role),
      onRemove: () => setFilters({ roles: filters.roles.filter((r) => r !== role) }),
    })
  }
  if (filters.effort !== 'all') {
    appliedChips.push({
      key: `effort:${filters.effort}`,
      label: effortLabel(t, filters.effort),
      onRemove: () => setFilters({ effort: 'all' }),
    })
  }
  for (const tagId of filters.tagIds) {
    appliedChips.push({
      key: `tag:${tagId}`,
      label: tagNamesById.get(tagId) ?? t('common.unavailableTag'),
      onRemove: () => setFilters({ tagIds: filters.tagIds.filter((id) => id !== tagId) }),
    })
  }
  if (filters.maxTotalTimeMinutes !== '') {
    appliedChips.push({
      key: 'max-time',
      label: t('catalog.maxTimeChip', { minutes: filters.maxTotalTimeMinutes }),
      onRemove: () => setFilters({ maxTotalTimeMinutes: '' }),
    })
  }
  const ingredientLabel = (id: string) =>
    ingredientOptions.find((option) => option.id === id)?.label ?? t('common.unavailableIngredient')
  for (const id of filters.containsIngredientIds) {
    appliedChips.push({
      key: `contains:${id}`,
      label: t('catalog.hasIngredient', { name: ingredientLabel(id) }),
      onRemove: () =>
        setFilters({
          containsIngredientIds: filters.containsIngredientIds.filter((value) => value !== id),
        }),
    })
  }
  for (const id of filters.excludeIngredientIds) {
    appliedChips.push({
      key: `exclude:${id}`,
      label: t('catalog.withoutIngredient', { name: ingredientLabel(id) }),
      onRemove: () =>
        setFilters({
          excludeIngredientIds: filters.excludeIngredientIds.filter((value) => value !== id),
        }),
    })
  }

  if (filters.cleanup) {
    appliedChips.push({
      key: `cleanup:${filters.cleanup}`,
      label: cleanupLabel(t, filters.cleanup),
      onRemove: () => setFilters({ cleanup: '' }),
    })
  }

  const list = (
    <Stack gap="md">
      {visibleLeftovers.length > 0 && (
        <Stack gap={8}>
          <Text size="xs" fw={700} tt="uppercase" c="teal">
            {t('catalog.leftoversThisWeek')}
          </Text>
          {visibleLeftovers.map((item) => (
            <ItemRow key={item.key} item={item} leftover onSelect={onSelect} disabled={disabled} />
          ))}
        </Stack>
      )}

      {groups.length === 0 && visibleLeftovers.length === 0 && (
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            {extraFilters > 0
              ? t('empty.noFilterMatch')
              : filters.cleanup
                ? t('empty.cleanupNone')
                : (emptyMessage ?? t('empty.noFilterMatch'))}
          </Text>
          {extraFilters > 0 && (
            <Button size="compact-xs" variant="subtle" onClick={clearFilters} w="fit-content">
              {t('catalog.clearFilters')}
            </Button>
          )}
        </Stack>
      )}

      {groups.map((catalogGroup) => (
        <Stack key={catalogGroup.id} gap={8}>
          {catalogGroup.id !== 'ungrouped' && catalogGroup.id !== 'results' && (
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">
              {catalogGroupHeading(t, catalogGroup.id, catalogGroup.title || undefined)}
            </Text>
          )}
          {catalogGroup.items.map((item) => (
            <ItemRow
              key={item.key}
              item={item}
              onSelect={selectionMode && onToggleSelect ? onToggleSelect : onSelect}
              disabled={disabled}
              selectionMode={selectionMode}
              selected={selectedKeys?.has(item.key)}
            />
          ))}
        </Stack>
      ))}
    </Stack>
  )

  return (
    <Stack gap="sm">
      <TextInput
        placeholder={t('catalog.searchPlaceholder')}
        value={filters.query}
        onChange={(event) => setFilters({ query: event.currentTarget.value })}
        data-autofocus={layout === 'modal'}
      />

      <Group gap="xs" wrap="wrap">
        <Select
          size="xs"
          w={160}
          data={catalogSortOptions(t)}
          value={sort}
          onChange={(value) => value && onSortChange(value as CatalogSort)}
          aria-label={t('catalog.sortBy')}
          allowDeselect={false}
        />
        {showGroupControl && (
          <Select
            size="xs"
            w={160}
            data={catalogGroupOptions(t)}
            value={group ?? 'none'}
            onChange={(value) => value && onGroupChange?.(value as CatalogGroup)}
            aria-label={t('catalog.groupBy')}
            allowDeselect={false}
          />
        )}
      </Group>

      <Group gap="xs" justify="space-between" wrap="nowrap" align="center">
        <Group gap={6} wrap="wrap" style={{ flex: 1, minWidth: 0 }}>
          {showSuggestedFilter && (
            <Chip
              size="xs"
              radius="sm"
              checked={filters.suggestedOnly}
              onChange={() => setFilters({ suggestedOnly: !filters.suggestedOnly })}
            >
              {t('catalog.group.suggested')}
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
                  aria-label={t('catalog.removeFilter', { label: chip.label })}
                  onClick={chip.onRemove}
                />
              }
            >
              {chip.label}
            </Badge>
          ))}
          {extraFilters > 0 && (
            <Button size="compact-xs" variant="subtle" onClick={clearFilters}>
              {t('catalog.clearFilters')}
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
          {extraFilters > 0
            ? t('catalog.filtersCount', { count: extraFilters })
            : t('catalog.filters')}
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
        ingredientOptions={ingredientOptions}
        skipTagIds={skipTagIds}
        skipIngredientIds={skipIngredientIds}
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
