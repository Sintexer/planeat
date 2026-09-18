import { Alert, Stack } from '@mantine/core'
import type { SoftPrompt } from '../../domain/plans/softPrompts'
import { useLocalization } from '../localization/LocalizationContext'
import type { Translate } from '../localization/t'

function promptBody(prompt: SoftPrompt, t: Translate): string {
  const params = prompt.params ?? {}
  switch (prompt.kind) {
    case 'max-units':
      return t('prompt.maxUnits', params)
    case 'demanding':
      return t('prompt.demanding')
    case 'quick-only':
      return t('prompt.quickOnly')
    case 'preferred-prep':
      return t('prompt.preferredPrep')
    case 'vegetables':
      return t('prompt.vegetables')
    case 'breakfast-repeat':
      return t('prompt.breakfastRepeat')
    case 'identical-dinners':
      return t('prompt.identicalDinners', params)
    case 'previous-week-reuse':
      return t('prompt.previousWeek', params)
  }
}

export function SoftPromptAlerts({
  prompts,
  omitDatePrefix = false,
}: {
  prompts: SoftPrompt[]
  omitDatePrefix?: boolean
}) {
  const { t } = useLocalization()
  if (prompts.length === 0) return null
  return (
    <Stack gap="xs">
      {prompts.map((prompt) => {
        const body = promptBody(prompt, t)
        const text = omitDatePrefix || !prompt.date ? body : `${prompt.date}: ${body}`
        return (
          <Alert
            key={prompt.id}
            color={prompt.severity === 'warning' ? 'yellow' : 'blue'}
            title={prompt.severity === 'warning' ? t('prompt.warningTitle') : t('prompt.infoTitle')}
          >
            {text}
          </Alert>
        )
      })}
    </Stack>
  )
}
