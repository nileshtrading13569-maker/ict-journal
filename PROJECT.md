# Project: Journal Page Production Redesign & Neon Postgres Persistence

## Architecture
- **Application Framework**: TanStack Start / React 19 / Vite / Nitro SSR
- **State Management**: Zustand (`useDeskStore`) with debounced server synchronization (`syncDeskToServer()`)
- **Database & Persistence**: Neon Postgres (`@neondatabase/serverless` / `pg.Pool`) with PGLite fallback for local/CI tests
- **Storage Policy**: 100% Zero-Filesystem Storage (all data persists to `google_user_databases` and `user_desk_state` tables via JSONB)
- **UI Architecture**: Tailwind CSS, Radix UI primitives, Lucide icons, custom responsive cards and tables matching reference screenshots

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Neon SQL Migration | Migration `0005_journal_indexes.sql` for GIN indexing on `trade_history` and `desk_state` | M1 | explorer_survey_2 |
| 2 | Zero-FS Persistence Invariant | Strict persistence to Neon Postgres surviving reloads and restarts without filesystem writes | M1 | explorer_survey_2 |
| 3 | Prop Win Rate Formula | Win Rate calculated as W / (W + L), excluding BE from denominator ($7 / 11 = 63.6\%$) | M1 | explorer_survey_3 |
| 4 | Profit Factor Calculation | Gross Profit divided by Gross Loss ($3,285.00 / $1,124.97 = 3.42) | M1 | explorer_survey_3 |
| 5 | Expectancy Calculation | Net P&L divided by closed trades ($1,198.25 / 11 = +$108.93) | M1 | explorer_survey_3 |
| 6 | Avg Realized R & Cumulative R | Calculation of realized R (+1.48R), planned R (2.35R), and cumulative R (+9.58R) | M1 | explorer_survey_3 |
| 7 | Hold Duration Formatter | Formats trade entry to exit duration as `48m`, `1h 14m` | M1 | explorer_survey_1 |
| 8 | Rule Adherence Fraction | Formats compliance ratio as `9/10`, `8/8`, `6/10` | M1 | explorer_survey_1 |
| 9 | Journal Header & Subtitle | Serif `Journal` title with `PROP DESK · OCT 2026` subtitle | M2 | explorer_survey_1 |
| 10 | Auto-sync Status Indicator | Green dot `● Auto-sync enabled · MT5 Raw Spread` linked to sync state | M2 | explorer_survey_1 |
| 11 | Header Action Buttons | `Import CSV` pill button and `+ Log trade` red CTA button | M2 | explorer_survey_1 |
| 12 | Uppercase Navigation Tabs | `ALL [count]`, `DAY`, `CALENDAR`, `QUARTER`, `MISSED [count]` with red underline | M2 | explorer_survey_1 |
| 13 | 5 KPI Summary Metric Cards | Net P&L, Win Rate, Profit Factor, Avg Realized R, Expectancy with colored progress bars | M2 | explorer_survey_1 |
| 14 | Toolbar Search Input | Live filtering by symbol, playbook, tag, and notes | M2 | explorer_survey_1 |
| 15 | Date Range Filter Dropdown | Dropdown date selector matching `Oct 1 – Oct 29, 2026` | M2 | explorer_survey_1 |
| 16 | 15-Column Trades Table | Custom table columns matching screenshot 2 | M2 | explorer_survey_1 |
| 17 | Duration Subtitle in Open ET | Open time cell displays date/time on line 1 and duration on line 2 | M2 | explorer_survey_1 |
| 18 | Status & Side Pill Badges | Styled pills for SHORT/LONG, WIN/LOSS/BE | M2 | explorer_survey_1 |
| 19 | Playbook Tier Badges | Letter square badges `[A]`, `[B]`, `[C]` with setup name | M2 | explorer_survey_1 |
| 20 | Mistake Warning Tag Badges | Setup tags with amber warning styling for mistake tags | M2 | explorer_survey_1 |
| 21 | Rules Ratio & Grade Badges | Compliance fraction (`9/10`) and Grade pills (`A`, `A+`, etc.) | M2 | explorer_survey_1 |
| 22 | Reviewed Checkmark Icon | Green checkmark circle for reviewed trades | M2 | explorer_survey_1 |
| 23 | Selected Row Left Red Accent | Solid 4px red accent border and checked red checkbox for active trade | M2 | explorer_survey_1 |
| 24 | Pagination Controls & Footer | `Showing 1–6 of 12 logged trades` and Prev/1/2/Next controls | M2 | explorer_survey_1 |
| 25 | In-Memory CSV Import/Export | Browser-native CSV import and export without filesystem storage | M2 | explorer_survey_2 |
| 26 | E2E Test Suite (Tiers 1-4) | Opaque-box test suite across Tiers 1-4 published in TEST_READY.md | M3 | orchestrator |
| 27 | 100% E2E Test Pass | Implementation passes 100% of Tiers 1-4 tests | M3 | orchestrator |
| 28 | Adversarial Hardening (Tier 5) | White-box adversarial testing and gap elimination | M3 | orchestrator |
| 29 | Build & Typecheck Invariants | `npm run build` and `npm run typecheck` pass with exit code 0 | M3 | explorer_survey_3 |
| 30 | Forensic Integrity Audit | Mandatory independent audit proving authentic, uncheated implementation | M3 | orchestrator |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Persistence & Business Logic Engine | Migration `0005_journal_indexes.sql`, zero-FS validation, KPI stats formulas in `ict-stats.ts`, duration/rule adherence helpers | none | DONE |
| M2 | Journal Page UI Redesign | Redesign `journal.tsx` (header, subtitle, auto-sync, tabs, 5 KPI cards) and `all-view.tsx` (15-column table, toolbar, badges, selection, pagination) | M1 | DONE |
| M3 | E2E Testing, Adversarial Hardening & Final Audit | Tiers 1-4 E2E test suite in `tests/e2e/`, 100% pass, Tier 5 adversarial hardening, and final forensic audit | M1, M2 | DONE |

