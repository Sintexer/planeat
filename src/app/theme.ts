import { createTheme, type DefaultMantineColor, type MantineColorsTuple } from '@mantine/core'

/** Terracotta — schema base #cf6139, hover #bb4717, dark-mode #e67d58 at shade 4. */
const primary: MantineColorsTuple = [
  '#fbeee8',
  '#f6d9cc',
  '#edb8a0',
  '#e39474',
  '#e67d58',
  '#d46c47',
  '#cf6139',
  '#bb4717',
  '#9a3a13',
  '#6e280d',
]

/** Berry — schema #b7445d, used sparingly (favorites, occasional tags). */
const secondary: MantineColorsTuple = [
  '#f8e9ed',
  '#f0cdd6',
  '#e3a3b3',
  '#d47890',
  '#c85b76',
  '#bf4e6a',
  '#b7445d',
  '#9c3850',
  '#7d2c40',
  '#5a1f2e',
]

/** Confirmations and completed items only — never decorative. */
const success: MantineColorsTuple = [
  '#eaf4eb',
  '#d2e7d4',
  '#a8cfaa',
  '#7bb57e',
  '#5a9f5e',
  '#4e984f',
  '#47944c',
  '#3b7c40',
  '#2f6333',
  '#214626',
]

/** Plan gaps, low-stock, carryover risk — never decorative. */
const warning: MantineColorsTuple = [
  '#fbf4e0',
  '#f7e6b3',
  '#f0d47a',
  '#e9c24a',
  '#e6b836',
  '#e4b22e',
  '#e3ae28',
  '#c4900f',
  '#9a700c',
  '#6e5008',
]

/** Destructive actions and validation only. */
const error: MantineColorsTuple = [
  '#fbeaea',
  '#f5c9ca',
  '#ea9799',
  '#de6669',
  '#d44a4d',
  '#cf3c3f',
  '#cc3336',
  '#b02b2e',
  '#8c2224',
  '#63181a',
]

/** Warm espresso surfaces for dark-mode Paper / Modal. */
const dark: MantineColorsTuple = [
  '#f4ede8',
  '#e4dcd6',
  '#c4b8b0',
  '#948577',
  '#675b54',
  '#4f443f',
  '#3a312c',
  '#261d19',
  '#1e1612',
  '#17100c',
]

export const theme = createTheme({
  primaryColor: 'primary',
  primaryShade: { light: 6, dark: 4 },
  defaultRadius: 'md',
  fontFamily: 'Inter, sans-serif',
  headings: { fontFamily: 'Sora, Inter, sans-serif' },
  colors: {
    primary,
    secondary,
    success,
    warning,
    error,
    dark,
  },
  white: '#fffdf9',
  black: '#271d17',
  radius: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },
})

type AppColor = 'primary' | 'secondary' | 'success' | 'warning' | 'error'

declare module '@mantine/core' {
  export interface MantineThemeColorsOverride {
    colors: Record<AppColor | DefaultMantineColor, MantineColorsTuple>
  }
}
