# Architecture

Local-first PWA. No backend service.

## Stack

| Concern | Decision |
|---|---|
| Language | TypeScript, strict mode |
| Runtime/tooling | Node 22 LTS, bun |
| UI framework | React |
| Build tool | Vite |
| UI and forms | Mantine |
| Icons | Tabler Icons |
| Routing | React Router, `HashRouter` |
| Local persistence | IndexedDB via Dexie |
| Reactive queries | `dexie-react-hooks`, behind `ui/hooks/*` |
| Runtime validation | Zod |
| Dates | Day.js; meal dates stored as local `YYYY-MM-DD` strings |
| Offline/PWA | `vite-plugin-pwa` (Workbox `generateSW`) |
| Styling | Mantine theme tokens + CSS Modules |
| Static checks | TypeScript + ESLint |
| Tests | None in MVP |

## Layers

```
src/
  app/              bootstrap, router, providers, theme — composition root
  domain/           pure types and rules, no React/Dexie
  application/      use-case services + repository contracts (ports)
  infrastructure/   Dexie database, repository implementations, PWA glue
  ui/               layouts, screens, components, hooks
```

Dependency direction: `ui → application → domain`, `infrastructure → application ports + domain`.
UI never touches Dexie tables directly — always through a `ui/hooks/*` hook or an application service reached via `useServices()`.

## State management

No Redux/Zustand/TanStack Query. Dexie is the source of truth for persisted data (recipes, plans, lists, settings); `@mantine/form` holds unsaved drafts; React context (`servicesContext.ts`) exposes application services; `dexie-react-hooks` keeps views live.

## Offline

Service worker caches the app shell (HTML/JS/CSS/icons) only — user data always lives in IndexedDB, never in the SW cache. Updates are prompted, never forced (`src/infrastructure/pwa/UpdatePrompt.tsx`).
