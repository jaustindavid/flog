# Maintenance phase 2 — spend reporting — handoff

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

---

## Status

- ✅ **C (compute)** — `computeSpend` buckets fuel by `loggedAt` local
  year, maintenance by `date` local year; This/Prior/Lifetime sums
  correct; total = maintenance + fuel; null timestamp → lifetime only;
  empty → all zeros.
- ✅ **T (tests)** — 7 new test cases in `computeSpend.test.ts`. The
  year-boundary fixture is meaningful (see below). All 4 required
  scenarios covered: year boundary, null timestamp, cross-stream,
  empty.
- ✅ **U (UI)** — `SpendReport` component renders the 3×3 with
  prior-year visually emphasised (bold), real year labels derived from
  `referenceYear`, currency-formatted (`$n.toFixed(2)`). Wired into
  `CarDetailScreen` above the Maintenance section, gated on both
  streams ready.
- ✅ **L (gates)** — all six gates exit 0: `lint`, `lint:md`, `test`
  (145 tests, up from 138), `test:rules` (97 rules tests, unchanged),
  `build:dev`, `build:prod`.
- ⚠️ **V2 (owner)** — manual spot-check on dev (prior-year number vs.
  source data; Dec-31-dated entry landing in correct year) is deferred
  to the owner as documented.

---

## Versions chosen

No new dependencies added. All existing versions unchanged.

---

## Assumptions made

- `currentYear` is computed once per render in `CarDetailScreen` and
  passed to both `computeSpend` and `SpendReport` as `referenceYear`.
  This matches the brief's intent (pure fn never calls `new Date()`)
  and avoids calling `new Date().getFullYear()` twice inline in JSX.
- Section heading is "Spend" (short, consistent with "Maintenance" and
  "Fill-ups"). Owner may rename at V2.
- Prior-year emphasis is achieved via `font-semibold` and
  `text-gray-900` on the column header and all cells in that column.
  The other two data columns use `text-gray-700`. Total row gets a
  top border + `font-semibold` on all cells. Owner may retune at V2.
- Table does not show a special empty-state for an all-zero report —
  a brand-new car correctly shows `$0.00` across the board per the
  brief ("honest zeros").

---

## Deviations from dispatch

None — followed the dispatch as written.

---

## Files created

- `src/maintenance/computeSpend.ts` — pure aggregator; exported
  `SpendWindow`, `SpendReport` interfaces + `computeSpend` function.
- `src/maintenance/computeSpend.test.ts` — 7 unit tests.
- `src/components/SpendReport.tsx` — presentational 3×3 table.

## Files modified

- `src/screens/CarDetailScreen.tsx` — added `currentYear` constant,
  `computeSpend` + `SpendReport` imports, and a gated Spend
  `<section>` above the Maintenance section.

---

## Files NOT touched (confirmed)

- `src/entries/*` — not touched.
- `src/maintenance/maintenance.ts`, `useMaintenance.ts`,
  `dateField.ts` — imported read-only; not modified.
- `firestore.rules`, `tests/rules/*` — not touched.
- `PRD.md`, `AGENTS.md`, `BACKLOG.md`, `package.json` — not touched.
- Phase-1 modal/table (`MaintenanceModal`, `MaintenanceTable`) — not
  touched.

---

## Items deferred

### To the next dispatch

- Phase 3 (reminders / `resetsReminder` UI) — tracked in the brief.

### To BACKLOG

- Cross-car / all-cars aggregate spend view — already in BACKLOG as
  a separate item; no change.
- Placement tuning for the Spend section — owner retunes at V2;
  no BACKLOG entry needed.

---

## Expected cost impact

None. The Spend section reuses data already fetched by the existing
`useEntries` and `useMaintenance` hooks. No new Firestore reads or
queries are added.

---

## Manual steps for the human owner

1. Run `npm run dev` and open a car-detail screen.
2. Verify the Spend section appears above Maintenance with the 3×3
   table, year labels derived from the current year (e.g. "2025" /
   "2026" / "Lifetime"), and currency-formatted cells.
3. Spot-check the prior-year number against the source data in
   Firestore; confirm the maintenance/fuel split matches your records.
4. If you have a Dec-31-dated maintenance entry, confirm it lands in
   the correct (local) year column — not rolled into the next year.
5. Confirm a car with no entries yet shows `$0.00` across the board
   (no special empty state).

---

## Notes for the next dispatch brief

- The year-boundary test relies on `TZ=America/New_York` being pinned
  in `package.json` `test` script (already in place). If the TZ
  setting is ever changed, the boundary fixture (`new Date(2025, 11,
  31, 23, 0)`) must be revalidated — its divergence only holds for
  timezones at UTC−1 or more negative in winter.
- `computeSpend` has no opinion on ordering — it accepts entries in
  any order. This is intentional and consistent with the brief.
- The chunk-size warning in both build outputs (`> 500 kB`) is a
  pre-existing condition; this dispatch adds negligible bundle weight.
