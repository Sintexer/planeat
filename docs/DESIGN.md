# Visual Design and UX Guidelines

This document describes the current visual identity and UI conventions for PlanEat. Update it in the same change that touches `src/app/theme.ts`, `src/index.css` color-scheme tokens, or a reusable UI pattern.

## Overview

PlanEat follows a warm cream/espresso household visual language: mostly neutrals, one terracotta accent, and semantic color only when it carries meaning. The source mockups live in `design/Meal Planner Design Schema.dc.html`. Tokens are defined in `src/app/theme.ts` (palettes, type, radius) and applied to Mantine surface CSS variables in `src/index.css` (`:root[data-mantine-color-scheme='light'|'dark']`). Do not add a third token source.

## Theme

`src/app/theme.ts` sets `primaryColor: 'primary'` (terracotta), Inter for body, Sora for headings, and a radius scale where `md` is 8px (buttons/inputs) and `lg` is 12px (cards). Custom palettes: `primary`, `secondary` (berry, one moment per screen at most), `success`, `warning`, `error`, plus a warm espresso `dark` array for dark-mode Paper/Modal.

Surface neutrals (also in `src/index.css`):

| Token                     | Light                                              | Dark                |
| ------------------------- | -------------------------------------------------- | ------------------- |
| bg / body                 | `#fff7f1`                                          | `#17100c`           |
| surface / default         | `#fffdf9`                                          | `#261d19`           |
| text                      | `#271d17`                                          | `#f4ede8`           |
| border                    | `#e4dcd6`                                          | `#3a312c`           |
| primary                   | `#cf6139` (hover `#bb4717`; dark filled `#e67d58`) |                     |
| secondary                 | `#b7445d`                                          |                     |
| success / warning / error | `#47944c` / `#e3ae28` / `#cc3336`                  | functional use only |

Sora (500/600/700) and Inter (400/500/600) are self-hosted `woff2` files under `public/fonts/` — no Google Fonts CDN. Phosphor icons (`@phosphor-icons/react`) replace Tabler: Regular by default, Fill/Bold for selected/active.

The PWA `theme_color` is `#cf6139` (`index.html`, `vite.config.ts`).

## Layout

- `src/ui/layouts/AppLayout.tsx` + `src/ui/components/BottomNav.tsx`: a fixed bottom navigation bar (Plan / Groceries / Recipes / Settings), `HashRouter`-based routing. This is a mobile-first layout — desktop is not a separate design target.
- `src/ui/components/ScreenHeader.tsx`: the shared per-screen title/back-navigation header, used instead of ad hoc `<Title>` + back-button markup per screen.
- Plan has two views: a horizontally scrollable week grid (`src/ui/plans/PlanWeekGrid.tsx`) as the default, drilling into the existing day strip + `MealSlotCard` stack.
- Screens are `Stack`-based single-column layouts; there is no custom grid system beyond the Plan week grid.

## Components — conventions to follow, not just examples

- **Prefer existing Mantine components** (`@mantine/core`, `@mantine/form`, `@mantine/dates`, `@mantine/notifications`, `@mantine/modals`) over building a custom control. Only add a domain component (e.g. `MealCard`, `RecipePhotoThumb`) when it composes Mantine components for a specific app behavior — see `AGENTS.md`'s Conventions section.
- **Confirmation and disambiguation dialogs go through `@mantine/modals`**, never screen-local modal-open state:
  - `modals.openConfirmModal` for destructive/replace confirmations (see `SettingsScreen.tsx`'s restore-backup confirmation for the reference pattern).
  - `modals.open` with custom content for a richer flow, e.g. `src/ui/components/IngredientCandidateModal.tsx`'s ambiguous-ingredient candidate picker.
- **Tag/label entry uses Mantine `TagsInput`**, not a comma-separated free-text field — this replaced the last comma-split UI in the app (recipe tags in Sprint 8, ingredient aliases later). Reach for `TagsInput` for any new "list of short strings" input rather than reintroducing comma-splitting.
- **Ingredient identity entry uses a browsable combobox**, not a plain `TextInput` — see `src/ui/components/IngredientNameField.tsx`. It combines a Mantine `Combobox` (click/focus to browse the full ingredient list without typing) with `fuse.js` fuzzy filtering while typing. Fuzzy search is advisory only: selecting a suggestion or confirming typed text always resolves through `IngredientService`, never by trusting the fuzzy match directly (see `AGENTS.md`: `fuse.js` proposes candidates, it must never merge identity).
- **Offline-safe media**: `RecipePhotoThumb.tsx` renders a reliable placeholder when a remote `photoUrl` can't load — backups never include image bytes, only URLs, so this placeholder path is load-bearing, not cosmetic.
- **Filter UI**: `src/ui/catalog/FilterDrawer.tsx` is a Mantine `Drawer`-based staged-filter panel (draft state, explicit "Show N items" commit) — the reference pattern for any future multi-facet filter UI, instead of applying every toggle immediately.
- **Meal-type color**: do not tint cards per breakfast/lunch/dinner. One terracotta icon circle on a neutral card for every meal type.

## Do's and Don't's

- **Do** reach for a stock Mantine component first; only wrap it when there's a repeated, app-specific behavior to encapsulate.
- **Do** route every confirmation/disambiguation dialog through `@mantine/modals`.
- **Do** keep `success` / `warning` / `error` for their meaning (confirmations, plan gaps, destructive/validation). Leftover chips stay neutral; carryover-risk uses `warning`.
- **Don't** introduce a third design-token source beyond `src/app/theme.ts` and the Mantine CSS-variable overrides in `src/index.css`.
- **Don't** load fonts from a CDN — self-host under `public/fonts/` so the PWA can precache `woff2`.
- **Don't** reintroduce comma-separated text entry for a list of short strings — use `TagsInput`.
- **Don't** treat this document as permission to invent a bigger design system than the product currently has. Keep it in sync with what's actually in `src/app/theme.ts` and the components above.
