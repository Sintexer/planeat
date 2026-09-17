import { Badge, Button, Card, Group, Select, Stack, Text, TextInput } from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useMemo, useState } from 'react'
import { useServices } from '../../app/servicesContext'
import { isTagArchived, type Tag, type TagId } from '../../domain/tags/Tag'
import { ScreenHeader } from '../components/ScreenHeader'
import { useRecipes } from '../hooks/useRecipes'
import { useSimpleFoods } from '../hooks/useSimpleFoods'
import { useTags } from '../hooks/useTags'
import type { TagService } from '../../application/tags/TagService'

function usageLabel(count: number): string {
  return `Used by ${count}`
}

function TagRow({
  tag,
  otherTags,
  usageCount,
  tagService,
}: {
  tag: Tag
  otherTags: Tag[]
  usageCount: number
  tagService: TagService
}) {
  const [name, setName] = useState(tag.name)
  const [mergeTarget, setMergeTarget] = useState<string | null>(null)
  const archived = isTagArchived(tag)

  const commitRename = async () => {
    const trimmed = name.trim()
    if (trimmed === tag.name) {
      setName(tag.name)
      return
    }
    const result = await tagService.renameTag(tag.id, trimmed)
    if (!result.ok) {
      setName(tag.name)
      notifications.show({
        message:
          result.error === 'name-collision'
            ? 'Another tag already has that name'
            : result.error === 'empty-name'
              ? 'Tag name cannot be empty'
              : 'Tag not found',
        color: 'red',
      })
      return
    }
    notifications.show({ message: 'Tag renamed', color: 'green' })
  }

  const handleArchiveToggle = async () => {
    const result = archived
      ? await tagService.unarchiveTag(tag.id)
      : await tagService.archiveTag(tag.id)
    if (!result.ok) {
      notifications.show({ message: 'Tag not found', color: 'red' })
      return
    }
    notifications.show({
      message: archived ? 'Tag restored to autocomplete' : 'Tag archived',
      color: 'green',
    })
  }

  const handleMerge = (targetId: string | null) => {
    setMergeTarget(targetId)
    if (!targetId) return
    const target = otherTags.find((candidate) => candidate.id === targetId)
    if (!target) return
    modals.openConfirmModal({
      title: 'Merge tags',
      children: (
        <Text>
          Merge “{tag.name}” into “{target.name}”? Live recipes and simple foods will show only “
          {target.name}” (duplicates collapsed). Past leftover and plan labels stay as they were
          when cooked.
        </Text>
      ),
      labels: { confirm: 'Merge', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onCancel: () => setMergeTarget(null),
      onConfirm: () => {
        void (async () => {
          const result = await tagService.mergeTags(tag.id, targetId)
          if (!result.ok) {
            notifications.show({
              message: result.error === 'same-tag' ? 'Pick a different tag' : 'Tag not found',
              color: 'red',
            })
            setMergeTarget(null)
            return
          }
          notifications.show({ message: `Merged into “${target.name}”`, color: 'green' })
        })()
      },
    })
  }

  const handleDelete = async () => {
    const usage = await tagService.countLiveAssignments(tag.id)
    modals.openConfirmModal({
      title: `Delete “${tag.name}”?`,
      children: (
        <Text>
          This tag is on {usage.recipeCount} recipe{usage.recipeCount === 1 ? '' : 's'} and{' '}
          {usage.simpleFoodCount} simple food{usage.simpleFoodCount === 1 ? '' : 's'}. Deleting it
          removes only the tag — recipes and simple foods stay. Past leftover and plan labels are
          unchanged.
        </Text>
      ),
      labels: { confirm: 'Delete tag', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        void (async () => {
          const result = await tagService.deleteTag(tag.id)
          if (!result.ok) {
            notifications.show({ message: 'Tag not found', color: 'red' })
            return
          }
          notifications.show({ message: 'Tag deleted', color: 'green' })
        })()
      },
    })
  }

  return (
    <Card withBorder padding="sm">
      <Stack gap="sm">
        <Group justify="space-between" align="center" wrap="nowrap">
          <TextInput
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            onBlur={() => void commitRename()}
            style={{ flex: 1 }}
            aria-label={`Rename ${tag.name}`}
          />
          <Badge variant="light" radius="sm">
            {usageLabel(usageCount)}
          </Badge>
          {archived && (
            <Badge variant="outline" color="gray" radius="sm">
              Archived
            </Badge>
          )}
        </Group>
        <Group gap="xs" wrap="wrap">
          <Button size="xs" variant="light" onClick={() => void handleArchiveToggle()}>
            {archived ? 'Restore' : 'Archive'}
          </Button>
          <Select
            size="xs"
            placeholder="Merge into…"
            clearable
            searchable
            w={180}
            value={mergeTarget}
            data={otherTags.map((candidate) => ({
              value: candidate.id,
              label: isTagArchived(candidate) ? `${candidate.name} (archived)` : candidate.name,
            }))}
            onChange={handleMerge}
            disabled={otherTags.length === 0}
            aria-label={`Merge ${tag.name} into another tag`}
          />
          <Button size="xs" variant="light" color="red" onClick={() => void handleDelete()}>
            Delete
          </Button>
        </Group>
      </Stack>
    </Card>
  )
}

export function TagsScreen() {
  const { tagService } = useServices()
  const tags = useTags()
  const recipes = useRecipes()
  const simpleFoods = useSimpleFoods()

  const usageCountByTagId = useMemo(() => {
    const counts = new Map<TagId, number>()
    for (const recipe of recipes ?? []) {
      for (const tagId of recipe.tagIds) {
        counts.set(tagId, (counts.get(tagId) ?? 0) + 1)
      }
    }
    for (const food of simpleFoods ?? []) {
      for (const tagId of food.tagIds) {
        counts.set(tagId, (counts.get(tagId) ?? 0) + 1)
      }
    }
    return counts
  }, [recipes, simpleFoods])

  return (
    <Stack gap="md">
      <ScreenHeader title="Tags" fallbackTo="/recipes" />

      <Text size="sm" c="dimmed">
        Household labels used to organize recipes and simple foods. Rename, archive, merge, or
        delete a tag here — food items are never deleted. Past plan history keeps showing the name
        it had when cooked.
      </Text>

      {tags === undefined && <Text c="dimmed">Loading…</Text>}
      {tags?.length === 0 && (
        <Text c="dimmed">No tags yet. Add one while editing a recipe or simple food.</Text>
      )}

      <Stack gap="xs">
        {tags?.map((tag) => (
          <TagRow
            key={tag.id}
            tag={tag}
            otherTags={tags.filter((candidate) => candidate.id !== tag.id)}
            usageCount={usageCountByTagId.get(tag.id) ?? 0}
            tagService={tagService}
          />
        ))}
      </Stack>
    </Stack>
  )
}
