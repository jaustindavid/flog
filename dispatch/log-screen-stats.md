# Log-screen per-car stats (expected range + maxes)

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

**Status**: draft — pending pre-read by reviewer cuttlefish (per
WORKING-MODEL §3) before implementer dispatch.

---

## 1. Context

First post-launch feature request. flog is live for the family on
`flog.austindavid.com`. Owner wants a second stats block on the log
screen (`/`, `LogFillupScreen`), below the existing 3 MPG tiles:
four per-car stats, three "fun maxes" + one genuinely-useful
**Expected range**. Derives from the entries `useEntries` already
fetches — **zero new reads**.

A UI-design pass (2026-05-29) + a data-driven design conversation
(percentiles computed against the real CSV) settled the shape. This
brief is self-contained; the design memo lived in chat.

What this does:

- New `src/entries/computeStats.ts` — pure stat helpers (imports
  `perFillMpg` from `computeMpg.ts`).
- New `src/components/StatRow.tsx` — a labeled list row.
- Adds a stats `<section>` to `LogFillupScreen` below the MPG tiles.

What this does NOT do: no new reads, rules, schema, or deps; does
not touch `computeMpg.ts`, `MpgTile`, or the log form.

---

## 2. Required reading

1. `src/screens/LogFillupScreen.tsx` — the screen this modifies;
   note the existing 3-MPG-tile section (gated on
   `entriesState.status === 'ready' && entries.length >= 1`, keyed
   `key={selectedCarId}` fade-in) — the new section mirrors that
   gate + fade.
2. `src/entries/computeMpg.ts` — `perFillMpg(current, prior)` is
   imported by the new module. Read its null semantics (returns
   null for no-prior / odo-delta ≤ 0 / gallons ≤ 0).
3. `src/components/MpgTile.tsx` — the existing tile (for visual
   consistency reference; **not** modified, **not** reused — see §7).
4. `dispatch/log-screen-restructure-handoff.md` — how the MPG tiles
   landed on this screen (the pattern to sit beside).
5. `PRD.md` §7 Flow C (log screen = fast pump surface), §9 (UI:
   mobile-first, ≥44pt, blue-600, no charts/decoration).
6. `AGENTS.md` — no `any`, MPG/stat pure functions unit-tested,
   no new deps.

---

## 3. Scope

### In scope

- **`src/entries/computeStats.ts`** (new) + **`.test.ts`**:
  - `validMpgs(entriesNewestFirst): number[]` — per-fill MPGs over
    adjacent pairs (`perFillMpg(entries[i], entries[i+1])`),
    dropping nulls. (entries are newest-first; index i+1 is the
    chronological prior — same convention as `EntriesTable`.)
  - `percentile(values, p): number | null` — linear-interpolated
    (Excel `PERCENTILE.INC` / "type 7"). See §7.1 for the exact
    formula. Null on empty input. Does NOT apply a min-count
    threshold (callers do).
  - `longestTank(entriesNewestFirst): number | null` — max positive
    odometer delta between adjacent fills. Null if <2 entries or no
    positive delta.
  - `largestFill(entriesNewestFirst): number | null` — max gallons.
    Null if no entries.
  - `p95Mpg(entriesNewestFirst): number | null` — `percentile(
    validMpgs, 0.95)`, but null if `validMpgs.length < 5`.
  - `expectedRangeBand(entriesNewestFirst): {lowMi, highMi} | null`
    — null if `validMpgs.length < 5` or no `largestFill`; else
    `{ lowMi: round(largestFill × percentile(mpgs,0.10)),
       highMi: round(largestFill × percentile(mpgs,0.90)) }`.
- **`src/components/StatRow.tsx`** (new) — a labeled row: label
  left, value right, optional `emphasis` (for Expected range),
  optional empty-state subtitle. See §7.2.
- **`src/screens/LogFillupScreen.tsx`** (modified) — a new stats
  `<section>` below the existing MPG-tile section, same
  ready+≥1-entry gate and `key={selectedCarId}` fade. Four
  `StatRow`s, Expected range emphasized on top. See §7.3.

### Out of scope (defer)

- Touching `computeMpg.ts` (import only), `MpgTile`, the log form,
  the car-detail screen.
- Charts / trends (BACKLOG → Later).
- A "more stats" disclosure/collapse — the design pass judged it
  over-engineering at family scale; the natural scroll boundary
  does the hierarchy.
- Putting these on the car-detail page — owner chose the log
  screen.

---

## 4. Decisions locked (design conversation 2026-05-29)

