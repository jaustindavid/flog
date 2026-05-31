# Spend report — distance per window (on the Fuel row)

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

**Status**: brief — no separate pre-read (small, additive; the one
correctness subtlety — calendar-year bucketing — is already solved and
verified in `computeSpend`, and its year-boundary lesson is baked into
the ACs below). Dispatch directly.

---

## 1. Context

The Spend report (maintenance Phase 2) shows a 3×3 on the car-detail
screen: rows **Maintenance / Fuel / Total**, columns **This year /
Prior year / Lifetime**, of summed `cost`. This adds the **distance
driven per window beside the Fuel row** — e.g. `Fuel: $980 / 3.4k mi`
for each window — so fuel spend is contextualized by miles (and $/mi
falls out). Owner request 2026-05-31 (disambiguated: per-window, on the
Fuel row — NOT per-fill). Maintenance and Total rows are unchanged.

Pure additive compute + display. **No new fetch, no rules, no schema** —
`computeSpend` already receives the fuel entries (with `odometer` +
`loggedAt`); the distance is derivable from what's in hand.

---

## 2. Required reading

1. `src/maintenance/computeSpend.ts` + `computeSpend.test.ts` — the
   function you extend (or add a sibling to) and its test style. Note
   the **local-calendar-year bucketing** via `ts.toDate().getFullYear()`
   (never `toISOString`) — distance must bucket IDENTICALLY so cost and
   distance line up window-for-window.
2. `src/components/SpendReport.tsx` — where the Fuel cells render; add
   the `/ X mi` suffix here.
3. `src/entries/entries.ts` — the `Entry` type (`odometer`, `loggedAt`).
   Entries arrive **newest-first** (descending `loggedAt`).
4. `src/entries/computeMpg.ts` — how per-fill distance is already
   derived elsewhere (`odoDelta = current.odometer - prior.odometer`),
   for consistency of convention.
5. **BACKLOG** "Distance-per-window in the Spend report" item — the
   locked spec (esp. the gap-inclusion decision).
6. `AGENTS.md` — no `any`, pure fns unit-tested, no new deps.
   `package.json` `test` is pinned to `TZ=America/New_York` (load-
   bearing for the year-boundary test below).

---

## 3. Scope

### In scope

- **`computeSpend.ts`** — extend to ALSO return per-window fuel
  distance (miles). Either add a `fuelMiles: { thisYear, priorYear,
  lifetime }` field to `SpendReport`, or add a sibling `computeDistance`
  the screen calls alongside — implementer's choice; extending
  `SpendReport` is simplest (one call, one render). Update
  `computeSpend.test.ts` accordingly.
- **`SpendReport.tsx`** — render the per-window miles beside the Fuel
  cost on the **Fuel row only** (Maintenance + Total rows unchanged).
  Compact format, e.g. `$980 / 3.4k mi`.
- **`CarDetailScreen.tsx`** — only if the call site needs the new field
  threaded through (it already calls `computeSpend` + renders
  `SpendReport`); no logic change beyond passing the new data.

### Out of scope

- Per-fill distance / a distance column in the Fill-ups table (this is
  PER-WINDOW only).
- Distance on the Maintenance or Total rows, or cost-per-mile as its own
  number (the $/mi is left for the reader; not a computed cell).
- Any change to cost bucketing, the MPG pipeline, rules, schema, or
  fetching.

---

## 4. The math (locked)

Distance for a window = **sum of positive per-fill odometer deltas for
fuel entries whose `loggedAt` falls in that window's local calendar
year** — the SAME bucketing as the fuel cost, so the two align.

- Entries are newest-first. For each entry `i` with a chronological
  prior (`entries[i+1]`), `delta = entries[i].odometer −
  entries[i+1].odometer`. Count it only if `delta > 0`.
- Bucket each delta by **`entries[i].loggedAt`'s local year** (the same
  fill whose cost buckets there). `getFullYear()` (LOCAL), never
  `toISOString`.
- The chronologically-FIRST fill (the oldest, `entries[last]`) has no
  prior → contributes no delta.
- **INCLUDE gap deltas.** A missed/forgotten fill inflates one delta,
  but the odometer span is the truth — you really drove those miles.
  Do **NOT** apply the longest-tank 1.5×-median gap exclusion here (that
  exclusion is for "longest tank" only; for total distance it would
  *undercount*). This is the opposite of the gap-handling elsewhere —
  get it right.
- Windows: This year = `referenceYear`; Prior year = `referenceYear −
  1`; Lifetime = all positive deltas regardless of year. (Mirror the
  cost windows exactly; reuse the injected `referenceYear`.)
- Null/absent `loggedAt` (hand-edited bad doc): count the delta in
  Lifetime only (can't bucket without a year) — mirror how cost handles
  a null timestamp. Don't crash.

---

## 5. Acceptance criteria

- **C (compute)**: per-window fuel distance correct; buckets by the
  same local year as cost; first-entry (no prior) contributes 0;
  **gap deltas INCLUDED**; lifetime = sum of all positive deltas;
  null-`loggedAt` → lifetime only.
- **T (tests)**: extend `computeSpend.test.ts` (or a new
  `computeDistance.test.ts`) with: a cross-window case (deltas in
  this-year vs prior-year bucket correctly); a **gap case asserting the
  big delta is INCLUDED** (not excluded); a no-prior first-entry case;
  and a **year-boundary case that is MEANINGFUL, not vacuous** — build
  the boundary fixture from LOCAL components
  (`Timestamp.fromDate(new Date(2025, 11, 31, 23, 0))`, Dec 31 11pm
  local) so its local year (2025) diverges from its UTC year (2026); a
  `toISOString`/UTC bucketer would put the delta in the wrong year and
  fail. `npm test` runs under `TZ=America/New_York`, which exercises
  the divergence — do NOT build the fixture from a UTC instant.
- **U (UI)**: car-detail Spend report shows `cost / miles` on the Fuel
  row for each window; Maintenance + Total rows unchanged; a car with no
  fuel shows `$0 / 0 mi` (or just `$0`) — pick the cleaner empty render.
- **L (gates)**: `lint`, `lint:md`, `test`, `test:rules`, `build:dev`,
  `build:prod` all exit 0.
- **V2 (owner)**: spot-check a car's prior-year miles against the data;
  confirm a Dec-31 fill's distance lands in the right year; confirm a
  known data-gap car's miles look right (gap included).

---

## 6. Stop-and-ask

- If extending `SpendReport` vs adding `computeDistance` creates a
  cleaner seam either way, use your judgment — both are fine.
- If the year-boundary test can't be made to bite under the pinned TZ
  with a local-component fixture, STOP (that's the tax-correctness
  lynchpin, same as the cost side).

## 7. Model note

**Sonnet.** Pure additive compute mirroring the existing, already-
verified `computeSpend` bucketing + one presentational tweak. No
security/rules surface. The only subtlety (year-boundary + gap-
inclusion) is spelled out in §4/§5.
