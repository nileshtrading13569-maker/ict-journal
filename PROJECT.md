# Project: Curated Font Pairings & Settings Persistence

## Architecture
- **Application Framework**: TanStack Start / React 19 / Vite 8 / Tailwind CSS v4 / Nitro SSR
- **Application Root**: `FUll ICT Concept -grok-workspace/`
- **Global Typography System**: `src/styles.css` defines base `--font-sans` (`IBM Plex Sans`) and `--font-display` (`Plus Jakarta Sans`)
- **Dynamic Typography Engine**: `src/lib/font-themes.ts` manages font theme definitions, Google Fonts dynamic stylesheet link injection, CSS variable overrides (`--font-display` and `--font-sans` on `document.documentElement`), and font preview preloading
- **UI Settings Sheet**: `src/components/desk/settings-sheet.tsx` renders settings drawer with typography selection
- **Hydration & Persistence**: Client `localStorage` via key `first-payout-font-theme-v1` (`FONT_STORAGE_KEY`) rehydrated on mount by `src/components/desk/desk-provider.tsx`

## Feature Inventory
Every feature from the Survey phase appears here with its assigned milestone:
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | 8 Curated Font Pairings Catalog | Full declaration of 01 Gibson/GOTHAM through 08 Quicksand/CRIMSON with display & body font stacks and Google Fonts URLs | M1 | ORIGINAL_REQUEST R1 |
| 2 | Settings Sheet Typography UI | Interactive selection cards in settings sheet with pairing numbers (01-08), dual previews (heading + body), and visual tags | M1 | ORIGINAL_REQUEST R1 |
| 3 | Default Font Preservation | Preserves default IBM Plex Sans body & Plus Jakarta Sans headings when no font is selected | M1 | ORIGINAL_REQUEST R2 |
| 4 | User Preference Application | Dynamically applies selected header and body fonts across all application elements | M1 | ORIGINAL_REQUEST R2 |
| 5 | Reload & Storage Persistence | Saves font selection in localStorage and rehydrates on app load / refresh | M1 | ORIGINAL_REQUEST R2 |
| 6 | Font Preview Preloading | Loads curated font preview stylesheet when settings sheet opens so previews render in accurate typefaces | M1 | Survey |
| 7 | Settings Reset Integration | Clears font preference and reverts to default typography on desk reset | M1 | Survey |
| 8 | Test Suite & Build Verification | Unit tests for font themes, E2E verification of settings behavior, and clean typecheck & build | M1 | Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Curated Font Pairings & Persistence | font-themes.ts, settings-sheet.tsx, desk-provider.tsx, unit & E2E tests | none | DONE |

## Interface Contracts
### `src/lib/font-themes.ts`
```ts
export const FONT_STORAGE_KEY = "first-payout-font-theme-v1";
export interface FontThemeOption {
  id: FontTheme;
  name: string;
  number?: string;
  display: string;
  sans: string;
  googleFontsUrl?: string;
  badge: string;
  description: string;
  isCurated?: boolean;
}
export const CURATED_FONT_PAIRINGS: FontThemeOption[];
export const FONT_THEMES: FontThemeOption[];
export function applyFontTheme(themeId: FontTheme | "default" | null): void;
export function resetFontTheme(): void;
export function loadFontPreviewStylesheet(): void;
```

## Code Layout
- `FUll ICT Concept -grok-workspace/src/lib/font-themes.ts`: Curated font pairings catalog, font application, preview loader, and reset logic.
- `FUll ICT Concept -grok-workspace/src/components/desk/settings-sheet.tsx`: Settings sheet UI with 8 curated font pairing cards, default option card, preview preloader, and safe mount/reset logic.
- `FUll ICT Concept -grok-workspace/src/components/desk/desk-provider.tsx`: App-level rehydration of stored font theme on initial load.
- `FUll ICT Concept -grok-workspace/src/lib/font-themes.test.ts`: Unit test suite testing all 8 font pairings, storage keys, SSR safety, and default preservation.
- `FUll ICT Concept -grok-workspace/tests/e2e/font-pairings-e2e.test.ts`: Verification test verifying settings behavior, typography application, reload persistence, and default preservation.
