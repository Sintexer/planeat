import {
  Badge,
  Button,
  Checkbox,
  Chip,
  CloseButton,
  Group,
  ScrollArea,
  Select,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import {
  CaretRight,
  Heart,
  Link,
  MagnifyingGlass,
  Sliders,
  Sparkle,
  Warning,
} from '@phosphor-icons/react'
import Fuse from 'fuse.js'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
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
  catalogActiveFilterCount,
  catalogRowTagLabels,
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
import { leftoverBatchWeekday, reasonBadgeCopy } from './pickerWhyThis'

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
  /** Data the list is built from is still resolving — show a skeleton, not an empty state. */
  loading?: boolean
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
  /** Extra toolbar (saved views, select, sort menus). Page layout only. */
  toolbar?: ReactNode
  hideSortGroup?: boolean
  showFiltersButton?: boolean
  filterDrawerOpened?: boolean
  onFilterDrawerOpenedChange?: (opened: boolean) => void
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
  const reasonPill = !leftover ? reasonBadgeCopy(t, item.reason) : undefined
  const shownRoles = item.roles.slice(0, 2)
  const roleLabels = shownRoles.flatMap((role) => [roleLabel(t, role), roleChipLabel(t, role)])
  const tagLabels = catalogRowTagLabels(item.tags, roleLabels)
  const row = (
    <UnstyledButton
      className="catalog-item-row"
      data-leftover={leftover}
      data-selected={selected}
      disabled={disabled || ineligible}
      onClick={() => onSelect(item)}
      style={ineligible ? { opacity: 0.55 } : undefined}
    >
      <Group wrap="nowrap" align="flex-start" gap="sm">
        {selectionMode && (
          <Checkbox
            checked={selected}
            readOnly
            tabIndex={-1}
            mt={6}
            aria-hidden
            styles={{ input: { pointerEvents: 'none' } }}
          />
        )}
        <RecipePhotoThumb url={item.photoUrl} label={item.name} size={52} />
        <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
          <Text
            fw={600}
            lineClamp={2}
            style={{
              fontFamily: 'var(--mantine-font-family-headings)',
              fontSize: 16,
              lineHeight: 1.3,
            }}
          >
            {item.name}
          </Text>
          <Text size="xs" c="dimmed">
            {leftoverSubtitle}
            {remainingText}
          </Text>
          <Group gap={4}>
            {(item.kind === 'recipe' || item.kind === 'simple-food') && (
              <Badge size="xs" color="dark" variant="outline" radius="sm">
                {kindLabel(t, item.kind)}
              </Badge>
            )}
            {reasonPill && (
              <Badge
                size="xs"
                color={reasonPill.type === 'favorite' ? 'secondary' : 'primary'}
                variant="light"
                radius="sm"
                leftSection={
                  reasonPill.type === 'favorite' ? (
                    <Heart size={10} weight="fill" />
                  ) : (
                    <Link size={10} />
                  )
                }
              >
                {reasonPill.label}
              </Badge>
            )}
            {ineligible ? (
              <Badge
                size="xs"
                color="error"
                variant="filled"
                radius="xl"
                leftSection={<Warning size={10} />}
              >
                {ineligibleLabel}
              </Badge>
            ) : (
              leftover && (
                <Badge size="xs" color="warning" variant="light" radius="xl">
                  {t('catalog.remainingBadge')}
                </Badge>
              )
            )}
            {shownRoles.map((role) => (
              <Badge key={role} size="xs" color="primary" variant="light" radius="sm">
                {roleChipLabel(t, role)}
              </Badge>
            ))}
            {tagLabels.map((tag) => (
              <Badge key={tag} size="xs" variant="outline" radius="xl">
                {tag}
              </Badge>
            ))}
          </Group>
        </Stack>
        <CaretRight
          size={16}
          style={{ color: 'var(--mantine-color-dimmed)', flexShrink: 0, marginTop: 8 }}
        />
      </Group>
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
  loading = false,
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
  toolbar,
  hideSortGroup = false,
  showFiltersButton = true,
  filterDrawerOpened,
  onFilterDrawerOpenedChange,
}: DishCatalogProps) {
  const { t, bcp47 } = useLocalization()
  const [internalFilterOpened, setInternalFilterOpened] = useState(false)
  const filtersOpen = filterDrawerOpened ?? internalFilterOpened
  const setFiltersOpen = (opened: boolean) => {
    onFilterDrawerOpenedChange?.(opened)
    if (filterDrawerOpened === undefined) setInternalFilterOpened(opened)
  }
  const tagFacets = useMemo(
    () =>
      uniqueTagFacets(items, tagNamesById, {
        excludeIds: archivedTagIds,
        retainIds: filters.tagIds,
      }),
    [items, tagNamesById, archivedTagIds, filters.tagIds],
  )
  const extraFilters = catalogActiveFilterCount(filters, showSuggestedFilter)

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

  const visibleSignature = sortedItems
    .map((item) => `${item.key}:${item.tagIds.join(',')}`)
    .join('|')

  useEffect(() => {
    onVisibleItemsChange?.(sortedItems)
    // sortedItems is represented by visibleSignature so identical catalogs do not loop setState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleSignature, onVisibleItemsChange])

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

  const list = loading ? (
    <Stack gap={8}>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} height={64} radius="md" />
      ))}
    </Stack>
  ) : (
    <Stack gap={0}>
      {visibleLeftovers.length > 0 && (
        <Stack gap={8}>
          <Text size="xs" fw={700} tt="uppercase" c="secondary">
            {t('catalog.leftoversThisWeek')}
          </Text>
          {visibleLeftovers.map((item) => (
            <ItemRow key={item.key} item={item} leftover onSelect={onSelect} disabled={disabled} />
          ))}
        </Stack>
      )}

      {groups.length === 0 && visibleLeftovers.length === 0 && (
        <Stack gap={6} align="center" py="md">
          <MagnifyingGlass size={28} style={{ color: 'var(--mantine-color-dimmed)' }} />
          <Text size="sm" c="dimmed" ta="center">
            {extraFilters > 0
              ? t('empty.noFilterMatch')
              : filters.cleanup
                ? t('empty.cleanupNone')
                : (emptyMessage ?? t('empty.noFilterMatch'))}
          </Text>
          {extraFilters > 0 && (
            <Button size="compact-xs" variant="subtle" onClick={clearFilters}>
              {t('catalog.clearFilters')}
            </Button>
          )}
        </Stack>
      )}

      {groups.map((catalogGroup) => (
        <Stack key={catalogGroup.id} gap={8}>
          {catalogGroup.id !== 'ungrouped' && catalogGroup.id !== 'results' && (
            <Text size="xs" fw={700} tt="uppercase" c="dimmed" pt="sm" pb={4}>
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
        leftSection={<MagnifyingGlass size={16} />}
      />

      {!hideSortGroup && (
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
      )}

      {toolbar}

      <Group gap="xs" justify="space-between" wrap="nowrap" align="center">
        <Group gap={6} wrap="wrap" style={{ flex: 1, minWidth: 0 }}>
          {showSuggestedFilter && (
            <Chip
              size="xs"
              radius="sm"
              checked={filters.suggestedOnly}
              onChange={() => setFilters({ suggestedOnly: !filters.suggestedOnly })}
            >
              <Group gap={4} wrap="nowrap">
                <Sparkle size={12} />
                {t('catalog.group.suggested')}
              </Group>
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
        {showFiltersButton && (
          <Button
            size="compact-sm"
            variant="default"
            radius="md"
            leftSection={<Sliders size={14} />}
            onClick={() => setFiltersOpen(true)}
          >
            {extraFilters > 0
              ? t('catalog.filtersCount', { count: extraFilters })
              : t('catalog.filters')}
          </Button>
        )}
      </Group>

      <FilterDrawer
        opened={filtersOpen}
        onClose={() => setFiltersOpen(false)}
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
