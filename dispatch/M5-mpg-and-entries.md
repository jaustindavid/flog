# M5 — Per-car detail + MPG

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

**Status**: draft — pending pre-read by reviewer cuttlefish (per
WORKING-MODEL §3) before implementer dispatch.

---

## 1. Context

M5 is v0's fifth (and final pre-cutover) milestone (PRD §10).
Builds atop M4's Entries module + log form. **This milestone fills
the data flog has been collecting since M4 with actual user value:
seeing your fuel history and per-car MPG numbers.**

What M4 shipped (recap from `dispatch/M4-entries-handoff.md`):

- Log fill-up form at `/`; entries module
  (`src/entries/entries.ts` with `createEntry`, `getLatestEntry`,
  `listEntriesForCar(carId, limit=50)` as a stub for M5,
  `deleteEntriesForCar`); odometer-monotonicity flag-but-accept;
  MRU via localStorage; cascade delete (rule + code).
- Routing: `/` = log form, `/cars` = list, `/cars/:carId` =
  detail. Header with NavLink-based nav.
- `<CarDetailScreen />` Fill-ups placeholder removed during V6
  fix-forward — the empty `<section>` slot is M5's insertion
  point.

M5's job:

- Add **three MPG tiles** + **entries table** to
  `<CarDetailScreen />`, occupying the section M4 deleted.
- Add **`useEntries(carId)` hook** mirroring the M3/M4 epoch
  race-guard pattern.
- Add **pure MPG computation helpers** (per-fill, lifetime,
  avg-last-N) — unit-tested per AGENTS gate.
- **Drop the latest-50 cap** on `listEntriesForCar`; fetch all
  entries per car. Amend PRD §8 accordingly. The aggregate-doc
  BACKLOG → Later item is the next defense line when scale
  forces it.

M5 deliberately does NOT:

- Ship per-fill insight tiles beyond MPG (max-ever-fuel, best/
  worst, etc.) — BACKLOG → Later (Reports & insights section).
- Ship charts / trends-over-time — BACKLOG → Later.
- Ship the "logged by Sarah" attribution per row — BACKLOG →
  Later (requires a nickname infrastructure decision; new entry
  added this dispatch).

**Prod deploy is NOT in scope for M5.** Per owner 2026-05-28
(M4 closure): "we're not yet ready to ship." Prod cutover
re-anchored to M5 close (or later — owner's call when the
per-car detail surface earns family attention).

---

## 2. Required reading

In order:

1. [`../PRD.md`](../PRD.md) — §1.1 (goals; MPG insight is one
   of the goals), §3 (MPG definition — load-bearing for the
   formula), §5.3 (Entry shape), §6.3 (entry rules — unchanged
   in M5), §7 Flow F (per-car detail flow — load-bearing for
   the UI), §8 (cost spec — being amended), §10 (M5 row), §11.2
   (open questions).
