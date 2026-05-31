# Maintenance phase 2 — spend reporting (the 3×3)

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

**Status**: draft — pending pre-read (math focus) before implementer
dispatch.

Authoritative design: **PRD §14.4**. This implements **Phase 2 only**
(spend reporting). Phase 1 (logging) shipped 2026-05-31; Phase 3
(reminders) is a separate dispatch.

---

## 1. Context

Phase 1 gave each car a `maintenance` subcollection alongside the fuel
`entries`. Both carry a `cost`. Phase 2 answers **"what has this car
cost me?"** with a small per-car spend report on the car-detail screen:
a **3×3** — rows **Maintenance / Fuel / Total**, columns **This year /
Prior year / Lifetime** — of summed cost. **Prior year is the headline**
(it's the tax-filing number; the owner's stated motivation).

Pure additive read + display: **no new collection, no rules change, no
new fetch.** Car-detail already loads both streams (`useEntries` +
`useMaintenance`); Phase 2 just aggregates what's already in hand.

The one place to get right: **calendar-year bucketing must be
timezone-correct.** A fuel fill logged Dec 31 23:00 local must count in
that local year, not roll into the next via UTC — same class of bug the
Phase-1 `dateField` bridge exists to prevent.

---

## 2. Required reading

1. **PRD §14.4** (reporting) + §14.6/§14.7 (what's out of scope).
2. `src/entries/computeStats.ts` + `computeStats.test.ts` — the
   pure-function-with-unit-tests template (style, hand-computed
   fixtures, injected inputs). `computeSpend` mirrors this shape.
3. `src/maintenance/maintenance.ts` — the `Maintenance` type (`cost`,
   `date: Timestamp`).
4. `src/entries/entries.ts` — the `Entry` type (`cost`,
   `loggedAt: Timestamp`).
5. `src/maintenance/dateField.ts` — the LOCAL-component convention
   (`getFullYear` etc., never `toISOString`). Year-bucketing MUST use
   the same local-getter approach.
6. `src/components/EntriesTable.tsx` — how `cost` is formatted for
   display (mirror it for the report's currency cells).
7. `src/screens/CarDetailScreen.tsx` — where the report mounts, and how
   it already has `entriesState` (fuel) + the Phase-1 maintenance state
   in scope.
8. `AGENTS.md` — no `any`, pure fns unit-tested, no new deps. Note: the
   pure `computeSpend` must NOT call `new Date()`/`Date.now()` itself —
   the reference year is injected (testability).

---

## 3. Scope

### In scope

- **`src/maintenance/computeSpend.ts`** (new) + **`.test.ts`** — a pure
  aggregator (see §5). Takes fuel entries, maintenance entries, and an
  injected **reference calendar year**; returns the 3×3 as a typed
  object.
- **`src/components/SpendReport.tsx`** (new) — renders the 3×3 table
  (rows Maintenance/Fuel/Total; columns This year/Prior year/Lifetime),
  currency-formatted, with Prior-year visually the headline.
- **`src/screens/CarDetailScreen.tsx`** (modified) — a new **Spend**
  `<section>` (recommended placement: above the Maintenance section, as
  a per-car cost summary — owner may retune placement at V2). Computes
  the report from the already-loaded fuel + maintenance arrays + the
  current local year (`new Date().getFullYear()`, computed in the
  component and passed into the pure fn).

### Out of scope

- Reminders / banner / reset-checkbox / reminder config (Phase 3).
- Cross-car / all-cars aggregate spend (separate BACKLOG item).
- Cost-per-mile, charts, trends (not requested).
- Any change to `entries`, `maintenance`, rules, or fetching.
- Editing how cost is stored or formatted at the source.

---

## 4. Decisions locked

1. **Pure `computeSpend(fuel, maintenance, referenceYear)`** — the
   current year is INJECTED, never read inside the pure fn (so tests
   are deterministic; mirrors how the percentile work avoided
   `Date.now()`).
2. **Local-year bucketing.** Each entry's calendar year =
   `ts.toDate().getFullYear()` (LOCAL), consistent with `dateField`.
   Fuel buckets by **`loggedAt`**; maintenance by **`date`** (the
   service date). NEVER bucket via `toISOString()` / UTC.
3. **Windows**: This year = `referenceYear`; Prior year =
   `referenceYear - 1`; Lifetime = all entries regardless of date.
4. **Total = Maintenance + Fuel** per window.
5. **Null/absent timestamp** (only from a hand-edited bad doc): include
   the cost in **Lifetime** but skip it for This/Prior year (can't
   bucket without a date). Don't crash.
6. **No new deps**; pure client-side; no rules/fetch changes.
7. `resetsReminder` and the reminder machinery stay untouched (Phase 3).

---

## 5. Architecture sketch

### 5.1 `computeSpend.ts`

```ts
export interface SpendWindow {
  maintenance: number;
  fuel: number;
  total: number;
}
export interface SpendReport {
  thisYear: SpendWindow;
  priorYear: SpendWindow;
  lifetime: SpendWindow;
}

export function computeSpend(
  fuel: Entry[],
  maintenance: Maintenance[],
  referenceYear: number
): SpendReport;
```

- Sum `cost` per stream per window.
- A row's `total` = maintenance + fuel for that window.
- Year of a fuel entry = local `getFullYear()` of `loggedAt`; of a
  maintenance entry = local `getFullYear()` of `date`. A null timestamp
  → counted only in `lifetime`.
- `lifetime.fuel` = sum of ALL fuel costs; `lifetime.maintenance` = sum
  of ALL maintenance costs; regardless of year.
- Costs are numbers already validated finite ≥ 0 by the rules and read
  straight through `toEntry`/`toMaintenance` with no coercion — so
  null-timestamp handling is the ONLY defensive case; skip any
  non-finite-cost guard (pre-read N3 — it's dead weight and clutters the
  fixtures).

### 5.2 `SpendReport.tsx`

- A compact table/grid: header row (blank / This year / Prior year /
  Lifetime), then Maintenance, Fuel, Total rows. Currency-format each
  cell (mirror `EntriesTable`'s cost formatting). **Prior year** column
  gets the visual emphasis (it's the headline). Keep it mobile-first
  and quiet, consistent with `MpgTile` / `StatRow` aesthetics.
- Pure presentational: takes a `SpendReport` (+ maybe the year labels)
  and renders. No data fetching.

### 5.3 Car-detail integration

- Compute `const year = new Date().getFullYear()` in the component;
  pass `computeSpend(fuelEntries, maintenanceEntries, year)` into
  `SpendReport`. Both arrays are already loaded (reuse the existing
  `useEntries` + Phase-1 `useMaintenance` state — do NOT add a fetch).
- Render inside a gated section (only when both streams have loaded).
  Note (pre-read N1): car-detail gates the two sections SEPARATELY —
  there's no combined "both ready" gate to copy; write
  `entriesState.status === 'ready' && maintState.status === 'ready'`
  yourself. Empty data → the report
  shows zeros (a brand-new car reads `$0` across the board — that's
  fine and honest; no special empty-state needed).
- Column labels should show the actual years (e.g. "2025" for prior,
  "2026" for this year) — derive from `referenceYear` so they're not
  hard-coded.

---

## 6. Files NOT to touch

- `src/entries/*`, `src/maintenance/maintenance.ts` /
  `useMaintenance.ts` / `dateField.ts` (import types/helpers only).
- `firestore.rules`, `tests/rules/*` (no rules change).
- The fuel log form, MPG pipeline, the Phase-1 maintenance modal/table.
- `PRD.md`, `AGENTS.md`, `BACKLOG.md`, config, `package.json`.

---

## 7. Acceptance criteria

- **C (compute)**: `computeSpend` buckets fuel by `loggedAt` local
  year, maintenance by `date` local year; This/Prior/Lifetime correct;
  total = maintenance + fuel; null-timestamp → lifetime only; empty →
  all zeros.
- **T (tests)**: `computeSpend.test.ts` with hand-computed fixtures.
  The **year-boundary case must be MEANINGFUL, not vacuous** (pre-read
  S1): build the boundary timestamp from LOCAL components —
  `Timestamp.fromDate(new Date(2025, 11, 31, 23, 0))` (Dec 31 11pm
  local) — so its local year (2025) DIVERGES from its UTC year (2026).
  A correct `getFullYear()` bucketer puts it in 2025; a buggy
  `toISOString`/UTC one puts it in 2026 — the test distinguishes them.
  **`npm test` is pinned to `TZ=America/New_York`** (negative offset) so
  this divergence is actually exercised. Do NOT build the fixture from a
  UTC instant — it can't tell right from wrong under any runner. Also
  cover: a cross-stream case (fuel + maintenance same year), a
  null-timestamp case (→ lifetime only), an empty case (all zeros).
- **U (UI)**: car-detail shows the Spend section with the 3×3,
  currency-formatted, Prior-year emphasized, real year labels; updates
  when maintenance/fuel change (reuses the loaded state).
- **L (gates)**: `lint`, `lint:md`, `test`, `test:rules`, `build:dev`,
  `build:prod` all exit 0. (`test:rules` unaffected; run to confirm.)
- **V2 (owner)**: on dev, a car shows correct lifetime + prior-year +
  this-year spend split across maintenance/fuel/total; spot-check the
  prior-year number against the data; confirm a Dec-31-dated entry
  lands in the right year.

---

## 8. Stop-and-ask

- If the year-boundary test can't be made to pass under a non-UTC `TZ`
  with local getters, STOP — that's the tax-correctness lynchpin.
- If car-detail does NOT already have the maintenance array in scope
  from Phase 1 (verify), surface it — the brief assumes it does (the
  Phase-1 Maintenance section wired `useMaintenance`).
- Placement uncertainty is fine to ship a reasonable default (above
  Maintenance); the owner retunes at V2.

---

## 9. Model note

**Sonnet-implementer candidate** once the pre-read clears the bucketing
math: it's a pure aggregator + one presentational component + an
additive car-detail section, reusing established patterns. The only
real risk is the local-year bucketing (pre-read focus); no security/
rules surface. (Mirrors the log-screen-stats flow: Opus pre-read of the
math → Sonnet implement.)
