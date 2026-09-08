import { Title, Text } from '@mantine/core'

export function TodayScreen() {
  return (
    <>
      <Title order={2} mb="xs">
        Today
      </Title>
      <Text c="dimmed">No meals planned yet.</Text>
    </>
  )
}
