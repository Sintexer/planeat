import { Badge, Card, Group, Stack, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMemo, useState } from 'react'
import { useServices } from '../../app/servicesContext'
import type { Tag, TagId } from '../../domain/tags/Tag'
import { ScreenHeader } from '../components/ScreenHeader'
import { useRecipes } from '../hooks/useRecipes'
import { useSimpleFoods } from '../hooks/useSimpleFoods'
import { useTags } from '../hooks/useTags'
import type { TagService } from '../../application/tags/TagService'

function TagRow({
  tag,
  usageCount,
  tagService,
}: {
  tag: Tag
  usageCount: number
  tagService: TagService
}) {
  const [name, setName] = useState(tag.name)

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

  return (
    <Card withBorder padding="sm">
      <Group justify="space-between" align="center" wrap="nowrap">
        <TextInput
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          onBlur={() => void commitRename()}
          style={{ flex: 1 }}
        />
        <Badge variant="light" radius="sm">
          Used by {usageCount}
        </Badge>
      </Group>
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
        Household labels used to organize recipes and simple foods. Rename a tag to update it
        everywhere it's assigned — past plan history keeps showing the name it had when cooked.
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
            usageCount={usageCountByTagId.get(tag.id) ?? 0}
            tagService={tagService}
          />
        ))}
      </Stack>
    </Stack>
  )
}