2. [`../AGENTS.md`](../AGENTS.md) — all of it. Especially the
   testing expectations: "MPG computation: `(odo_now - odo_prev)
   / gallons_now`, handling the 'no prior entry' case" is
   explicitly called out as a required unit-test.
3. [`../WORKING-MODEL.md`](../WORKING-MODEL.md) — §3 (pre-read),
   §5 (operational conventions), §6 (antipatterns).
4. [`../HANDOFF-TEMPLATE.md`](../HANDOFF-TEMPLATE.md).
5. [`M4-entries-handoff.md`](M4-entries-handoff.md) — current
   code state. Especially:
   - "Post-ship findings" (the Fill-ups placeholder removal —
     M5's insertion point is the freshly-empty section).
   - "Items deferred → To the next dispatch (M5)" — the M4
     author's notes for you (`useEntries` hook, listEntriesForCar
     consumption, MPG computation tests).
6. [`M4-entries.md`](M4-entries.md) §13 (forward feedback) for
   M4 rakes M5 inherits — especially the placeholder-copy lesson
   (don't render placeholders for milestone-gap regions; this
   matters because M5's "empty entries" state IS a legit
   empty-state, not a placeholder), the `NumericField`
   `type="text"+inputmode` precedent (no numeric inputs in M5
   but worth knowing), and the react-hooks suppression
   promotion path.
7. [`M3-cars-handoff.md`](M3-cars-handoff.md) — `useCars` /
   `useCar` hook patterns that `useEntries` mirrors.

---

## 3. Scope

### In scope

- **MPG computation module** (`src/entries/computeMpg.ts`):
  Pure functions, no Firestore dependency. Exports:
  - `perFillMpg(entry, prior): number | null` — per-fill MPG;
    null if `prior` is null OR if `odo_delta <= 0` (the M4
    flag-but-accept negative case).
  - `lastFillMpg(entriesNewestFirst): number | null` — MPG of
    the most-recent entry that has a valid prior pair.
    Internally pairs entry N with entry N-1 chronologically.
  - `avgLastNMpg(entriesNewestFirst, n): number | null` —
    weighted MPG over the most-recent N entries. Formula
    `(odo[N] - odo[N-n+1]) / sum(gallons[N-n+2..N])` —
    i.e., distance covered by the last `n-1` pairs divided by
    the fuel that propelled it (skipping the oldest entry's
    gallons in the window since its fill happened before the
    window started). Null if fewer than 2 valid entries in
    window, OR if the window's net `odo_delta <= 0`. (For
    n=5: needs at least 2 entries to produce a number; needs
    at least 5 entries to compute over exactly 5.)
  - `lifetimeMpg(entriesNewestFirst): number | null` — same
    formula as `avgLastNMpg` but over all entries on the car.
    Strict tank-to-tank methodology: `(max_odo - min_odo) /
    sum(gallons except the chronologically first entry)`.
- **`useEntries(carId)` hook** (`src/entries/useEntries.ts`):
  - Returns `{ state, refresh }` where `state` is
    `{ status: 'loading' } | { status: 'ready'; entries: Entry[] } |
    { status: 'error'; error: unknown }`. Same discriminated-
    union shape as `useCars` / `useCar`.
  - Same epoch race-guard pattern (third instance; adds the
    third narrow `eslint-disable-next-line react-hooks/set-
    state-in-effect` per the M4-promoted BACKLOG cleanup item).
  - Internally calls `listEntriesForCar(carId)` — see below.
  - `entries` returned in **newest-first order** (descending
    `loggedAt`).
- **`listEntriesForCar` signature change** in
  `src/entries/entries.ts`: drop the `limit=50` default; new
  signature `listEntriesForCar(carId): Promise<Entry[]>` —
  fetches all entries on the car, ordered `loggedAt desc`.
  Backward-compatible since M4's stub had no real callers.
- **`<CarDetailScreen />` section addition**: where the M4 V6
  fix-forward removed the placeholder, insert the new Fill-ups
  section containing:
  1. Three `<MpgTile />` instances (Last fill / Avg last 5 /
     Lifetime).
  2. The `<EntriesTable />`.
- **Component additions** (`src/components/`):
  - `MpgTile.tsx` — `{ label: string; value: number | null;
    subtitle?: string }`. Renders the label, the value with one
    decimal + " mpg" unit ("32.4 mpg"), or "—" when value is
    null. Optional subtitle below the value for context (e.g.,
    "(need 2+ fills)" when null at <2 entries).
  - `EntriesTable.tsx` — `{ entries: Entry[] }`. Renders a
    table with header row [Date | Odometer | Gallons | Cost |
    MPG] and one row per entry. Mobile-first tight columns.
    Empty state when `entries.length === 0`: "No fill-ups
    yet." Per-row MPG computed via `perFillMpg(entry, prior)`
    where `prior` is the chronologically-previous entry on
    the same car (i.e., the entry at index+1 in the newest-
    first array).
- **PRD amendment** (per "ink not stone"):
  - **§8 Cost control** "Per-car detail" row: from "1 Car doc
    plus 1 Entries query (latest 50)" to "1 Car doc plus 1
    Entries query (all entries on car)" with an inline note
    dated 2026-05-28 referencing M5 owner decision (latest-50
    cap was YAGNI at family scale; aggregate-doc tripwire
    already captured as BACKLOG → Later mitigation).
- **BACKLOG addition** (during this dispatch):
  - Later → Reports & insights subsection: **"Show 'logged by
    {name}' per entry — requires nickname infrastructure"** —
    S to M. Captures the design space (per-user nickname vs.
    per-share nickname) so the M5 design conversation outcome
    isn't lost.
- **Tests**:
  - **Unit tests for `computeMpg.ts`** — comprehensive.
    Required by AGENTS testing gate. Cases must cover:
    - `perFillMpg`: null prior → null; valid prior with
      positive odo delta → correct MPG; negative odo delta →
      null; zero odo delta → null; zero gallons → null (would
      divide by zero); typical case → correct value.
    - `lastFillMpg`: empty array → null; single entry → null;
      two valid entries → correct MPG; newest pair with
      negative delta → null (does NOT fall through — per
      Decision #5b).
    - `avgLastNMpg`: empty → null; one entry → null; two
      entries with valid pair → correct MPG over that pair;
      five entries, n=5 → MPG over the 5-window; ten entries,
      n=5 → MPG over the most-recent 5 only; net
      negative-delta window → null (defensive); n=5 but only
      3 entries on car → MPG over the 3 available.
    - `lifetimeMpg`: empty → null; one entry → null; two →
      correct MPG; many strictly-monotonic entries → correct
      MPG matching hand-computation. NO test for negative-
      delta or unclean-data behavior — Decision #2's clean-
      data assumption means we don't engineer for or test
      against bad data. If a future maintenance pass adds
      data-cleanup tooling, it can add tests then.
  - **No new rules tests.** Entries READ rule already covers
    the query path (M2 R3 via `parentCar()` helper).
  - **No hook test for `useEntries`.** Hook integration tests
    deferred per AGENTS "Component / integration tests:
    deferred. Use the manual checklist in each dispatch's
    acceptance criteria. Revisit when a real regression slips
    through manual review."

### Out of scope (defer)

- **Per-car insight tiles beyond MPG** (max-ever-fuel,
  best/worst MPG, cost-per-mile) — BACKLOG → Later (Reports
  & insights).
- **Charts / trends-over-time** — BACKLOG → Later. Needs a
  charting library decision; not earned at family scale.
- **Cross-car aggregates** — BACKLOG → Later.
- **Edit / delete entries** — BACKLOG → Soon (long-standing
  item; not M5).
- **CSV export / import** — BACKLOG → Soon (long-standing
  items; not M5).
- **"Logged by Sarah" attribution per row** — see new BACKLOG
  → Later entry this dispatch.
- **Aggregate doc for per-car MPG** — BACKLOG → Later
  (existing); the tripwire mitigation for when entries-per-car
  scales past a comfortable read budget. M5 ships the naive
  read-all-entries path.
- **`useEntries` paging / load-more** — owner explicit
  2026-05-28: "hard to reason about paging until I have a
  paging issue." Read-all-then-render is the v0 posture.
- **Prod cutover** — separate post-M5 conversation per owner.

---

## 4. Decisions locked in (from design conversation 2026-05-28)

Settled. Implementer treats as fixed unless flagged stop-and-ask.

1. **Three MPG tiles**: Last fill / Avg last 5 / Lifetime.
   Approved during design (the "Avg last 5" was an explicit
   owner addition between Q5 and Q6 — captures recent trend
   without weighting against the full history).
2. **Lifetime formula = `(newest.odometer - oldest.odometer) /
   sum(gallons except oldest)`.** Owner-clarified 2026-05-28
   (post-first-pre-read): the formula uses literal
   newest-minus-oldest, not max-minus-min. Project-level
   assumption per PRD §3: odometer strictly increases entry-
   over-entry. If a user provides bad data (e.g., an M4
   flag-but-accept negative-delta entry), the lifetime number
   may be off — that's the user's signal to fix the data, not a
   bug for M5 to engineer around. The "skip oldest's gallons"
   piece holds: that fill happened before tracking started, so
   no odometer delta to attribute it to. Makes the lifetime tile
   mathematically consistent with per-row MPG in the clean-data
   case.
3. **Avg last 5 formula** = same strict methodology scoped to
   the most-recent 5 entries:
   `(odo[latest] - odo[5th-most-recent]) / sum(gallons of the
   4 most-recent entries, skipping the 5th-most-recent)`.
   For cars with <5 entries, computes over the available
   entries (still >= 2 needed for any number).
4. **Drop the latest-50 cap** per owner Clarification 2
   Reading B. `listEntriesForCar(carId)` fetches all entries
   on the car. PRD §8 amended accordingly. The aggregate-doc
   BACKLOG → Later item remains the scale-mitigation path.
5. **Hide negative per-row MPG** ("—") per owner Q1. Rationale:
   negative MPG is meaningless to a layperson; the right
   recovery is editing the bad entry (BACKLOG → Soon).
5b. **`lastFillMpg` does NOT fall through** to next-valid pair
    (owner-clarified 2026-05-28 post-first-pre-read; Option A).
    If the newest entry's pair is invalid (negative delta, zero
    gallons), the tile shows "—" — matching the per-row MPG on
    that entry's row in the table. Consistency wins: user sees
    "—" both in tile and row, no apparent contradiction. The
    alternative (fall through to next valid pair) would have
    shown a number in the tile while showing "—" in the
    matching table row — visually contradictory without
    explanatory copy.
6. **Hide `loggedByUid` per row** per owner Q3. Add the
   "nickname infrastructure" item to BACKLOG → Later capturing
   the design space.
7. **Table-style entries list** per owner Q5. Columns: Date /
   Odometer / Gallons / Cost / MPG. Mobile-first; tight
   columns; one row per entry.
8. **Display precision**:
   - MPG: 1 decimal + " mpg" unit ("32.4 mpg")
   - Gallons: 2 decimals ("12.30")
   - Cost: 2 decimals + "$" prefix ("$42.15")
   - Odometer: integer ("50300")
9. **Date display**: absolute, locale-aware. Format choice is
   implementer's call (e.g., `"May 25"` short form; cross-year
   entries get `"May 25 2026"`). Never relative ("3 days
   ago").
10. **Entries displayed newest-first.** MPG computation pairs
    chronologically internally.
11. **Empty entries-list state**: "No fill-ups yet." Period.
    No additional copy. (This is a legit empty state — the
    user just opened a car they expect to see entries on. Not
    the "placeholder for milestone-gap" pattern from M4 V6.)
12. **MPG tiles with `null` values render "—"** plus a subtle
    subtitle like "(need 2+ fills)" or "(need 5+ fills)" when
    helpful. Tile doesn't hide; consistent layout across
    tiles regardless of data state.
13. **`useEntries(carId)` adds the third
    `react-hooks/set-state-in-effect` suppression.** Per the
    BACKLOG → Soon "Refactor data-fetch hooks" item promoted
    at M4 closure: cleanup is a dedicated dispatch right
    after M5. M5 ships the third suppression with the same
    narrow `eslint-disable-next-line` shape as M3.
14. **No new dependencies.** No charting library; no date
    library (use `Intl.DateTimeFormat` for the date display).
15. **One PRD amendment** this dispatch: §8 Cost control row
    for "Per-car detail" — cap drop from "latest 50" to "all
    entries on car."
16. **Pre-read required** (WORKING-MODEL §3; M-sized).

---

## 5. Files in play

```text
flog/
├── PRD.md                                      (modified — §8 amendment)
├── BACKLOG.md                                  (modified — nickname entry in Later)
├── src/
│   ├── entries/
│   │   ├── entries.ts                          (modified — listEntriesForCar signature)
│   │   ├── computeMpg.ts                       (new — pure MPG helpers)
│   │   ├── computeMpg.test.ts                  (new — comprehensive unit tests)
│   │   └── useEntries.ts                       (new — hook with race-guard)
│   ├── components/
│   │   ├── MpgTile.tsx                         (new)
│   │   └── EntriesTable.tsx                    (new)
│   └── screens/
│       └── CarDetailScreen.tsx                 (modified — Fill-ups section insertion)
```

No other files modified. No `tests/rules/` changes (entries
rules unchanged; existing M2 R3 + M4 R3-delete coverage
suffices).

This handoff at `dispatch/M5-mpg-and-entries-handoff.md`
written at the end. Brief §13 forward-feedback populated by
the implementer if rakes surface.

---

## 6. Files NOT to touch

- `AGENTS.md`
- `CUTTLEFISH-NAUTILUS.md`
- `WORKING-MODEL.md`
- `HANDOFF-TEMPLATE.md`
- `README.md`
- This brief (`dispatch/M5-mpg-and-entries.md`) — except §13
  forward feedback if a rake is captured.
- All `dispatch/M1-*`, `dispatch/M2-*`, `dispatch/M3-*`,
  `dispatch/M4-*` files — closed records.
- `dispatch/paralarva-feedback-*.md` — closed forward-
  feedback artifacts.
- `dispatch/runbooks/gcp-firebase-env-setup.md` — closed.
- `firestore.rules` — unchanged this dispatch.
- All `tests/rules/*` files — entries rules unchanged.
- `.firebaserc`, `firebase.json`, `vite.config.ts`,
  `tsconfig.app.json`, `tsconfig.node.json`,
  `tsconfig.test.json`, `tsconfig.json`, `eslint.config.js`,
  `vitest.config.ts`, `vitest.rules.config.ts`.
- `src/firebase/*` — M2-closed.
- `src/auth/*` — M2-closed.
- `src/cars/*` — M3-closed.
- `src/lib/mru.ts` — M4-closed.
- `src/screens/` everything except `CarDetailScreen.tsx`
  (modified — see §5).
- `src/components/` everything except the two new files in §5
  (`MpgTile.tsx`, `EntriesTable.tsx`).
- `src/entries/` everything except `entries.ts` (modified
  signature only — see §7.1) and the three new files in §5
  (`computeMpg.ts`, `computeMpg.test.ts`, `useEntries.ts`).
- `src/App.tsx`, `src/main.tsx`, `src/index.css`,
  `src/env.d.ts` — no changes.
- `.env.development`, `.env.production` — no new vars.

**One intentional exception** to the usual NOT-touch posture,
documented in Decision #15:

- `PRD.md` — §8 amendment per "ink not stone."

---

## 7. Architecture sketch

### 7.1 `listEntriesForCar` signature change

Current (M4):

```ts
export async function listEntriesForCar(
  carId: string,
  limit = 50
): Promise<Entry[]> { ... }
```

New (M5):

```ts
export async function listEntriesForCar(
  carId: string
): Promise<Entry[]> { ... }
```

Drop the `limit` parameter entirely. The implementation drops
the `fbLimit(limit)` clause from the `query(...)` call. All
entries on the car are returned, ordered `loggedAt desc`. No
callers exist in M4 (it was a stub for M5); backward-
incompatibility isn't a concern.

### 7.2 `src/entries/computeMpg.ts` — pure helpers

```ts
import type { Entry } from './entries';

// Per-fill MPG between two chronologically-adjacent entries.
// `prior` is null when `current` is the chronologically-first
// entry on the car (no prior to compute against).
export function perFillMpg(
  current: Entry,
  prior: Entry | null
): number | null {
  if (prior === null) return null;
  const odoDelta = current.odometer - prior.odometer;
  if (odoDelta <= 0) return null;  // M4 flag-but-accept negative case
  if (current.gallons <= 0) return null;  // defensive
  return odoDelta / current.gallons;
}

// MPG of the most-recent entry, using its immediate prior.
// Does NOT fall through to next-valid-pair (Decision #5b);
// if the newest pair is invalid (negative delta, zero
// gallons), returns null — matching the per-row "—" the
// table shows for that entry.
export function lastFillMpg(
  entriesNewestFirst: Entry[]
): number | null {
  if (entriesNewestFirst.length < 2) return null;
  return perFillMpg(entriesNewestFirst[0], entriesNewestFirst[1]);
}

// Strict tank-to-tank lifetime MPG. Skips the first
// chronological entry's gallons since that fill happened
// before tracking began.
//   numerator = max_odo - min_odo
//   denominator = sum(gallons) EXCLUDING the first chronological entry
export function lifetimeMpg(
  entriesNewestFirst: Entry[]
): number | null {
  if (entriesNewestFirst.length < 2) return null;
  // entriesNewestFirst[0] is newest; last index is oldest.
  const newest = entriesNewestFirst[0];
  const oldest = entriesNewestFirst[entriesNewestFirst.length - 1];
  const distance = newest.odometer - oldest.odometer;
  if (distance <= 0) return null;  // defensive — all entries same odo or worse
  // Sum gallons for entries[0..length-2] (everything except oldest).
  let fuel = 0;
  for (let i = 0; i < entriesNewestFirst.length - 1; i++) {
    fuel += entriesNewestFirst[i].gallons;
  }
  if (fuel <= 0) return null;  // defensive
  return distance / fuel;
}

// Strict tank-to-tank methodology over the N most-recent entries.
// For n=5: requires >= 2 entries to produce a number; takes
// min(n, entriesNewestFirst.length) entries from the front.
export function avgLastNMpg(
  entriesNewestFirst: Entry[],
  n: number
): number | null {
  const window = entriesNewestFirst.slice(0, Math.min(n, entriesNewestFirst.length));
  if (window.length < 2) return null;
  return lifetimeMpg(window);  // same formula, scoped to window
}
```

`avgLastNMpg` is `lifetimeMpg` over a windowed slice. Same
methodology; same edge cases. Implementer can inline the body
or compose — implementer's call; flag in handoff.

### 7.3 `src/entries/useEntries.ts` — hook

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { listEntriesForCar } from './entries';
import type { Entry } from './entries';

type UseEntriesState =
  | { status: 'loading' }
  | { status: 'ready'; entries: Entry[] }
  | { status: 'error'; error: unknown };

export interface UseEntriesResult {
  state: UseEntriesState;
  refresh: () => Promise<void>;
}

export function useEntries(carId: string): UseEntriesResult {
  const [state, setState] = useState<UseEntriesState>({ status: 'loading' });
  const epochRef = useRef(0);

  const refresh = useCallback(async () => {
    const epoch = ++epochRef.current;
    setState({ status: 'loading' });
    try {
      const entries = await listEntriesForCar(carId);
      if (epoch !== epochRef.current) return;  // stale; discard
      setState({ status: 'ready', entries });
    } catch (error) {
      if (epoch !== epochRef.current) return;
      setState({ status: 'error', error });
    }
  }, [carId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The
    // race guard above means setState only fires for the latest fetch;
    // a subscribe-style refactor (BACKLOG → Soon) will remove the need
    // for this suppression across useCars/useCar/useEntries together.
    refresh();
  }, [refresh]);

  return { state, refresh };
}
```

Same shape as `useCars` / `useCar`. The race guard is
load-bearing — failure mode is silent (older fetch resolves
after newer; stale data wins).

### 7.4 `<MpgTile />` shape

```tsx
interface MpgTileProps {
  label: string;          // e.g., "Last fill"
  value: number | null;   // mpg or null
  subtitleWhenEmpty?: string;  // e.g., "(need 2+ fills)"
}

export function MpgTile({ label, value, subtitleWhenEmpty }: MpgTileProps) {
  return (
    <div className="... tile styling ...">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">
        {value === null ? '—' : `${value.toFixed(1)} mpg`}
      </div>
      {value === null && subtitleWhenEmpty && (
        <div className="text-xs text-gray-400">{subtitleWhenEmpty}</div>
      )}
    </div>
  );
}
```

Tile preserves its layout slot regardless of value state.
Implementer picks the exact Tailwind classes; the spirit is
"three tiles in a row at the top of the Fill-ups section,
visually consistent."

### 7.5 `<EntriesTable />` shape

```tsx
interface EntriesTableProps {
  entries: Entry[];  // newest-first
}

export function EntriesTable({ entries }: EntriesTableProps) {
  if (entries.length === 0) {
    return <p className="text-gray-500">No fill-ups yet.</p>;
  }
  return (
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Odometer</th>
          <th>Gallons</th>
          <th>Cost</th>
          <th>MPG</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, i) => {
          const prior = entries[i + 1] ?? null;  // chronologically prior
          const mpg = perFillMpg(entry, prior);
          return (
            <tr key={entry.id}>
              <td>{formatDate(entry.loggedAt)}</td>
              <td>{entry.odometer}</td>
              <td>{entry.gallons.toFixed(2)}</td>
              <td>${entry.cost.toFixed(2)}</td>
              <td>{mpg === null ? '—' : `${mpg.toFixed(1)} mpg`}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

`formatDate(timestamp)` uses `Intl.DateTimeFormat` with locale
defaults. Implementer picks the format string (e.g., `{ month:
'short', day: 'numeric' }` and adds year when cross-year).

`entries[i + 1] ?? null` works because the array is newest-
first. The oldest entry's prior is undefined → null → its
per-row MPG is "—" (correct per Decision #5).

Mobile-first table: tight padding, smaller font in cells, no
borders or minimal borders. Implementer's call on exact
styling. The header row stays sticky if implementer chooses,
but not required.

### 7.6 `<CarDetailScreen />` integration

The section M4 removed from CarDetailScreen during V6 fix-
forward (the empty slot between the share section and the
owner delete button) becomes:

```tsx
// Inside the CarDetailScreen component body, alongside the
// existing useCar(carId ?? '') call. carId comes from
// useParams() and is typed string | undefined; mirror M3's
// existing `?? ''` fallback so TS strict mode is happy.
const { state: entriesState, refresh: refreshEntries } = useEntries(carId ?? '');

// ...in the JSX, between the share <section> and the
// owner-only delete <section>:
<section className="flex flex-col gap-4">
  <h2 className="text-lg font-semibold">Fill-ups</h2>
  {entriesState.status === 'loading' && <p>Loading…</p>}
  {entriesState.status === 'error' && (
    <p className="text-red-600">
      Couldn't load fill-ups —{' '}
      <button onClick={refreshEntries}>try again</button>
    </p>
  )}
  {entriesState.status === 'ready' && (
    <>
      <div className="grid grid-cols-3 gap-2">
        <MpgTile label="Last fill"
                 value={lastFillMpg(entriesState.entries)}
                 subtitleWhenEmpty="need 2+ fills" />
        <MpgTile label="Avg last 5"
                 value={avgLastNMpg(entriesState.entries, 5)}
                 subtitleWhenEmpty="need 2+ fills" />
        <MpgTile label="Lifetime"
                 value={lifetimeMpg(entriesState.entries)}
                 subtitleWhenEmpty="need 2+ fills" />
      </div>
      <EntriesTable entries={entriesState.entries} />
    </>
  )}
</section>
```

The header "Fill-ups" returns — but unlike M4's deleted
placeholder, it now anchors actual content. Empty entries
list (zero entries on car) shows the "No fill-ups yet."
empty state per Decision #11 — that's a context-specific
empty state (user expects entries; absence is meaningful),
not the milestone-gap placeholder pattern M4 V6 removed.

### 7.7 PRD §8 amendment

Current row (M5-baseline):

```text
| Per-car detail | 1 Car doc + 1 Entries query (latest 50) | 0 |
```

New row (post-amendment):

```text
| Per-car detail | 1 Car doc + 1 Entries query (all entries on car) | 0 |
```

Plus an inline note paragraph under the table (no blockquote;
match the in-place §6.4 precedent which uses normal paragraph
form, not blockquote):

**Note on the "Per-car detail" row** (amended 2026-05-28
during M5): the original v1 spec capped at "latest 50"
entries. Owner decision during M5 design: drop the cap. At
family scale (~30 entries per car per year), fetching all
entries per detail-page view is well within the free-tier
read budget for the foreseeable future. The aggregate-doc
tripwire (BACKLOG → Later) remains the next defense line if
scale forces it. Skipping the arbitrary cap also keeps the
lifetime MPG number honest (avg-over-all-entries, not
avg-over-latest-50 which would silently drift as old entries
aged out of the window). Note that the literal billed-read
count is roughly **2× the entry count** under the current
entries-read rule shape (each entry doc triggers a
`get(parentCar)` rule eval which Firestore bills as a read);
the BACKLOG → Later "Verify rules `get()` caching semantics"
item resolves whether Firestore caches identical `get()`
paths within a single query's rule evaluation pass. Either
way, at family scale this stays orders of magnitude below
tripwire.

---

## 8. Acceptance criteria

Numbered by subsection. M5 continues series prefixes from M4:
`E*` (entries module) was at E5, M5 starts at E6;
`U*` was at U18, M5 starts at U21;
`P*` was at P3, M5 starts at P4;
`V*` was at V7, M5 starts at V8.
New prefixes: `H*` (hooks), `MP*` (MPG computation — explicit
2-letter prefix to avoid collision with M4's MRU `M*`); `G*`
(UI tiles/table generics).

### E* — Entries module (modification)

- **E6** `listEntriesForCar(carId)` signature drops the
  `limit` parameter. Implementation drops the `fbLimit(...)`
  query constraint. Returns all entries on the car, ordered
  `loggedAt desc`.

### H* — Hooks

- **H1** `src/entries/useEntries.ts` exports `useEntries(carId)`
  returning `{ state, refresh }` where `state` is the
  discriminated union `{loading} | {ready;entries[]} |
  {error}`. Mirrors `useCars` / `useCar` shape exactly.
- **H2** Epoch race guard implemented on **both** success and
  error paths. Stale resolutions discarded. Third instance of
  the `react-hooks/set-state-in-effect` narrow suppression
  with the explanatory comment referencing the BACKLOG → Soon
  refactor item.

### MP* — MPG computation

- **MP1** `src/entries/computeMpg.ts` exports `perFillMpg`,
  `lastFillMpg`, `avgLastNMpg`, `lifetimeMpg`. Pure functions;
  no Firestore dependency; no React dependency. Importable
  from any context.
- **MP2** `perFillMpg(current, prior)` returns `null` when:
  prior is null, OR odo delta ≤ 0, OR current.gallons ≤ 0.
  Otherwise returns `(current.odometer - prior.odometer) /
  current.gallons`.
- **MP3** `lastFillMpg(entriesNewestFirst)` returns
  `perFillMpg(entries[0], entries[1])` — the MPG of the
  newest entry's pair, or null if that pair is invalid. Does
  NOT fall through to next-valid pair (Decision #5b).
- **MP4** `lifetimeMpg(entriesNewestFirst)` returns
  `(newest.odometer - oldest.odometer) /
  sum(gallons[0..length-2])`. Null when fewer than 2 entries,
  or net distance ≤ 0, or fuel sum ≤ 0. The strict-monotonic
  odometer assumption (Decision #2 + PRD §3) means bad data
  may produce null or unexpected numbers; that's the user's
  signal to fix data, not M5's problem to engineer around.
- **MP5** `avgLastNMpg(entriesNewestFirst, n)` returns
  `lifetimeMpg(entries.slice(0, min(n, length)))`. Same edge
  cases; same null semantics.

### G* — UI components

- **G1** `<MpgTile label value subtitleWhenEmpty? />` renders
  the label, the value as "32.4 mpg" (one decimal, " mpg"
  suffix), or "—" plus optional subtitle when value is null.
  Preserves layout slot regardless of value state.
- **G2** `<EntriesTable entries />` renders a table with
  header [Date | Odometer | Gallons | Cost | MPG] + one row
  per entry. Newest-first. Per-row MPG via
  `perFillMpg(entries[i], entries[i+1] ?? null)`. Empty state:
  "No fill-ups yet." (single line, no extra copy).
- **G3** Date formatting uses `Intl.DateTimeFormat` with
  locale defaults. Options: `{ month: 'short', day: 'numeric' }`
  for current-year entries; add `year: 'numeric'` for
  cross-year entries. Exact output string varies by locale
  (en-US: "May 25"; en-GB: "25 May") — that's intentional
  per "locale defaults." Don't pin a specific format.
- **G4** Display precision per Decision #8: MPG 1 decimal +
  " mpg"; gallons 2 decimals; cost 2 decimals + "$" prefix;
  odometer integer.

### U* — UI surface integration

- **U21** `<CarDetailScreen />` inserts the new Fill-ups
  section at the location M4 V6 fix-forward removed (between
  the Share section and the owner delete button). Section
  contains a "Fill-ups" header, three `<MpgTile />`s in a
  3-column grid, and the `<EntriesTable />`.
- **U22** Loading state: while `useEntries(carId)` is at
  `state.status === 'loading'`, render "Loading…" or a minimal
  spinner. Tiles and table do NOT render during loading.
- **U23** Error state: while `useEntries(carId)` is at
  `state.status === 'error'`, render "Couldn't load fill-ups
  — try again" with a button calling `refresh`. Tiles and
  table do NOT render on error. Mirrors the M3
  `<CarListScreen />` error pattern.
- **U24** Sharee view: a sharee opening the car detail sees
  the Fill-ups section (tiles + table) identically to the
  owner. Sharees can read entries per PRD §6.3; the rule path
  is already verified by M2 R3 tests.
- **U25** Mobile-first at 375px: the 3-tile grid wraps
  gracefully (3 cols → 1 col stack if too tight at smallest
  viewport, implementer's call); the table columns squeeze
  without horizontal overflow.

### T* — Tests

- **T13** Unit tests for `computeMpg.ts` covering the cases
  enumerated in §3 In-scope Tests bullet. Specifically:
  `perFillMpg` (≥6 cases), `lastFillMpg` (≥4 cases — no
  fall-through behavior to test post-Decision #5b),
  `avgLastNMpg` (≥6 cases), `lifetimeMpg` (≥4 cases —
  clean-data only per Decision #2). Total ≥20 cases.
- **T14** Hand-computed reference matches code per PRD §10
  M5 acceptance: at least one test in `computeMpg.test.ts`
  uses a small hand-computed fixture (e.g., 3-4 entries with
  known odometers/gallons) and asserts the code's output
  matches the manual calculation byte-for-byte (to 4+
  decimal places).
- **T15** `npm test` exits 0; `npm run test:rules` exits 0.

### L* — Lint + types

- **L10** `npm run lint` exits 0.
- **L11** `npm run lint:md` exits 0.
- **L12** Strict TS; no `any`; catch clauses use `unknown` +
  type guards (mirror M2/M3/M4 pattern).

### P* — PRD amendments

- **P4** PRD §8 "Per-car detail" row updated per §7.7 above:
  from "latest 50" to "all entries on car" with an inline
  amendment note matching the §6.4 / §6.3 precedent shape.
- **P5** BACKLOG → Later → Reports & insights subsection
  gains: **"Show 'logged by {name}' per entry — requires
  nickname infrastructure"** with the design space (per-user
  vs. per-share) and trigger ("family member asks who logged
  this fill") captured.

### V* — Build / Verification

- **V8** `npm run build:dev` and `npm run build:prod` exit 0.
  Bundle delta captured in handoff. Expected: small (~3-5 KB
  raw / ~1-2 KB gz — no new deps; just new pure helpers + 2
  components + 1 hook).
- **V9** Owner V2 manual test (post-deploy to `flog-dev`;
  no rules change so just `npm run deploy:dev`):
  - Sign in as admin → `/` (LogFillupScreen). Navigate to
    `/cars`, tap a car with multiple entries from M4 V6.
  - Verify the Fill-ups section appears.
  - **Hand-compute MPG** for the entries on that car using
    pencil + paper (or calculator):
    - Per-fill MPG for the most-recent entry: `(odo_now -
      odo_prev) / gallons_now`.
    - Last-fill MPG tile should match.
    - Lifetime MPG by hand: `(newest_odo - oldest_odo) /
      sum(gallons excluding oldest)`. Lifetime tile should
      match.
    - Avg-last-5 MPG: if ≥5 entries, hand-compute over the 5
      most-recent; otherwise the formula scopes to available.
    - Each per-row MPG: hand-verify a couple of rows.
  - Tap a car with 0 entries (or delete entries from one
    via Firestore Console for testing) → tiles show "—" with
    subtitle; table shows "No fill-ups yet."
  - Tap a car with 1 entry → tiles show "—"; table shows
    that one row with per-row MPG = "—".
  - Sign in as a shared-account → open a shared car → see
    tiles + table identically.
  - Cars with M4-injected odometer-down entry (if any
    survived from M4 V6 testing): verify the per-row MPG for
    that row is "—" (not negative). The lifetime tile may
    show an unexpected number — that's by design (Decision
    #2 clean-data assumption: bad data produces funky
    summaries; signal to fix data, not engineer around it).
    If the lifetime number bothers you visually, delete the
    bad entry via Firestore Console for now (BACKLOG Soon
    item "Edit / delete entries" eventually delivers
    in-app cleanup).
- **V10** No prod deploy. Per owner: prod cutover is post-M5
  (or later).

---

## 9. Stop and ask

Pause and surface before:

1. **Adding any new dependency** (charting library, date
   library, etc.). AGENTS guardrail. M5 explicitly uses
   `Intl.DateTimeFormat` for dates — no library needed.
2. **Any rules change** to `firestore.rules`. M5 is rules-
   unchanged; if you find yourself needing a rule edit,
   surface immediately.
3. **Any schema change** to Car / Entry / User / Allowlist
   beyond the PRD §8 amendment (which is a cost-table edit,
   not a schema edit). The nickname infrastructure idea is
   filed to BACKLOG, NOT implemented.
4. **`catch (err: unknown)` without a clean type guard.**
   Same posture as M2/M3/M4.
5. **MPG formula edge cases** you encounter that aren't
   covered by the enumerated tests in T13. Surface and add
   a test case rather than letting the formula silently
   misbehave on an unanticipated input shape.
6. **Bundle size delta exceeds ~10 KB raw.** Expected
   ceiling is 3-5 KB; doubling that signals an unexpected
   import. Don't reach for code-splitting heroics — surface
   first.
7. **Hook-vs-pseudocode deviation.** §7.3 specifies the exact
   hook shape including the eslint-disable line. If you find
   a way to avoid the suppression entirely (e.g., the
   refactor described in the BACKLOG → Soon item lands
   naturally), surface — it's a meaningful enough change to
   discuss before silently shipping a different pattern.
8. **Table layout that doesn't fit 375px** without horizontal
   overflow. Implementer's call on font-size / padding /
   column-width, but if you can't make it work without
   sacrificing readability, surface — collapsing to a card
   layout would be a Q5 reversal.
9. **`avgLastNMpg` inline vs. composed.** §7.2 notes it can
   be inlined or composed via `lifetimeMpg(slice)`. Pick one;
   flag in handoff. Both work; composing is shorter; inlining
   is marginally clearer for someone reading the code cold.
10. **The hand-computed reference fixture in T14.** Pick a
    realistic small dataset (3-4 entries; round numbers for
    easy mental math). If your fixture's numbers come out
    "ugly" (e.g., 27.142857142857...), simplify to round
    inputs so the test asserts a clean decimal — easier to
    debug if it ever fails. Use **strictly-monotonic** odometer
    sequences per Decision #2 clean-data assumption; do NOT
    include negative-delta entries in the lifetime test
    fixture.
11. **Clean-data assumption** (Decision #2) is load-bearing
    for `lifetimeMpg` and `avgLastNMpg`. If you find a
    plausible-looking M5 code path where odometer monotonicity
    matters in a way the brief doesn't acknowledge (e.g., a
    UI affordance that lets users introduce negative-delta
    entries beyond the M4 log form), surface it — don't
    silently add defensive engineering. The right answer is
    almost always "user fixes data," not "code handles bad
    shape gracefully."

---

## 10. Dependencies expected

No new runtime or dev dependencies. M5 uses only:

- `firebase` (already installed) — `firebase/firestore` for
  `listEntriesForCar`'s underlying calls (no signature change
  on the firestore primitives).
- `react` / `react-dom` / `react-router` — already installed.
- `vitest` for the new unit tests — already installed.
- `Intl.DateTimeFormat` — browser built-in; no install.

If the implementer reaches for a date library
(`date-fns`, `dayjs`, etc.), that's stop-and-ask (§9 #1).

---

## 11. Handoff guidance

Implementer writes `dispatch/M5-mpg-and-entries-handoff.md`
per `HANDOFF-TEMPLATE.md`. Required sections (template):
Status, Versions chosen (will be "no changes"), Assumptions
made, Deviations from dispatch, Files created, Files NOT
touched (confirmed), Items deferred, Expected cost impact,
Manual steps for the human owner, Notes for the next dispatch
brief.

Specific things to capture:

- The `avgLastNMpg` implementation shape (inline vs. composed
  via `lifetimeMpg(slice)`); rationale.
- The hand-computed reference fixture used in T14; if the
  fixture differs from the §9 #10 suggestion (round inputs,
  clean decimal output), explain.
- The date-formatting choice (the exact `Intl.DateTimeFormat`
  options); rationale for cross-year handling.
- The MpgTile / EntriesTable visual styling choices (Tailwind
  classes; mobile-first density decisions).
- Bundle delta from M4 baseline (677.19 KB JS / 177.90 KB gz).
- Anything the **react-hooks suppression cleanup dispatch**
  will want to know about M5's `useEntries` hook shape that
  isn't obvious from M3/M4's hooks (probably nothing — M5
  mirrors them exactly; just confirm).
- Anything the **prod cutover conversation** should know
  about M5's UX that affects family-onboarding messaging
  (e.g., "tiles need at least 2 fills before showing
  numbers" is worth telling family upfront).

---

## 12. Pre-read checklist

The reviewer cuttlefish reads this brief + the supporting
artifacts and reports against:

- **Brief-internal consistency**: §4 decisions ↔ §8 ACs ↔ §5
  files. Every AC has a file; every file has an AC.
- **PRD alignment**: §3 (MPG definition) ↔ `perFillMpg`
  implementation; §7 Flow F ↔ §7.6 sketch (does the
  CarDetailScreen integration honor Flow F's "Per-car detail
  view renders…" enumeration?); §8 amendment matches §7.7
  and AC P4.
- **AGENTS alignment**: MPG computation unit-tested (✓ per
  T13/T14); one-write-path posture (no writes in M5; reads
  only); no `any`; no real-time listeners; rules-tests as a
  gate (no new rules tests — verify no rules changed).
- **M4 inheritance**: does the brief assume anything from M4
  the handoff doesn't confirm? Specifically the
  `<CarDetailScreen />` insertion point (M4 V6 fix-forward
  removed the placeholder — verify the slot is actually
  there); the `Entry` type export from `entries.ts`; the
  `listEntriesForCar` signature being a stub with no real
  callers (verify by grep).
- **Hook pattern consistency**: §7.3 `useEntries` matches
  `src/cars/useCars.ts` and `src/cars/useCar.ts` in shape
  (discriminated union state, epoch guard with functional
  setState updates, narrow eslint-disable). Compare directly
  by reading those files.
- **`perFillMpg` correctness**: trace the formula against
  PRD §3 line by line. Check edge cases: null prior, zero
  gallons, zero/negative odo delta.
- **`lifetimeMpg` correctness**: the "skip first entry's
  gallons" interpretation is load-bearing. Re-derive: at
  family scale, the formula `(O_N - O_1) / sum(g[2..N])` is
  the standard tank-to-tank methodology. Verify §7.2
  implementation matches (uses `entries[0..length-2]` for
  the fuel sum in newest-first ordering — that's indices 0
  through length-2 inclusive, which excludes the OLDEST
  entry at index `length-1`).
- **`lastFillMpg` no-fall-through**: verify the function does
  NOT iterate past the first pair (per Decision #5b). §7.2
  implementation should be a single `perFillMpg(entries[0],
  entries[1])` call returning null on bad newest-pair. If
  you see iteration / fall-through logic, the implementer
  ignored the decision.
- **`avgLastNMpg` window semantics**: for `n=5` with 3
  entries on car, takes all 3 (not error). For `n=5` with 10
  entries, takes the 5 most-recent. Verify
  `Math.min(n, length)`.
- **Internal contradictions** across brief sections.
- **Test scope reality check**: T13 enumerates ≥20 cases.
  Verify the breakdown adds up (perFillMpg 6 + lastFillMpg
  4 + avgLastNMpg 6 + lifetimeMpg 4 = 20; or more).
- **The brief's "Empty state" framing for the entries list**
  (Decision #11) vs. the M4 V6 placeholder-copy lesson —
  verify these are distinguished correctly (legit empty
  state vs. milestone-gap placeholder).
- **Missing edge cases**:
  - What if `loggedAt` timestamps tie exactly? Order is
    Firestore-arbitrary; pairs may be misaligned. Vanishingly
    rare; flag if you think §9 should mention.
  - What if an entry's `loggedAt` is null (server-resolved
    pending)? Firestore typically resolves before the doc is
    queryable, but in-flight reads may see null. Should
    `computeMpg` defend? Probably not; the type is
    `Timestamp` per Entry interface.
- **Scope discipline**: nothing M6+ snuck in. Brief explicitly
  defers per-car insight tiles beyond MPG, charts, edit/
  delete, CSV.

Report format: BLOCKING / SHOULD-FIX / NITS / CONFIRMED-OK.
Reviewer modifies no files.

---

## 13. Forward feedback channel

If the implementer hits rakes during execution that future
flog dispatches (or paralarva-kit consumers) should know about,
add them here as numbered items. Examples of what belongs
here:

- `Intl.DateTimeFormat` cross-browser inconsistencies on
  Chrome Android vs. Safari.
- Tailwind v4 table-styling gotchas at 375px viewport.
- Edge cases in the MPG formula that surface during the
  hand-computed reference test.

Rakes captured during execution + V9.

1. **PRD amendments cascade — one amendment can leave sibling
   text stale.** M5 amended the §8 "Per-car detail" cost row
   (latest-50 → all entries) per AC P4, but the §8
   "Tripwires" bullet below still referenced "approaches 50
   ceiling" — phrasing that only made sense given the dropped
   cap. The implementer flagged the staleness in handoff
   "Items deferred" rather than expanding the dispatch scope
   to a second PRD edit. Nautilus folded the fix during M5
   closure with a second "ink not stone" amendment note.
   **Recommendation for future briefs that amend PRD**: scan
   the surrounding paragraphs / bullets in the amended
   section for sibling text that references the about-to-
   change wording. A "one amendment per dispatch" framing
   should be interpreted as "one logical change," not "one
   line change" — sibling staleness counts as part of the
   change.

---

End of brief.