1. **Four stats, log screen, below the MPG tiles.** Owner's call
   (not the car-detail page).
2. **Layout = one labeled list** (not a tile grid): Expected range
   as an **emphasized top row**, then 3 quieter rows. (The 3 are
   reference/vanity; Expected range is the pump-useful one, so it's
   promoted + larger.)
3. **Expected range = a P10–P90 band**, not a single value:
   `largestFill × P10mpg` to `largestFill × P90mpg`, each rounded
   to integer miles, shown as `"230–291 mi"`. The band communicates
   the spread (conservative→optimistic) better than one number.
   **Note: the multiplier is `largestFill` (gallons), NOT
   "Longest tank" (miles).** Those are different stats; mixing them
   is a units error (mi²/gal).
4. **"P95 MPG"**, not "Best MPG.** The raw max surfaces partial-fill
   outliers (the real data has a 65 mpg Caterham artifact); P95 is
   the robust near-best. Label it honestly as **"P95 MPG"**.
5. **Percentiles = linear interpolation** (Excel `PERCENTILE.INC`).
   This matters: it must match the owner's spreadsheet numbers. The
   real Caterham data should yield P95 ≈ 35.9 mpg and an expected
   range ≈ 230–291 mi — usable as a V sanity-check.
6. **Min data**: P95 MPG + Expected range need **≥5 valid MPG
   pairs** (else "—"); Longest tank needs ≥2 entries; Largest fill
   ≥1. The section as a whole renders at ≥1 entry (like the MPG
   tiles), with each row showing "—" until its own bar is met.
7. **Labels** (exact): "Expected range", "P95 MPG", "Longest tank",
   "Largest fill". (Owner confirmed "Longest tank" for the
   max-odometer-gap distance stat.)
8. **`StatRow`, not `MpgTile`** — do not mutate or reuse the frozen
   `MpgTile` (CarDetailScreen depends on it; and the new stats are
   intentionally quieter + handle a band/mixed units).
9. **Sonnet-implementer candidate** once pre-read clean — pure-fn
   stats + one presentational component + an additive JSX block,
   reusing established patterns. (The percentile math is the one
   part worth a careful pre-read.)

---

## 5. Files in play

```text
flog/
└── src/
    ├── entries/
    │   ├── computeStats.ts        (new — stat helpers)
    │   └── computeStats.test.ts   (new — unit tests incl. percentile)
    ├── components/
    │   └── StatRow.tsx            (new)
    └── screens/
        └── LogFillupScreen.tsx    (modified — new stats section)
```

Handoff at `dispatch/log-screen-stats-handoff.md`.

---

## 6. Files NOT to touch

- `src/entries/computeMpg.ts` (+ test) — **import `perFillMpg`
  only; do not edit.** computeStats depends on its null semantics.
- `src/entries/useEntries.ts` — reused as-is (the stats read the
  same `state.entries`; no second fetch).
- `src/components/MpgTile.tsx` — untouched (not reused — see §7.2).
- `firestore.rules`, all `tests/rules/*` — no rules change.
- `PRD.md`, `AGENTS.md`, `BACKLOG.md`, the working-model/kit docs,
  README, LICENSE.
- The log form (chips, fields, Save), Header, all other screens
  and components.
- All config, `package.json`, `.env.*`, `/public/*`,
  `scripts/*`.

---

## 7. Architecture sketch

### 7.1 The math (`computeStats.ts`)

```ts
import type { Entry } from './entries';
import { perFillMpg } from './computeMpg';

// Valid per-fill MPGs (newest-first input; pair i with its
// chronological prior i+1). Drops null (no-prior / odo-down /
// zero-gallons) — same exclusions perFillMpg already applies.
export function validMpgs(entriesNewestFirst: Entry[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < entriesNewestFirst.length - 1; i++) {
    const m = perFillMpg(entriesNewestFirst[i], entriesNewestFirst[i + 1]);
    if (m !== null) out.push(m);
  }
  return out;
}

// Linear-interpolated percentile (Excel PERCENTILE.INC / type 7).
// p in [0,1]. Matches Google Sheets PERCENTILE() and the owner's
// spreadsheet — load-bearing for parity.
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  if (s.length === 1) return s[0];
  const rank = p * (s.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const frac = rank - lo;
  return s[lo] + frac * (s[hi] - s[lo]);
}

export function longestTank(entries: Entry[]): number | null {
  let max: number | null = null;
  for (let i = 0; i < entries.length - 1; i++) {
    const d = entries[i].odometer - entries[i + 1].odometer; // newest − prior
    if (d > 0 && (max === null || d > max)) max = d;
  }
  return max;
}

export function largestFill(entries: Entry[]): number | null {
  if (entries.length === 0) return null;
  return Math.max(...entries.map((e) => e.gallons));
}

const MIN_MPG_PAIRS = 5;

export function p95Mpg(entries: Entry[]): number | null {
  const m = validMpgs(entries);
  if (m.length < MIN_MPG_PAIRS) return null;
  return percentile(m, 0.95);
}

export function expectedRangeBand(
  entries: Entry[]
): { lowMi: number; highMi: number } | null {
  const m = validMpgs(entries);
  if (m.length < MIN_MPG_PAIRS) return null;
  const fill = largestFill(entries);
  if (fill === null) return null;
  return {
    lowMi: Math.round(fill * (percentile(m, 0.1) as number)),
    highMi: Math.round(fill * (percentile(m, 0.9) as number)),
  };
}
```

