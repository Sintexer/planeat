import { Button, Group, Notification } from '@mantine/core'
import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Update is user-confirmed, never a forced reload — a reload could discard an
 * unsaved recipe form draft. See CLAUDE.md offline "Update behavior".
 */
export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (offlineReady) {
    return (
      <Notification
        color="green"
        onClose={() => setOfflineReady(false)}
        style={{ position: 'fixed', bottom: 76, left: 16, right: 16, zIndex: 300 }}
      >
        App is ready to work offline.
      </Notification>
    )
  }

  if (needRefresh) {
    return (
      <Notification
        color="blue"
        onClose={() => setNeedRefresh(false)}
        style={{ position: 'fixed', bottom: 76, left: 16, right: 16, zIndex: 300 }}
      >
        <Group justify="space-between">
          <span>An update is available.</span>
          <Button size="xs" onClick={() => updateServiceWorker(true)}>
            Reload when ready
          </Button>
        </Group>
      </Notification>
    )
  }

  return null
}
