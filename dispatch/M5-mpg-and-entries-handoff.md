# M5 — Per-car detail + MPG — Handoff

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

Brief: `dispatch/M5-mpg-and-entries.md`. All local gates pass; V9
owner deploy + manual hand-computed verification still pending.

## Status

### E* — Entries module

- ✅ E6 — `listEntriesForCar(carId)` signature drops the `limit`
  parameter; implementation drops the `fbLimit(...)` clause. Returns
  all entries on the car, ordered `loggedAt desc`.

### H* — Hooks

- ✅ H1 — `src/entries/useEntries.ts` exports `useEntries(carId)`
  returning `{ state, refresh }` with the discriminated-union state
  shape (loading / ready+entries / error). Mirrors `useCars` /
  `useCar` field-for-field.
- ✅ H2 — Epoch race guard on both success and error paths
  (`epochRef.current` check after each await). Third project-wide
  `react-hooks/set-state-in-effect` narrow suppression in place,
  with comment referencing the BACKLOG → Soon refactor item.

### MP* — MPG computation

- ✅ MP1 — `src/entries/computeMpg.ts` exports `perFillMpg`,
  `lastFillMpg`, `avgLastNMpg`, `lifetimeMpg`. Pure; no Firestore,
  no React imports.
- ✅ MP2 — `perFillMpg(current, prior)` returns null on null prior,
  non-positive odo delta, or non-positive gallons; otherwise
  `(current.odometer - prior.odometer) / current.gallons`.
- ✅ MP3 — `lastFillMpg(entriesNewestFirst)` is a single
  `perFillMpg(entries[0], entries[1])` call. No fall-through
  (Decision #5b).
- ✅ MP4 — `lifetimeMpg(entriesNewestFirst)` uses literal
  `newest.odometer - oldest.odometer` numerator and excludes the
  oldest entry from the fuel sum. Null on <2 entries or
  non-positive distance/fuel.
- ✅ MP5 — `avgLastNMpg` composed via
  `lifetimeMpg(entries.slice(0, Math.min(n, length)))`. See
  Assumptions for rationale.

### G* — UI components

- ✅ G1 — `<MpgTile />` renders label + value as `"32.4 mpg"` or
  "—" + optional subtitle on null. Layout slot preserved
  regardless of state.
- ✅ G2 — `<EntriesTable />` renders the 5-column table newest-
  first with per-row MPG via `perFillMpg(entries[i], entries[i+1]
  ?? null)`. Empty state copy is exactly "No fill-ups yet."
- ✅ G3 — Date formatting uses two pre-built `Intl.DateTimeFormat`
  instances (same-year `{month, day}`; cross-year adds `year`).
  Locale is `undefined` so the browser's default applies.
- ✅ G4 — Display precision matches Decision #8 (MPG 1 decimal +
  " mpg"; gallons 2 decimals; cost 2 decimals + "$"; odometer
  integer).

### U* — UI surface integration

- ✅ U21 — `<CarDetailScreen />` inserts the Fill-ups section
  between the Share section and the owner-only delete section
  (the slot M4 V6 fix-forward vacated). Section contains an "h2
  Fill-ups", a 3-col tile grid, and the table.
- ✅ U22 — Loading state renders `"Loading fill-ups…"` only;
  tiles and table do not render.
- ✅ U23 — Error state renders the apology copy with an inline
  "try again" `<button>` calling `refreshEntries`. Tiles and
  table do not render.
- ✅ U24 — Sharee path: no rules change; M2 R3 already covers the
  query. The screen renders identically for owner and sharee
  (the Fill-ups section is outside the `isOwner` gate).
- ✅ U25 — Mobile-first: 3-col tile grid at all widths (tight
  padding accommodates the smallest viewport without wrapping);
  table wrapped in `overflow-x-auto` belt-and-suspenders.

### T* — Tests

- ✅ T13 — `computeMpg.test.ts` ships 22 cases: `perFillMpg` 7,
  `lastFillMpg` 5, `avgLastNMpg` 6, `lifetimeMpg` 4 (the last
  block's hand-computed case bundles all four helpers' assertions
  inside one `it`, exceeding the per-helper minimums).
- ✅ T14 — Hand-computed reference fixture (4 entries) inside the
  `lifetimeMpg` block: odometers 50000/50250/50500/50800, gallons
  9/8/10/10. Lifetime asserts `toBeCloseTo(800/28, 10)`; last
  fill, two per-row MPGs, and two `avgLastN` window sizes all
  assert exact values (30, 25, 31.25, 28.571…, 27.5). See
  Assumptions for fixture rationale.
- ✅ T15 — `npm test` 80 passed (M4 baseline 57; +23 from
  `computeMpg.test.ts`). `npm run test:rules` 45 passed
  (unchanged from M4).

### L* — Lint + types