### 7.2 `StatRow`

A labeled list row — label left, value right. Quieter than
`MpgTile` (these are reference, not the primary glance). New file,
NOT a reuse of MpgTile.

```tsx
interface StatRowProps {
  label: string;
  // Pre-formatted display string (the screen formats units/precision
  // /band), or null → renders "—".
  display: string | null;
  emphasis?: boolean;        // Expected range: larger value, heavier
  subtitleWhenEmpty?: string; // e.g. "need 5+ fills" when display null
}
```

Shape: `flex items-baseline justify-between gap-3 py-1`. Label
`text-sm text-gray-600` (emphasis → `text-base text-gray-800`).
Value right-aligned, `text-base font-semibold text-gray-900`
(emphasis → `text-xl`). When `display === null`: show `—` in the
value slot; if `subtitleWhenEmpty` given, show it small/quiet
(`text-xs text-gray-400`) under the label or value (implementer's
call). Implementer picks exact spacing/separators; mobile-first,
no interactivity (read-only rows, so no ≥44pt requirement).

### 7.3 LogFillupScreen integration

Below the existing MPG-tiles block, inside the same
`entriesState.status === 'ready' && entriesState.entries.length >= 1`
branch (so it appears/hides with the tiles and fades on car switch
via the existing `key={selectedCarId}` wrapper — extend that
wrapper to cover both blocks, or give the new section its own
keyed wrapper; implementer's call, keep the fade behavior):

```tsx
// derive (entries = entriesState.entries):
const range = expectedRangeBand(entries);
const p95 = p95Mpg(entries);
const tank = longestTank(entries);
const fill = largestFill(entries);

// format helpers (inline or small local fns):
const fmtRange = (r) =>
  r === null ? null
  : r.lowMi === r.highMi ? `${r.lowMi} mi`
  : `${r.lowMi}–${r.highMi} mi`;          // en dash
const fmtMpg = (v) => (v === null ? null : `${v.toFixed(1)} mpg`);
const fmtMi  = (v) => (v === null ? null : `${Math.round(v)} mi`);
const fmtGal = (v) => (v === null ? null : `${v.toFixed(2)} gal`);

// section (below the MPG tiles, e.g. mt-3, optional hairline):
<section className="flex flex-col gap-1">
  <StatRow label="Expected range" display={fmtRange(range)}
           emphasis subtitleWhenEmpty="need 5+ fills" />
  <StatRow label="P95 MPG"      display={fmtMpg(p95)}
           subtitleWhenEmpty="need 5+ fills" />
  <StatRow label="Longest tank" display={fmtMi(tank)} />
  <StatRow label="Largest fill" display={fmtGal(fill)} />
</section>
```

(`–` is U+2013 en dash. Use a real en dash or `&ndash;`.)

---

## 8. Acceptance criteria

### S* — Stats module

- **S1** `computeStats.ts` exports `validMpgs`, `percentile`,
  `longestTank`, `largestFill`, `p95Mpg`, `expectedRangeBand` with
  the §7.1 semantics. Imports `perFillMpg` from `computeMpg.ts`;
  does not modify it.
- **S2** `percentile` is linear-interpolated (type-7 /
  `PERCENTILE.INC`) per §7.1 — NOT nearest-rank.
- **S3** `p95Mpg` / `expectedRangeBand` return null below 5 valid
  MPG pairs; `longestTank` null below 2 entries / no positive
  delta; `largestFill` null at 0 entries. Negative odo deltas
  excluded everywhere (via `perFillMpg` null + the `d > 0` guard).
- **S4** `expectedRangeBand` multiplies by **`largestFill`
  (gallons)** — never `longestTank`. Result rounded to integer
  miles per end.

### T* — Tests

- **T1** `computeStats.test.ts`:
  - `percentile`: hand-computed fixtures for a known small array
    (e.g. `[10,20,30,40]` → P50 = 25, P10 = 13, P90 = 37 by linear
    interp); empty → null; single → that value.
  - `validMpgs`: drops no-prior / negative-delta / zero-gallon
    pairs.
  - `longestTank`: max positive delta; ignores negative; null
    <2 entries.
  - `largestFill`: max gallons; null empty.
  - `p95Mpg` / `expectedRangeBand`: null below 5 pairs; correct
    value at ≥5 with a hand-computed fixture; band uses
    largestFill × P10 / P90.
- **T2** `npm test` exits 0; `npm run test:rules` unaffected
  (no rules change).

### U* — UI

- **U1** `StatRow` renders label + value (or "—" + optional
  subtitle); `emphasis` enlarges the value. No interactivity.
- **U2** LogFillupScreen shows the 4 rows below the MPG tiles, in
  order Expected range (emphasis) / P95 MPG / Longest tank /
  Largest fill, with the exact §4 item 7 labels and §7.3 formatting
  (band with en dash; mpg 1dp; mi integer; gal 2dp).
- **U3** Section shares the MPG-tile gate (`ready` && ≥1 entry) and
  the car-switch fade (`key={selectedCarId}`). Hidden at 0 entries
  / while loading, same as the tiles.
- **U4** Mobile-first 412px; blue-600 accent unchanged; the form,
  Save, and MPG tiles are visually unchanged above it.

### Lint / build / verify

- **L1** `npm run lint` 0; no `any`; `npm run lint:md` 0.
- **V1** `npm run build:dev` + `build:prod` exit 0.
- **V2** Owner manual (dev): open the Caterham → Expected range
  reads **≈ 230–291 mi**, P95 MPG **≈ 35.9 mpg** (parity with the
  spreadsheet percentiles — confirms the interpolation method);
  Longest tank + Largest fill show plausible values; a <5-fill car
  shows "—" + "need 5+ fills" on the two percentile rows; switching
  cars fades the values.

---

## 9. Stop and ask

1. Any new dependency (none expected).
2. Any change beyond the 3 files in §5 (esp. editing
   `computeMpg.ts` rather than importing from it).
3. If the percentile interpolation can't reproduce the §4.5 /
   §V2 reference numbers (≈35.9 mpg, ≈230–291 mi) on the real
   Caterham data — that's a method bug (likely nearest-rank vs
   linear); surface it.
