import { Box, Text } from '@mantine/core'
import { useState } from 'react'
import { useLocalization } from '../localization/LocalizationContext'

interface RecipePhotoThumbProps {
  url?: string
  label: string
  size: number
}

export function RecipePhotoThumb({ url, label, size }: RecipePhotoThumbProps) {
  const { t } = useLocalization()
  const [failedUrl, setFailedUrl] = useState<string | undefined>(undefined)
  const showImg = Boolean(url) && failedUrl !== url
  const initial = label.trim().charAt(0).toUpperCase() || '?'
  const failed = Boolean(url) && failedUrl === url

  return (
    <Box
      w={size}
      h={size}
      title={failed ? t('photo.unavailable') : undefined}
      style={{
        flexShrink: 0,
        borderRadius: 'var(--mantine-radius-lg)',
        overflow: 'hidden',
        background: showImg
          ? 'var(--mantine-color-default-hover)'
          : 'repeating-linear-gradient(-45deg, var(--mantine-color-default-hover) 0 6px, transparent 6px 12px), var(--mantine-color-default)',
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
          loading="lazy"
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
