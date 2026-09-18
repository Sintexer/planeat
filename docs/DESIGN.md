# Visual Design and UX Guidelines

This document describes the current visual identity and UI conventions for PlanEat. There is no separate design-token file or brand system beyond what's listed here — this **is** the source of truth, and it should stay accurate rather than aspirational: update it in the same change that touches `src/app/theme.ts` or introduces a new reusable UI pattern.

## Overview

PlanEat is a utilitarian household tool, not a marketing surface. The UI leans on Mantine's defaults rather than a custom brand system: the goal is a clean, offline-friendly, mobile-first app a household member can use one-handed while cooking or shopping, not a distinctive visual identity. Resist adding custom colors, fonts, or spacing scales unless a real usability problem — not aesthetic preference — requires it.

## Theme

The entire Mantine theme override is in `src/app/theme.ts`:

```ts
export const theme = createTheme({
  primaryColor: 'green',
  defaultRadius: 'md',
})
```

Everything else — typography scale, spacing, shadows, breakpoints, dark mode — is Mantine's stock default theme. There are no custom design tokens (no custom color palette, no custom font) to document beyond this. If that changes, add a **Colors**/**Typography** section here with the actual token values, not a placeholder.

The PWA manifest's `theme_color` (browser chrome / splash screen) is `#2f9e44` (`vite.config.ts`), matching Mantine's `green` primary swatch.

## Layout

- `src/ui/layouts/AppLayout.tsx` + `src/ui/components/BottomNav.tsx`: a fixed bottom navigation bar (Plan / Groceries / Recipes / Settings), `HashRouter`-based routing. This is a mobile-first layout — desktop is not a separate design target.
- `src/ui/components/ScreenHeader.tsx`: the shared per-screen title/back-navigation header, used instead of ad hoc `<Title>` + back-button markup per screen.
- Screens are `Stack`-based single-column layouts; there is no custom grid system.

## Components — conventions to follow, not just examples

- **Prefer existing Mantine components** (`@mantine/core`, `@mantine/form`, `@mantine/dates`, `@mantine/notifications`, `@mantine/modals`) over building a custom control. Only add a domain component (e.g. `MealCard`, `RecipePhotoThumb`) when it composes Mantine components for a specific app behavior — see `AGENTS.md`'s Conventions section.
- **Confirmation and disambiguation dialogs go through `@mantine/modals`**, never screen-local modal-open state:
  - `modals.openConfirmModal` for destructive/replace confirmations (see `SettingsScreen.tsx`'s restore-backup confirmation for the reference pattern).
  - `modals.open` with custom content for a richer flow, e.g. `src/ui/components/IngredientCandidateModal.tsx`'s ambiguous-ingredient candidate picker.
- **Tag/label entry uses Mantine `TagsInput`**, not a comma-separated free-text field — this replaced the last comma-split UI in the app (recipe tags in Sprint 8, ingredient aliases later). Reach for `TagsInput` for any new "list of short strings" input rather than reintroducing comma-splitting.
- **Ingredient identity entry uses a browsable combobox**, not a plain `TextInput` — see `src/ui/components/IngredientNameField.tsx`. It combines a Mantine `Combobox` (click/focus to browse the full ingredient list without typing) with `fuse.js` fuzzy filtering while typing. Fuzzy search is advisory only: selecting a suggestion or confirming typed text always resolves through `IngredientService`, never by trusting the fuzzy match directly (see `AGENTS.md`: `fuse.js` proposes candidates, it must never merge identity).
- **Offline-safe media**: `RecipePhotoThumb.tsx` renders a reliable placeholder when a remote `photoUrl` can't load — backups never include image bytes, only URLs, so this placeholder path is load-bearing, not cosmetic.
- **Filter UI**: `src/ui/catalog/FilterDrawer.tsx` is a Mantine `Drawer`-based staged-filter panel (draft state, explicit "Show N items" commit) — the reference pattern for any future multi-facet filter UI, instead of applying every toggle immediately.

## Do's and Don't's

- **Do** reach for a stock Mantine component first; only wrap it when there's a repeated, app-specific behavior to encapsulate.
- **Do** route every confirmation/disambiguation dialog through `@mantine/modals`.
- **Don't** introduce a second design-token source (a CSS variables file, a separate theme object, a competing color palette) — `src/app/theme.ts` is the only place theme tokens live.
- **Don't** reintroduce comma-separated text entry for a list of short strings — use `TagsInput`.
- **Don't** treat this document as permission to invent a bigger design system than the product currently has. Keep it in sync with what's actually in `src/app/theme.ts` and the components above, not with what a "typical" design doc contains.