4. `catch (err: unknown)` + type guard if any error handling is
   added (none expected — these are pure synchronous derivations).
5. If `largestFill` via `Math.max(...arr)` risks a call-stack
   limit on a huge entries array — it won't at family scale
   (hundreds), but if you prefer a reduce, fine; flag.

---

## 10. Dependencies

None. Pure TS + an existing-pattern component. No npm changes.

---

## 11. Handoff guidance

`dispatch/log-screen-stats-handoff.md` per template. Capture:
the percentile method used (confirm type-7/linear), the V2 parity
result against the Caterham reference numbers, the StatRow
empty-state layout choice, and bundle delta (should be ~negligible).

---

## 12. Pre-read checklist

- **Percentile correctness** (load-bearing): verify §7.1
  `percentile` is linear-interpolated and would reproduce the
  owner's spreadsheet figures (Caterham P95 ≈ 35.9, P10 ≈ 25.4,
  P90 ≈ 32.2; × largestFill 9.06 → ≈ 230 / 291 mi). Check the
  rank/interp arithmetic, not just the prose.
- **Units in `expectedRangeBand`**: confirm it multiplies
  `largestFill` (gallons), NOT `longestTank` (miles). This was the
  exact mix-up flagged in design; guard against it in the code +
  a test.
- **Thresholds** (≥5 pairs / ≥2 entries / ≥1) match §4 item 6 / §S3.
- **newest-first pairing** matches `EntriesTable` /
  `perFillMpg(entries[i], entries[i+1])` — not reversed.
- **`computeMpg.ts` import-only** — not modified.
- **Gate + fade** reuse the MPG-tile pattern (ready && ≥1 entry,
  `key={selectedCarId}`) — verify against the actual
  LogFillupScreen.
- **Labels exact** per §4 item 7; band uses an en dash.
- Internal consistency §4 ↔ §7 ↔ §8.

Report: BLOCKING / SHOULD-FIX / NITS / CONFIRMED-OK. No file edits.

---

## 13. Forward feedback channel

(empty until execution)

---

End of brief.