## Interface Contracts
### `src/lib/ict-stats.ts` ↔ `src/components/journal/journal-kpi-cards.tsx`
```ts
export interface JournalKPIs {
  netPnL: number;
  netPnLFormatted: string;
  cumulativeR: number;
  cumulativeRFormatted: string;
  winRatePct: number;
  winCount: number;
  lossCount: number;
  beCount: number;
  profitFactor: number;
  grossProfit: number;
  grossLoss: number;
  avgRealizedR: number;
  plannedR: number;
  expectancy: number;
}
export function calculateJournalKPIs(trades: Trade[]): JournalKPIs;
```

## Code Layout
- `FUll ICT Concept -grok-workspace/migrations/`: Database SQL migration files (`0001_auth.sql` ... `0005_journal_indexes.sql`)
- `FUll ICT Concept -grok-workspace/src/lib/ict-stats.ts`: Trade statistics and KPI calculation functions
- `FUll ICT Concept -grok-workspace/src/lib/tradezella-helpers.ts`: Trade rule adherence, durations, and formatting helpers
- `FUll ICT Concept -grok-workspace/src/lib/journal-csv.ts`: In-memory CSV parsing and generation
- `FUll ICT Concept -grok-workspace/src/routes/journal.tsx`: Main journal page route, header, auto-sync indicator, tabs, KPI cards container
- `FUll ICT Concept -grok-workspace/src/components/journal/journal-kpi-cards.tsx`: 5 KPI metric cards with progress bars
- `FUll ICT Concept -grok-workspace/src/components/journal/all-view.tsx`: 15-column table, search & date range toolbar, badges, selection, pagination
- `FUll ICT Concept -grok-workspace/src/components/journal/trade-form-modal.tsx`: Trade creation and editing modal
- `FUll ICT Concept -grok-workspace/tests/e2e/`: Opaque-box E2E test suite
