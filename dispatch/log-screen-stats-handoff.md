# log-screen-stats handoff

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

---

## Status

- ✅ S1 — `computeStats.ts` exports all six functions; imports
  `perFillMpg` from `computeMpg.ts`; no edits to that file.
- ✅ S2 — `percentile` is type-7 linear interpolation
  (`PERCENTILE.INC`). Exact formula: `rank = p*(n-1)`;
  `lo=floor; hi=ceil; frac=rank-lo; s[lo]+frac*(s[hi]-s[lo])`.
  Not nearest-rank, not type-6.
- ✅ S3 — Null thresholds: `p95Mpg`/`expectedRangeBand` null
  below 5 valid MPG pairs; `longestTank` null below 2 entries or
  no positive delta; `largestFill` null at 0 entries.
- ✅ S4 — `expectedRangeBand` multiplies `largestFill` (gallons);
  comment in code + units-trap test guard both the invariant.
- ✅ T1 — 32 new unit tests across all six exports; hand-computed
  fixtures with reference comments; `[10,20,30,40]` → P50=25,
  P10=13, P90=37 confirmed; units-trap test asserts `lowMi=100`
  (not 1000) for largestFill=10gal, longestTank=100mi.
- ✅ T2 — `npm test` 112/112 passed (9 test files, up from 80
  tests / 8 files before this dispatch). `test:rules` 53/53,
  unaffected.
- ✅ U1 — `StatRow` renders label + value or `—`; `emphasis` uses
  `text-xl` for value and `text-base font-medium` for label.
  Empty-state subtitle renders below the label when `display`
  is null and `subtitleWhenEmpty` is provided.
- ✅ U2 — Four rows in order: Expected range (emphasis) / P95 MPG
  / Longest tank / Largest fill. Labels exact. Formatting: band
  with U+2013 en dash + " mi"; mpg 1dp; mi integer; gal 2dp.
- ✅ U3 — Stats section keyed independently with
  `key={selectedCarId}` (own wrapper, not folded into MPG tiles'
  `border-t pt-5` section). Same ready-&&-≥1-entry gate; TS
  narrowing to `.entries` preserved with inlined IIFE.
- ✅ U4 — Mobile-first; no new accent colors; form, Save, and
  MPG tiles visually unchanged above.
- ✅ L1 — `npm run lint` exit 0; `npm run lint:md` exit 0 (0
  errors, 31 files). No `any` — format helpers in
  `LogFillupScreen` explicitly typed (`r: {lowMi:number;
  highMi:number} | null`, `v: number | null`).
- ✅ V1 — `build:dev` and `build:prod` both exit 0. Bundle delta
  negligible (same chunk size as before; new code is pure
  functions + a small component).
- ⚠️ V2 — Owner manual check against real Caterham data. Expected
  ≈ 230–291 mi, P95 ≈ 35.9 mpg. The interpolation method is
  confirmed type-7/linear (identical to the owner's spreadsheet).
  Cannot verify against live data from this session.

---

## Versions chosen

No new dependencies. Pure TS + existing React/Tailwind.

---

## Assumptions made

- **IIFE pattern for the stats section** — `LogFillupScreen` uses
  an IIFE (`(() => { ... })()`) to derive the four stat values
  inside the JSX branch rather than hoisting the derivations above
  the `return`. This preserves TS control-flow narrowing on
  `entriesState.entries` (an extracted `const` above the `return`
  would lose the narrowing, as documented in the existing MPG-tile
  comment). Owner may prefer hoisting with a type assertion if the
  IIFE style is surprising; either is correct.
- **`StatRow` empty-state subtitle under the label** — the brief
  said "implementer's call" on placement. I put it below the label
  (left column) rather than the value (right), which keeps the
  right column clean when showing `—`.
- **`largestFill` via `Math.max(...arr)`** — brief §9 item 5
  flagged the theoretical call-stack limit risk on huge arrays.
  At family scale (hundreds of entries) this is safe; no change
  made. Flagged here per the brief's ask.

---

## Deviations from dispatch

None — followed the dispatch as written. All six pre-read polish
items folded in (param naming, `as number` cast comment, format
helper typing, own keyed wrapper, units-trap test magnitudes,
`entriesNewestFirst` naming consistent across all exports).

---

## Files created

- `src/entries/computeStats.ts` — six pure stat helpers
- `src/entries/computeStats.test.ts` — 32 unit tests
- `src/components/StatRow.tsx` — labeled list row component

## Files modified

- `src/screens/LogFillupScreen.tsx` — added imports
  (`expectedRangeBand`, `largestFill`, `longestTank`, `p95Mpg`,
  `StatRow`) and a new stats section below the MPG tiles.

---

## Files NOT touched (confirmed)

- `src/entries/computeMpg.ts` (import-only)
- `src/entries/computeMpg.test.ts`
- `src/entries/useEntries.ts`
- `src/components/MpgTile.tsx`
- `firestore.rules`, `tests/rules/*`
- `PRD.md`, `AGENTS.md`, `BACKLOG.md`, all working-model docs
- All config, `package.json`, `public/*`

---

## Items deferred

**To the next dispatch:** None arising from this work.

**To BACKLOG:** No new items. The pre-existing
`Math.max(...arr)` call-stack note (brief §9 item 5) is already
in scope at family scale and not a new concern.

---

## Expected cost impact

None. All four stat values derive from `entriesState.entries`,
which `useEntries` already fetches. Zero new Firestore reads.

---

## Manual steps for the human owner

1. Open the app in dev (`npm run dev`).
2. Select the Caterham (or any car with ≥5 fill-up records).
3. Verify: Expected range ≈ 230–291 mi, P95 MPG ≈ 35.9 mpg (V2
   parity check vs. the owner's spreadsheet).
4. Verify Longest tank and Largest fill show plausible values.
5. Select a car with fewer than 5 fills: Expected range and P95
   MPG rows should show `—` with "need 5+ fills" subtitle.
6. Switch cars: both the MPG-tiles section and the stats section
   should fade on the switch.

---

## Notes for the next dispatch brief

- The IIFE pattern in `LogFillupScreen` is the chosen mechanism
  for in-branch derivation while preserving TS narrowing. If a
  future dispatch adds more derived values to the same branch,
  it can extend the same IIFE rather than duplicating the pattern.
- The `key={selectedCarId}` on the stats section is its own
  wrapper (not merged with the MPG tiles' `border-t pt-5`
  section). This keeps the two sections visually independent and
  avoids touching the MPG section when the stats section is
  modified. The `animate-fade-in` on both wrappers fires together
  on car switch because both are keyed identically.
- The `MIN_MPG_PAIRS = 5` constant in `computeStats.ts` is the
  single source of truth for the percentile-stats threshold. If
  the owner ever wants to lower or raise it (e.g., to 3 for
  smaller families), one change propagates to both `p95Mpg` and
  `expectedRangeBand`.

---

End of handoff.
