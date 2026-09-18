# Deployment & Infrastructure

PlanEat has **no backend, no server-rendered routing, and no cloud infrastructure**. There is currently no CI/CD pipeline, no Terraform, and no committed hosting configuration in this repository — "deployment" here means producing the static build output and putting it on any static host.

## Deployment Overview

`bun run build` produces a fully static site in `dist/` (HTML/JS/CSS plus the generated PWA manifest and service worker). That output is the entire deployable artifact — deploy it to any static host (e.g. GitHub Pages, Netlify, Cloudflare Pages, S3 + CloudFront, or a plain web server). All application data lives in the browser's IndexedDB; the host serves files only and never sees household data.

## Application Packaging

```bash
bun install
bun run build     # tsc -b && vite build → writes dist/
bun run preview   # optional: serve dist/ locally to sanity-check the build
```

There is no container image, no server process to package, and no environment variables to configure at build or runtime.

## Prerequisites

- Bun and Node.js `>=22.0.0 <23.0.0` (same as local development — see the root [README.md](../README.md)).
- Whatever the chosen static host requires (e.g. a CLI login for Netlify/Cloudflare Pages, or push access to a `gh-pages` branch for GitHub Pages). None of that is prescribed by this repo today.

## Routing

The app uses React Router's `HashRouter` (`src/app/router.tsx`) specifically because there's no backend to configure server-side rewrites for a history-mode router — every route lives under the `#` fragment, so a static host only ever needs to serve `index.html` at the root. If a future change moves to `BrowserRouter`, the chosen host's rewrite/fallback rule (e.g. "redirect all 404s to `/index.html`") becomes a real prerequisite and this section should be updated accordingly.

## PWA / Service Worker

`vite-plugin-pwa` (Workbox `generateSW`, see `vite.config.ts`) generates `dist/sw.js` at build time. It precaches the app shell only — never household data — and `registerType: 'prompt'` means an update is offered to the user, never forced (`src/infrastructure/pwa/`). No host-side configuration is required for this beyond serving the generated files as-is with their default cache headers; do not add a CDN rule that caches `sw.js` itself for longer than a few minutes, or updates will be slow to reach users.

## CI/CD

None exists in this repository today. If one is added, it should run the same gate already expected of a manual change (`bun run format:check`, `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build` — see [AGENTS.md](../AGENTS.md)) before publishing `dist/` to the chosen host, and this section should be updated with the actual pipeline.
