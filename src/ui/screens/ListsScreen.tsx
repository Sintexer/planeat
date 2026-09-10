import { Badge, Button, Card, Group, SegmentedControl, Stack, Text, Loader } from '@mantine/core'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { PageTitle } from '../components/ScreenHeader'
import { useGroceryLists } from '../hooks/useGroceryLists'
import { useLocalization } from '../localization/LocalizationContext'

type ListSegment = 'current' | 'history'

export function ListsScreen() {
  const lists = useGroceryLists()
  const { t } = useLocalization()
  const [segment, setSegment] = useState<ListSegment>('current')

  const filtered = useMemo(() => {
    if (!lists) return undefined
    if (segment === 'current') return lists.filter((list) => list.status === 'open')
    return lists.filter((list) => list.status === 'closed')
  }, [lists, segment])

  if (lists === undefined) {
    return (
      <Stack gap="md" align="center" py="xl">
        <Loader size="sm" />
        <Text c="dimmed">Loading lists…</Text>
      </Stack>
    )
  }

  return (
    <Stack gap="lg">
      <PageTitle>Groceries</PageTitle>

      <SegmentedControl
        fullWidth
        radius="xl"
        value={segment}
        onChange={(value) => setSegment(value as ListSegment)}
        data={[
          { label: 'Current', value: 'current' },
          { label: 'History', value: 'history' },
        ]}
      />

      <Text size="sm" c="dimmed">
        Generate a list from Plan, then check items off as you shop. Plan edits never silently
        overwrite a list — use Update from Plan when you want a refresh.
      </Text>

      {filtered?.length === 0 && (
        <Text c="dimmed">
          {segment === 'current' ? t('empty.listsOpen') : t('empty.listsClosed')}
        </Text>
      )}

      <Stack gap={12}>
        {filtered?.map((list) => (
          <Card
            key={list.id}
            padding={12}
            radius="md"
            withBorder
            component={Link}
            to={`/lists/${list.id}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <Group justify="space-between" wrap="nowrap" gap="sm">
              <Stack gap={2} style={{ minWidth: 0 }}>
                <Text fw={600}>{list.title}</Text>
                <Text size="xs" c="dimmed">
                  Updated {new Date(list.updatedAt).toLocaleString()}
                </Text>
              </Stack>
              {segment === 'history' ? (
                <Button component="span" size="compact-sm" variant="light" radius="xl">
                  View
                </Button>
              ) : (
                <Badge color="green" variant="light">
                  {list.status}
                </Badge>
              )}
            </Group>
          </Card>
        ))}
      </Stack>

      <Button component={Link} to="/plan" variant="light">
        Go to plan
      </Button>
    </Stack>
  )
}
