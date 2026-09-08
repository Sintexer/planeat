import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates public/ icons (incl. maskable) from a single source SVG so we don't
// hand-maintain every PWA icon size. Re-run with `bunx pwa-assets-generator` after
// swapping in real branded artwork (source image is still the generic Vite mark).
export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/favicon.svg'],
})
