import {
  Alert,
  Button,
  FileButton,
  Group,
  Stack,
  Text,
  Textarea,
  UnstyledButton,
} from '@mantine/core'
import { Dropzone } from '@mantine/dropzone'
import { notifications } from '@mantine/notifications'
import { UploadSimple } from '@phosphor-icons/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useServices } from '../../app/servicesContext'
import type { ImportCandidate } from '../../application/recipes/RecipeImportService'
import { ScreenHeader } from '../components/ScreenHeader'
import { useLocalization } from '../localization/LocalizationContext'
import { importErrorCopy } from '../localization/errors'
import { writeImportDraft } from '../recipes/importDraft'

const ACCEPT = {
  'application/json': ['.json', '.jsonld'],
  'application/ld+json': ['.jsonld'],
  'text/html': ['.html', '.htm'],
  'text/plain': ['.txt', '.json', '.jsonld', '.html', '.htm'],
}

export function RecipeImportScreen() {
  const navigate = useNavigate()
  const { recipeImportService } = useServices()
  const { t, tPlural } = useLocalization()
  const [paste, setPaste] = useState('')
  const [busy, setBusy] = useState(false)
  const [candidates, setCandidates] = useState<ImportCandidate[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const openCandidate = (candidate: ImportCandidate) => {
    writeImportDraft({
      form: candidate.normalized.form,
      hints: candidate.normalized.hints,
    })
    navigate('/recipes/new')
  }

  const runExtract = (raw: string) => {
    setError(null)
    setCandidates(null)
    const result = recipeImportService.extractAndNormalize(raw)
    if (!result.ok) {
      const message = importErrorCopy(t, result.error)
      setError(message)
      notifications.show({ message, color: 'error' })
      return
    }
    if (result.candidates.length === 1) {
      openCandidate(result.candidates[0])
      return
    }
    setCandidates(result.candidates)
  }

  const handleSubmit = () => {
    runExtract(paste)
  }

  const handleFileText = async (file: File) => {
    setBusy(true)
    try {
      const text = await file.text()
      setPaste(text)
      runExtract(text)
    } catch {
      notifications.show({ message: t('import.readFailed'), color: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack gap="md">
      <ScreenHeader title={t('import.title')} fallbackTo="/recipes" />

      <Text size="sm" c="dimmed">
        {t('import.help')}
      </Text>

      <Textarea
        label={t('import.pasteLabel')}
        minRows={10}
        autosize
        maxRows={20}
        value={paste}
        onChange={(e) => setPaste(e.currentTarget.value)}
        placeholder='{ "@type": "Recipe", "name": "…" }'
      />

      <Dropzone
        onDrop={(files) => {
          const file = files[0]
          if (file) void handleFileText(file)
        }}
        onReject={() => notifications.show({ message: t('import.badFileType'), color: 'yellow' })}
        accept={ACCEPT}
        maxFiles={1}
        loading={busy}
      >
        <Group justify="center" gap="sm" mih={80} style={{ pointerEvents: 'none' }}>
          <UploadSimple size={20} />
          <Text size="sm">{t('import.dropFile')}</Text>
        </Group>
      </Dropzone>

      <Group>
        <FileButton
          accept=".json,.jsonld,.html,.htm,application/json,text/html"
          onChange={(file) => {
            if (file) void handleFileText(file)
          }}
        >
          {(props) => (
            <Button variant="default" loading={busy} {...props}>
              {t('import.chooseFile')}
            </Button>
          )}
        </FileButton>
        <Button onClick={handleSubmit} loading={busy}>
          {t('import.extract')}
        </Button>
      </Group>

      {error && (
        <Alert color="error" title={t('import.failedTitle')}>
          {error}
        </Alert>
      )}

      {candidates && candidates.length > 1 && (
        <Stack gap="xs">
          <Text fw={600}>{t('import.pickOne')}</Text>
          {candidates.map((candidate, index) => (
            <UnstyledButton
              key={`${candidate.normalized.displayName}-${index}`}
              onClick={() => openCandidate(candidate)}
              p="sm"
              style={{
                border: '1px solid var(--mantine-color-default-border)',
                borderRadius: 8,
                textAlign: 'left',
              }}
            >
              <Text size="sm" fw={500}>
                {candidate.normalized.displayName}
              </Text>
              <Text size="xs" c="dimmed">
                {tPlural(
                  'import.ingredientLines',
                  candidate.normalized.form.ingredientLines.filter((l) => l.name).length,
                )}
              </Text>
            </UnstyledButton>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
