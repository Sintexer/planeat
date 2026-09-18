import { Badge, Button, Card, Group, Select, Stack, Text, TextInput } from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useMemo, useState } from 'react'
import { useServices } from '../../app/servicesContext'
import { isTagArchived, type Tag, type TagId } from '../../domain/tags/Tag'
import { ScreenHeader } from '../components/ScreenHeader'
import { useLocalization } from '../localization/LocalizationContext'
import { useRecipes } from '../hooks/useRecipes'
import { useSimpleFoods } from '../hooks/useSimpleFoods'
import { useTags } from '../hooks/useTags'
import type { TagService } from '../../application/tags/TagService'

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
  const { t, tPlural } = useLocalization()
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
            ? t('tags.nameCollision')
            : result.error === 'empty-name'
              ? t('tags.emptyName')
              : t('tags.notFound'),
        color: 'error',
      })
      return
    }
    notifications.show({ message: t('tags.renamed'), color: 'success' })
  }

  const handleArchiveToggle = async () => {
    const result = archived
      ? await tagService.unarchiveTag(tag.id)
      : await tagService.archiveTag(tag.id)
    if (!result.ok) {
      notifications.show({ message: t('tags.notFound'), color: 'error' })
      return
    }
    notifications.show({
      message: archived ? t('tags.restored') : t('tags.archivedNotice'),
      color: 'success',
    })
  }

  const handleMerge = (targetId: string | null) => {
    setMergeTarget(targetId)
    if (!targetId) return
    const target = otherTags.find((candidate) => candidate.id === targetId)
    if (!target) return
    modals.openConfirmModal({
      title: t('tags.mergeTitle'),
      children: <Text>{t('tags.mergeBody', { source: tag.name, target: target.name })}</Text>,
      labels: { confirm: t('tags.merge'), cancel: t('action.cancel') },
      confirmProps: { color: 'error' },
      onCancel: () => setMergeTarget(null),
      onConfirm: () => {
        void (async () => {
          const result = await tagService.mergeTags(tag.id, targetId)
          if (!result.ok) {
            notifications.show({
              message: result.error === 'same-tag' ? t('tags.sameTag') : t('tags.notFound'),
              color: 'error',
            })
            setMergeTarget(null)
            return
          }
          notifications.show({
            message: t('tags.mergedInto', { name: target.name }),
            color: 'success',
          })
        })()
      },
    })
  }

  const handleDelete = async () => {
    const usage = await tagService.countLiveAssignments(tag.id)
    modals.openConfirmModal({
      title: t('tags.deleteTitle', { name: tag.name }),
      children: (
        <Text>
          {t('tags.deleteBody', {
            recipes: tPlural('tags.recipeCount', usage.recipeCount),
            foods: tPlural('tags.foodCount', usage.simpleFoodCount),
          })}
        </Text>
      ),
      labels: { confirm: t('tags.deleteConfirm'), cancel: t('action.cancel') },
      confirmProps: { color: 'error' },
      onConfirm: () => {
        void (async () => {
          const result = await tagService.deleteTag(tag.id)
          if (!result.ok) {
            notifications.show({ message: t('tags.notFound'), color: 'error' })
            return
          }
          notifications.show({ message: t('tags.deleted'), color: 'success' })
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
            aria-label={t('tags.renameNamed', { name: tag.name })}
          />
          <Badge variant="light" radius="sm">
            {t('tags.usedBy', { count: usageCount })}
          </Badge>
          {archived && (
            <Badge variant="outline" color="gray" radius="sm">
              {t('tags.archived')}
            </Badge>
          )}
        </Group>
        <Group gap="xs" wrap="wrap">
          <Button size="xs" variant="light" onClick={() => void handleArchiveToggle()}>
            {archived ? t('tags.restore') : t('tags.archive')}
          </Button>
          <Select
            size="xs"
            placeholder={t('tags.mergeInto')}
            clearable
            searchable
            w={180}
            value={mergeTarget}
            data={otherTags.map((candidate) => ({
              value: candidate.id,
              label: isTagArchived(candidate)
                ? t('tags.archivedSuffix', { name: candidate.name })
                : candidate.name,
            }))}
            onChange={handleMerge}
            disabled={otherTags.length === 0}
            aria-label={t('tags.mergeNamed', { name: tag.name })}
          />
          <Button size="xs" variant="light" color="error" onClick={() => void handleDelete()}>
            {t('action.delete')}
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
  const { t } = useLocalization()

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
      <ScreenHeader title={t('tags.title')} fallbackTo="/recipes" />

      <Text size="sm" c="dimmed">
        {t('tags.help')}
      </Text>

      {tags === undefined && <Text c="dimmed">{t('common.loading')}</Text>}
      {tags?.length === 0 && <Text c="dimmed">{t('tags.empty')}</Text>}

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
