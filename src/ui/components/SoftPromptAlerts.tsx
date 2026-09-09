import { Alert, Stack } from '@mantine/core'
import type { SoftPrompt } from '../../domain/plans/softPrompts'

function displayMessage(prompt: SoftPrompt, omitDatePrefix: boolean): string {
  if (!omitDatePrefix || !prompt.date) return prompt.message
  const prefix = `${prompt.date}: `
  return prompt.message.startsWith(prefix) ? prompt.message.slice(prefix.length) : prompt.message
}

export function SoftPromptAlerts({
  prompts,
  omitDatePrefix = false,
}: {
  prompts: SoftPrompt[]
  /** When alerts sit under a day heading, drop the leading `YYYY-MM-DD: ` from the copy. */
  omitDatePrefix?: boolean
}) {
  if (prompts.length === 0) return null
  return (
    <Stack gap="xs">
      {prompts.map((prompt) => (
        <Alert
          key={prompt.id}
          color={prompt.severity === 'warning' ? 'yellow' : 'blue'}
          title={prompt.severity === 'warning' ? 'Planning tip' : 'Suggestion'}
        >
          {displayMessage(prompt, omitDatePrefix)}
        </Alert>
      ))}
    </Stack>
  )
}
