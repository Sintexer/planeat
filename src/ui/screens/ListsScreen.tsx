import { Badge, Button, Card, Group, Stack, Text, Title, Loader } from '@mantine/core'
import { Link } from 'react-router'
import { useGroceryLists } from '../hooks/useGroceryLists'

export function ListsScreen() {
  const lists = useGroceryLists()

  if (lists === undefined) {
    return (
      <Stack gap="md" align="center" py="xl">
        <Loader size="sm" />
        <Text c="dimmed">Loading lists…</Text>
      </Stack>
    )
  }

  return (
    <Stack gap="md">
      <Title order={2}>Grocery lists</Title>
      <Text size="sm" c="dimmed">
        Generate a list from a week plan, then check items off as you shop. Plan edits never
        silently overwrite a list — use Update from the week screen when you want a refresh.
      </Text>

      {lists.length === 0 && <Text c="dimmed">No grocery lists yet.</Text>}

      <Stack gap="xs">
        {lists.map((list) => (
          <Card key={list.id} withBorder padding="sm" component={Link} to={`/lists/${list.id}`}>
            <Group justify="space-between" wrap="nowrap">
              <Stack gap={2}>
                <Text fw={600}>{list.title}</Text>
                <Text size="xs" c="dimmed">
                  Updated {new Date(list.updatedAt).toLocaleString()}
                </Text>
              </Stack>
              <Badge color={list.status === 'open' ? 'green' : 'gray'} variant="light">
                {list.status}
              </Badge>
            </Group>
          </Card>
        ))}
      </Stack>

      <Button component={Link} to="/week" variant="light">
        Go to week plan
      </Button>
    </Stack>
  )
}
