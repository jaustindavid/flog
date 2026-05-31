# Spend-distance dispatch handoff

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

## Status

- ✅ **C (compute)**: `computeSpend` returns `fuelMiles: { thisYear,
  priorYear, lifetime }`. Buckets by `entries[i].loggedAt`'s LOCAL year
  (`getFullYear()`) — identical to cost bucketing. Gap deltas included
  (no gap exclusion). First/oldest entry contributes 0. Null `loggedAt`
  → lifetime only, no crash.
- ✅ **T (tests)**: 6 new test cases in `computeSpend.test.ts`:
  empty-array, single-entry (no prior → zero), cross-window bucketing,
  gap-included assertion, null-loggedAt → lifetime only, and the
  meaningful year-boundary fixture (Dec-31 23:00 LOCAL; see §4 below).
- ✅ **U (UI)**: Fuel row shows `"$X.XX / Y mi"` per window (compact
  format). When miles is 0 (car with no fuel), renders `"$0.00"` only —
  the cleaner empty state. Maintenance + Total rows unchanged.
  `CarDetailScreen.tsx` needed no change (existing `computeSpend` call
  pass-through).
- ✅ **L (gates)**: `lint`, `lint:md`, `test` (TZ=America/New_York),
  `test:rules`, `build:dev`, `build:prod` all exit 0.
- ⚠️ **V2 (owner)**: Spot-check a car's prior-year miles against the
  data; confirm a Dec-31 fill's distance lands in the right year; confirm
  a known data-gap car's miles look right (gap included, not excluded).
  Owner-only step — flagged, not done.

## Versions chosen

No new dependencies introduced.

## Assumptions made

- **`fuelMiles` added to `SpendReport` interface** (not a sibling
  `computeDistance`). One call, one data shape — simpler call site.
  Dispatch brief called this "the simpler" choice.
- **Empty-miles render**: when miles is 0 for a window, the Fuel cell
  shows just the cost (`"$0.00"`) rather than `"$0.00 / 0 mi"`. Avoids
  noise for new cars or windows with no fills. Brief said "pick the
  cleaner empty render" — I judged cost-only cleaner.
- **Miles format**: sub-1k → `Math.round(n) + " mi"`; 1k+ →
  `(n/1000).toFixed(1) + "k mi"`. Brief said compact, owner tunes at
  V2.

## Deviations from dispatch

None — followed the dispatch as written.

## Files created

None.

## Files modified

- `src/maintenance/computeSpend.ts` — added `FuelMilesWindow` interface,
  `fuelMiles` field on `SpendReport`, and the distance-bucketing loop.
- `src/maintenance/computeSpend.test.ts` — extended `fuel()` helper with
  optional `odometer` param; added 6 new fuelMiles describe blocks.
- `src/components/SpendReport.tsx` — added `fmtMiles` + `fmtFuelCell`
  helpers; rewrote table rows to inline the three-row structure (removes
  the generic `rows` array which couldn't cleanly accommodate per-row
  divergence); Fuel row uses `fmtFuelCell`.
- `BACKLOG.md` — marked item `[x]` in Next section; moved to Done with
  summary note.

## Files NOT touched (confirmed)

- `src/entries/entries.ts` (no schema change)
- `src/entries/computeMpg.ts` (no MPG pipeline change)
- `src/screens/CarDetailScreen.tsx` (call site unchanged)
- `firestore.rules` (no rules change)
- `PRD.md`, `ARCHITECTURE.md`, `AGENTS.md`, `LICENSE`
- `.markdownlint.jsonc`, `vite.config.ts`, `tsconfig*.json`
- All dispatch briefs and handoffs (except this new file)

## Items deferred

**To the next dispatch:** none from this scope.

**To BACKLOG:** none — V2 owner spot-check is already captured in the
Status section above.

## Expected cost impact

None. Pure client-side computation over already-fetched entries. No new
Firestore reads.

## Manual steps for the human owner

1. Run `TZ=America/New_York npm test` to confirm the 185 tests pass.
2. `npm run build:prod` to confirm the bundle is clean.
3. V2 spot-checks: load a car with multi-year data; verify the Fuel row
   shows cost + miles per column; confirm a gap-car's lifetime miles
   look right (gap NOT excluded).

## Notes for the next dispatch brief

- The `SpendReport.tsx` rows are now inlined (not from a generic `rows`
  array). That's the right seam now that rows have different cell logic.
  Future row additions should follow the same inline pattern.
- The bundle chunk-size warning (~820 KB) is pre-existing (Firebase +
  router). The BACKLOG code-split item covers it; don't fix here.
- The `fuel()` test helper in `computeSpend.test.ts` now has an optional
  `odometer = 0` fourth argument. Existing tests are unaffected (they
  don't pass odometers, so all get 0 — correct for cost-only tests).
