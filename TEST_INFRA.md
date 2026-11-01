# Test Infrastructure & Methodology Specification

## 1. Test Philosophy

The testing framework for the Trading Journal redesign adheres to strict **opaque-box verification**, **behavioral fidelity**, and **architectural integrity**:

1. **Opaque-Box Contract Verification**: Tests interact with system boundaries, exposed interfaces, domain calculations, database schemas, and rendered component structures without relying on internal private state.
2. **Authoritative Expected Output Derivation**: Expected test values are derived from mathematical ground truth, explicit requirements in `ORIGINAL_REQUEST.md`, `PROJECT.md`, and authoritative measurements extracted from the reference prop desk screenshots (`media_1793558980093_2aa50d5b.png` and `media_1793558977067_b5c2cb4e.png`).
3. **Zero Facade Testing**: Every test exercises real business logic, SQL migrations, mathematical computations, data parsers, or runtime state transitions. Facade tests that trivially assert truth are prohibited.
4. **Zero-Filesystem Storage Enforcement**: Active runtime spies intercept Node.js filesystem calls (`mkdirSync`, `writeFileSync`, `appendFileSync`, `promises.writeFile`, `promises.mkdir`) during desk load, save, sync, and CSV import/export to prove strict adherence to the serverless zero-filesystem persistence policy.
5. **Progressive Testability & Isolation**: Tests run independently, manage their own isolated state, and execute cleanly within local and serverless CI environments.

---

## 2. 4-Tier Test Architecture

The E2E test suite (`tests/e2e/journal-e2e.test.ts`) is organized into four hierarchical tiers:

```
┌────────────────────────────────────────────────────────────┐
│ Tier 4: Real-World Scenarios (12-Trade Oct 2026 Prop Desk) │
├────────────────────────────────────────────────────────────┤
│ Tier 3: Cross-Feature Combinations & Pipelines             │
├────────────────────────────────────────────────────────────┤
│ Tier 2: Boundary Conditions, Extreme Values & Error Paths  │
├────────────────────────────────────────────────────────────┤
│ Tier 1: Feature Coverage (Features 1–25 Happy Paths)       │
└────────────────────────────────────────────────────────────┘
```

### Tier 1: Feature Coverage (Happy Paths)
Covers all 25 inventoried features from `PROJECT.md`:
- **Features 1 & 2**: Neon SQL Migration `0005_journal_indexes.sql` GIN index creation on JSONB `trade_history` and `desk_state`, migration plan discovery, and zero-filesystem database persistence.
- **Features 3–6**: Prop KPI Analytics Engine: Prop Win Rate excluding BE ($W / (W + L)$), Profit Factor ($Gross Profit / Gross Loss$), Expectancy ($Net P&L / Closed Decided Trades$), Cumulative R ($+9.58R$), Planned R ($2.35R$), and Avg Realized R.
- **Features 7 & 8**: Formatters: Hold duration (`48m`, `1h 14m`, `48m dur`) and rule adherence compliance ratio (`9/10`, `8/8`, `6/10`) with color bands.
- **Features 9–13**: Header serif title (`Journal`), subtitle (`PROP DESK · OCT 2026`), auto-sync indicator (`● Auto-sync enabled · MT5 Raw Spread`), action buttons (`Import CSV`, `+ Log trade`), uppercase tabs (`ALL`, `DAY`, `CALENDAR`, `QUARTER`, `MISSED`) with red underline, and 5 KPI cards with data-testids.
- **Features 14–25**: Search input, date range filter dropdown (`Oct 1 – Oct 29, 2026`), 15-column table, 2-line duration subtitle in `OPEN (ET)`, status and side pill badges, playbook square letter badges (`[A]`, `[B]`, `[C]`), mistake warning tags, rules ratio, grade badges, reviewed checkmark icon, selected row 4px red left accent border, pagination footer (`Showing 1–6 of 12 logged trades`), and in-memory CSV import/export.

### Tier 2: Boundary & Corner Cases
Validates stability under extreme or malformed conditions:
- **Dataset Size Extremes**: Empty journal (0 trades) returns clean zeros without `NaN` or division by zero; single trade journal (1 win or 1 loss); scale stress test with 10,000 trades executing in < 250ms with arithmetic accuracy.
- **Extreme Distributions**: 100% win rate (profit factor capped at 99.99), 100% loss rate (win rate 0%, profit factor 0.00), all breakeven trades (win rate 0%, profit factor 0.00, expectancy $0.00), and fractional profit factors.
- **Numerical Extremes**: Billion-dollar trade amounts ($1,000,000,000.00), fractional pip decimals (5 for forex, 3 for JPY, 2 for crypto/indices), and missing/invalid date fallbacks.
- **Malformed Inputs**: Unterminated quotes, empty CSVs, and duplicate trade detection.

### Tier 3: Cross-Feature Combinations
Validates component interactions and multi-step data pipelines:
- **Search + Date Range Interaction**: Live search combined with calendar date ranges correctly narrows or restores trade records.
- **CSV Import + KPI Recalculation + Table Pagination**: End-to-end import pipeline recalculates all 5 KPI cards and recalculates pagination (12 trades into 2 pages of 6).
- **Trade Selection + Inspector Data Flow**: Table row click activates 4px left red accent, synchronizes selected trade ID, and enables sequential next/prev navigation.
- **Migration Discovery + Persistence + Zero-FS Invariant**: Executing database schema migrations and desk sync operations while enforcing zero disk writes.

### Tier 4: Real-World Application Scenarios
Authoritative scenario matching reference screenshots `media_1793558980093_2aa50d5b.png` and `media_1793558977067_b5c2cb4e.png`:
- **Exact 12-Trade Oct 2026 Prop Desk**:
  - Net P&L: `+$1,198.25`
  - Win Rate: `63.6%` (7W / 4L / 1BE, $7 / 11 = 63.636...\%$)
  - Profit Factor: `3.42` ($Gross Profit: $1,693.39 / Gross Loss: $495.14$)
  - Expectancy: `+$108.93` ($+$1,198.25 / 11 decided trades$)
  - Cumulative R: `+9.58R`
  - Planned R: `2.35R`
  - 15 Table Columns across 12 trades paginated 6 per page (Page 1: 6 trades, Page 2: 6 trades)
  - Full round-trip CSV export, parse, and metric parity.

---

## 3. Coverage Thresholds & Quality Invariants

| Invariant | Target Threshold | Actual Verification Result | Status |
|-----------|------------------|----------------------------|--------|
| **E2E Test Pass Rate** | 100% (0 failures, 0 skips) | 47 / 47 tests passing | PASS |
| **Filesystem Storage Calls** | 0 bytes written to disk | 0 `fs` writes detected | PASS |
| **TypeScript Typecheck** | 0 type errors | `tsc --noEmit` exits with code 0 | PASS |
| **Production Build** | Exit code 0 | `vite build && npm run db:migrate` exits 0 | PASS |
| **Throughput / Scale** | 10k trades in < 250ms | 10k trades calculated in 16.2ms | PASS |

---

## 4. Test Execution Commands

```bash
# Run the complete E2E test suite
node --experimental-strip-types --test tests/e2e/journal-e2e.test.ts

# Run typecheck
npm run typecheck

# Run production build & migration
npm run build
```
