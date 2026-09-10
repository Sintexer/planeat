import { Box, Text } from '@mantine/core'
import { useState } from 'react'

interface RecipePhotoThumbProps {
  url?: string
  label: string
  size: number
}

export function RecipePhotoThumb({ url, label, size }: RecipePhotoThumbProps) {
  const [failedUrl, setFailedUrl] = useState<string | undefined>(undefined)
  const showImg = Boolean(url) && failedUrl !== url
  const initial = label.trim().charAt(0).toUpperCase() || '?'

  return (
    <Box
      w={size}
      h={size}
      style={{
        flexShrink: 0,
        borderRadius: 'var(--mantine-radius-md)',
        overflow: 'hidden',
        background: 'var(--mantine-color-default-hover)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {showImg ? (
        <img
          src={url}
          alt=""
          width={size}
          height={size}
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(url)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <Text fw={700} size={size >= 72 ? 'xl' : 'sm'} c="dimmed">
          {initial}
        </Text>
      )}
    </Box>
  )
}
