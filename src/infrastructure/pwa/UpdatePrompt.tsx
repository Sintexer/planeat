import { Button, Group, Notification } from '@mantine/core'
import { useRegisterSW } from 'virtual:pwa-register/react'

interface UpdatePromptProps {
  offlineReadyMessage: string
  updateAvailableMessage: string
  reloadWhenReadyLabel: string
}

/**
 * Update is user-confirmed, never a forced reload — a reload could discard an
 * unsaved recipe form draft. See CLAUDE.md offline "Update behavior".
 */
export function UpdatePrompt({
  offlineReadyMessage,
  updateAvailableMessage,
  reloadWhenReadyLabel,
}: UpdatePromptProps) {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (offlineReady) {
    return (
      <Notification
        color="success"
        onClose={() => setOfflineReady(false)}
        style={{ position: 'fixed', bottom: 76, left: 16, right: 16, zIndex: 300 }}
      >
        {offlineReadyMessage}
      </Notification>
    )
  }

  if (needRefresh) {
    return (
      <Notification
        color="primary"
        onClose={() => setNeedRefresh(false)}
        style={{ position: 'fixed', bottom: 76, left: 16, right: 16, zIndex: 300 }}
      >
        <Group justify="space-between">
          <span>{updateAvailableMessage}</span>
          <Button size="xs" onClick={() => updateServiceWorker(true)}>
            {reloadWhenReadyLabel}
          </Button>
        </Group>
      </Notification>
    )
  }

  return null
}