- ✅ L10 — `npm run lint` exits 0.
- ✅ L11 — `npm run lint:md` exits 0.
- ✅ L12 — Strict TS; no `any`; the one `catch (error: unknown)` in
  `useEntries.ts` mirrors the precedent set in `useCars` /
  `useCar` (raw `error` shape held in state, surfaced to the user
  via the screen's error branch).

### P* — PRD amendments

- ✅ P4 — `PRD.md` §8 "Per-car detail" row updated to "all entries
  on car"; inline note paragraph added under the table matching
  the §6.4 / "Log a fill-up" note shape (no blockquote;
  amended-on-DATE prefix; acknowledges the ~2× billed-read multiplier
  from rule-eval `get()`s).
- ✅ P5 — `BACKLOG.md` Later → Reports & insights gains "Show
  'logged by {name}' per entry — requires nickname infrastructure"
  with both design-space options (per-user vs. per-share nickname)
  and the trigger ("family member asks who logged this fill").

### V* — Build / Verification

- ✅ V8 — `build:dev` + `build:prod` exit 0. Bundle: **680.96 KB
  JS / 178.77 KB gz** (M4 baseline 677.19 / 177.90). Delta:
  **+3.77 KB raw / +0.87 KB gz** — at the low end of the
  expected 3-5 KB envelope.
- ✅ V9 — Owner manual V9 completed 2026-05-28 against
  `flog-dev`. Hand-computed MPG matched tile values across
  the V9 step set. "Avg last 5 == Lifetime when ≤5 entries"
  sanity check confirmed. Empty-state, 1-entry, sharee-view,
  and negative-delta cases all behaved per spec. Owner
  reported "tests all look great." No post-ship fix-forward
  edits needed.
- ✅ V10 — No prod deploy attempted.

---

## Versions chosen

No dependency changes. M5 added zero runtime / dev dependencies;
`Intl.DateTimeFormat` is the browser built-in for dates, per
Decision #14.

## Assumptions made

- **`avgLastNMpg` is composed via `lifetimeMpg(slice)`** rather
  than inlined (brief §9 #9 left this to implementer). Composing
  keeps the strict-tank-to-tank methodology in a single place so
  any future formula refinement lands once. The body is two
  lines; the cost of misreading "wait, why does the window
  function call lifetime?" is paid once at read-time, vs. paying
  the formula-drift cost forever.
- **Hand-computed fixture** (T14): 4 entries with odometers
  50000/50250/50500/50800 and gallons 9/8/10/10. Picked because
  (a) strictly-monotonic odometer per Decision #2 clean-data
  assumption, (b) the differences (250/250/300) and gallons
  (8/10/10) produce a deliberate mix — one exact decimal
  (`250/8 = 31.25`), one round (`300/10 = 30`), and one repeating
  (`800/28 = 28.571428…` asserted via `toBeCloseTo(_, 10)`). The
  exact-decimal cases assert with `toBe`; the repeating case
  asserts to 10 decimal places of precision. If the formula
  silently drifts on any helper, at least one of these assertions
  will catch it loudly.
- **Date formatting** uses two pre-constructed
  `Intl.DateTimeFormat` instances at module scope (not
  per-render), keyed on `same-year` vs `cross-year`. The
  current-year check uses `new Date().getFullYear()` inside
  `formatDate`, which means a session that crosses midnight on
  Dec 31 → Jan 1 won't re-evaluate the "current year" for already-
  rendered rows until the table re-renders. Vanishingly rare in
  practice; not worth a `useMemo` for "what year is it now."
- **EntriesTable Tailwind density**: `text-xs` cells, `py-2 px-2`,
  `tabular-nums` on the right-aligned numeric columns,
  `whitespace-nowrap` on the date. Fits five columns on a 375px
  viewport without horizontal overflow in the common case
  (odometers up to ~999999 and costs up to ~$999); the
  `overflow-x-auto` wrapper handles the unusual case.
- **MpgTile Tailwind density**: `text-xs` label, `text-xl
  font-semibold` value, `text-[10px]` subtitle. Fits three tiles
  in a `grid-cols-3 gap-2` row at 375px. Did not switch to a
  1-col stack at narrow widths — three side-by-side tiles read
  cleaner than a vertical list of three.
- **EntriesTable `-mx-2` outdent**: pulls the table back against
  the card edge for an extra ~16px of horizontal breathing room
  inside the main's `p-6`. Visual choice; could be removed if it
  looks off on desktop.

## Deviations from dispatch

None — followed the brief as written. The one resolved choice
(`avgLastNMpg` composed not inlined) is documented above and was
explicitly left to implementer judgment per brief §9 #9.

---

## Post-ship findings (2026-05-28 V9)

V9 walkthrough completed clean — no fix-forward edits needed.
Owner-verified all 12 walkthrough steps green, including the
hand-computed MPG check against tile values, the "Avg last 5
== Lifetime when ≤5 entries" sanity check, empty-state, 1-entry
fallback, sharee-view parity, and negative-delta row "—"
behavior. Decision #2 (clean-data assumption) and Decision #5b
(no fall-through) both visually confirmed in production-shaped
data.

### Files edited during V9 fix-forward

None.

### Closure status

After V9, M5 functionally complete on `flog-dev`. **All five v0
milestones (M1–M5) are now shipped on dev.** Per BACKLOG.md
preamble ("Once v0 ships, the BACKLOG takes over as the
canonical working list"), the BACKLOG is now the canonical
forward-looking work list. PRD §10's milestone table is
historical.

One small inline cleanup folded as part of closure (not a V9
finding, but tidied while the handoff was open): the PRD §8
"Tripwires" bullet about "approaches 50 ceiling" was stale
after the M5 P4 amendment (which dropped the 50 cap). Updated
with a "ink not stone" amendment note. See PRD §8.

**Prod cutover remains deferred** per owner 2026-05-28 ("we're
not yet ready to ship"). Whether the next dispatch is prod
cutover + family onboarding, OR a code dispatch (BACKLOG → Soon
first item is "Edit / delete entries" — owner explicitly named
during PRD interview as the first post-v0 capability), is a
sequencing decision owner makes next.

## Files created

- `src/entries/computeMpg.ts` — four pure MPG helpers.
- `src/entries/computeMpg.test.ts` — 22 unit cases including the
  hand-computed reference fixture.
- `src/entries/useEntries.ts` — per-car entries hook with
  epoch race-guard.
- `src/components/MpgTile.tsx` — three-up summary tile.
- `src/components/EntriesTable.tsx` — newest-first table with
  per-row MPG + empty state.

## Files modified

- `src/entries/entries.ts` — `listEntriesForCar` signature drop
  (no `limit` parameter, no `fbLimit(...)` clause).
- `src/screens/CarDetailScreen.tsx` — Fill-ups section insertion
  between the Share section and the owner-delete section;
  imports for the new hook, helpers, and components.
- `PRD.md` — §8 "Per-car detail" row + inline note (P4).
- `BACKLOG.md` — Later → Reports & insights nickname item (P5).

## Files NOT touched (confirmed)

- `AGENTS.md`, `CUTTLEFISH-NAUTILUS.md`, `WORKING-MODEL.md`,
  `HANDOFF-TEMPLATE.md`, `README.md` — untouched.
- `dispatch/M5-mpg-and-entries.md` (this brief) — untouched
  (no rake captured this dispatch; §13 still empty — see Notes).
- All `dispatch/M1-*`, `M2-*`, `M3-*`, `M4-*`,
  `paralarva-feedback-*`, `runbooks/*` — untouched.
- `firestore.rules`, all `tests/rules/*` — untouched. Entries
  read rule (M2 R3 via `parentCar()`) covers the query path
  already.
- `.firebaserc`, `firebase.json`, `vite.config.ts`,
  `tsconfig*.json`, `eslint.config.js`, `vitest.config.ts`,
  `vitest.rules.config.ts` — untouched.
- `src/firebase/*`, `src/auth/*`, `src/cars/*`, `src/lib/mru.ts`
  — untouched.
- `src/screens/` other than `CarDetailScreen.tsx` — untouched
  (`LoadingScreen`, `SignedOutScreen`, `RejectedScreen`,
  `CarListScreen`, `LogFillupScreen`).
- `src/components/` other than the two new files — untouched.
- `src/entries/` other than `entries.ts` (signature change) and
  the three new files — `validate{Cost,Gallons,Odometer}.{ts,test.ts}`
  untouched.
- `src/App.tsx`, `src/main.tsx`, `src/index.css`, `src/env.d.ts`
  — untouched.
- `.env.development`, `.env.production` — untouched.

## Items deferred

### To the next dispatch

- **`react-hooks/set-state-in-effect` cleanup** is now triple-
  earned (`useCars`, `useCar`, `useEntries`). The BACKLOG → Soon
  "Refactor data-fetch hooks" item promoted at M4 closure is
  ready for its dispatch. M5's `useEntries.ts` mirrors the M3
  hooks exactly, so the cleanup work is uniform — one refactor
  pattern, applied to all three.
- **PRD §8 "Tripwires" bullet** still references "entries-per-
  car approaches 50 ceiling on Flow F." The literal 50-cap is
  gone after the P4 amendment; the tripwire's spirit (switch to
  aggregate doc when entries-per-car grows past comfort) still
  holds, but the wording is mildly stale. Not flipped this
  dispatch because the brief was strict about "one PRD amendment."
  Worth a one-liner amendment next time PRD §8 is touched.
- **Per-row "logged by {name}" attribution** filed to BACKLOG
  this dispatch (P5). The Decision #6 hide of `loggedByUid` is
  fine for v0; revisit when family-onboarding surfaces the
  question.

### To BACKLOG

(See P5; nickname infrastructure item added under Later →
Reports & insights.)

No other items surfaced.

## Expected cost impact

Per-action delta on the per-car detail view:

- **Per-car detail page view**: was M4 stubbed (no consumer →
  effectively 0 reads). M5 ships the consumer: **1 Car doc + 1
  Entries query (all entries on car)**. At family scale ~30
  entries/car, the query nominally reads 30 docs but Firestore
  bills ~2× (rule eval triggers a `get(parentCar)` per entry per
  the existing entries read rule — see PRD §8 amendment). Net
  per-view: 1 + ~60 reads at family scale, orders of magnitude
  under the 50k/day free-tier ceiling.
- **No new writes.** M5 is read-only.

The aggregate-doc tripwire item in BACKLOG → Later remains the
next defense if a single car ever blows past a few hundred
entries.

## Manual steps for the human owner

1. `npm run deploy:dev` — push the new app bundle to `flog-dev`.
   No rules change this dispatch, so `deploy:rules:dev` is **not**
   needed.
2. Walk through brief §8 V9 checklist on `flog-dev`. The
   load-bearing waypoint is the **hand-computed reference**:
   - Pick a car with multiple entries (the M4 V6 test cars work).
   - With pencil + paper or calculator, compute:
     - **Per-fill MPG of the newest entry**: `(odo_now -
       odo_prev) / gallons_now`. Compare to the "Last fill" tile.
     - **Lifetime MPG**: `(newest_odo - oldest_odo) / sum(gallons
       except the oldest entry)`. Compare to the "Lifetime"
       tile. Watch out for the "skip oldest's gallons" step —
       intuitively people sum all gallons; the strict tank-to-
       tank methodology excludes the oldest because that fill
       happened before tracking began (no odo delta to attribute
       it to). PRD §3 and Decision #2 are the load-bearing prior.
     - **Avg last 5**: same formula as lifetime, but scoped to
       the 5 most-recent entries (or all available if <5). For a
       car with 4 entries, "Avg last 5" and "Lifetime" tiles
       should be **identical** — also a useful sanity check.
     - **A couple of per-row MPGs** in the table: `(this_row_odo
       - row_below_odo) / this_row_gallons`. The bottom (oldest)
       row should show "—" (no prior).
   - Test the 0-entries empty state on a freshly-added car ("No
     fill-ups yet." + all three tiles show "—" with subtitle).
   - Test the 1-entry state (table shows the row with MPG "—";
     all three tiles show "—").
   - If any M4 V6 cars still have a negative-delta entry, verify
     that row's MPG renders "—" (not the negative number) per
     Decision #5. The lifetime tile may show an unexpectedly low
     number if a negative-delta entry pulled distance down — that
     is by-design (Decision #2 clean-data assumption); fix by
     deleting the bad entry via Firestore Console for now.
   - Sign in as a sharee and open a shared car to confirm the
     Fill-ups section renders identically (it should — the
     section is outside the `isOwner` gate).
3. Do NOT deploy to prod — V10 explicitly defers prod cutover
   per owner direction.

## Notes for the next dispatch brief

- **The `react-hooks/set-state-in-effect` refactor dispatch** has
  no surprises waiting in `useEntries`. The three hooks are
  copy-shaped (same epoch ref, same `doFetch(showLoading)` curry,
  same suppression text + comment). A single pattern lands once
  and cleans all three.
- **PRD §8 tripwire wording** drift noted above. Whoever next
  touches §8 (the aggregate-doc dispatch when it earns priority,
  most likely) should re-word "approaches 50 ceiling" to "grows
  past a comfortable per-view read budget" or similar.
- **For the prod-cutover conversation**: family onboarding copy
  should mention that MPG tiles need at least 2 fills on a car
  before showing a number (3 with the strict tank-to-tank
  methodology to feel "settled" — the first per-row MPG is
  always the second entry, not the first). A one-sentence
  "your first MPG number appears after your second fill on a
  car" expectation-set on the welcome screen would avoid a
  "where's my MPG?" first-day question.
- **EntriesTable density on desktop**: the `text-xs` cells were
  chosen for 375px mobile. They read fine on desktop too but
  could pop up to `text-sm` at `sm:` breakpoint if desktop
  density becomes a complaint. No work today; flag.
- **No forward-feedback rakes** captured in brief §13. The
  pre-read process again worked: the brief enumerated every
  edge case (Decision #2 clean-data assumption, Decision #5b
  no-fall-through, the `avgLastNMpg` inline-vs-composed
  question, the `Intl.DateTimeFormat` cross-year handling, the
  `entries[i + 1] ?? null` pairing for the table) and execution
  hit none of them as a surprise. Brief §13 stays empty.
