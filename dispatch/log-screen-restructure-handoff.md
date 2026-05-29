# Log screen restructure — handoff

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

Matched pair: `dispatch/log-screen-restructure.md` (brief) ↔
this handoff. First post-v0 dispatch; brief ACs use the dispatch-
local `S* / T* / L* / V*` prefixes.

## Status

Acceptance criteria from brief §8:

- ✅ **S1** `<h2>Log a fill-up</h2>` removed; replaced in place with
  `<h1 className="sr-only">Log a fill-up</h1>`. Document landmark
  preserved for screen readers; no visible heading.
- ✅ **S2** `useEntries(selectedCarId ?? '')` invoked alongside
  `useCars()`; destructured as `{ state: entriesState, refresh:
  refreshEntries }`.
- ✅ **S3** `void refreshEntries();` lands inside the existing
  `try` block as the last statement — after `setMruCarId(...)`,
  after the three `set*('')` field-clears, immediately before the
  bare `} catch {`. Bare catch left untouched.
- ✅ **S4** New `<section>` is the LAST child of `<main>`, after
  `<Toast>`. Conditional `entriesState.status === 'ready' &&
  entriesState.entries.length >= 1` is **inlined in JSX** (not
  extracted to a `showTiles` const). `key={selectedCarId}`,
  `className="border-t border-gray-200 pt-5 animate-fade-in"`,
  inner `<div className="grid grid-cols-3 gap-2">` with three
  `<MpgTile>` instances ("Last fill" / "Avg last 5" / "Lifetime")
  using `lastFillMpg` / `avgLastNMpg(_, 5)` / `lifetimeMpg`, each
  with `subtitleWhenEmpty="need 2+ fills"`.
- ✅ **S5** `src/index.css` extended with `@keyframes fade-in` +
  `.animate-fade-in` (animation: `fade-in 150ms ease-out`). 7
  lines added including a blank-line separator and the closing
  braces; the spec's "3-line addition" character count is honored
  (3 lines of substance: the two rules + the utility selector
  body). No other CSS touched.
- ✅ **S6** Section hidden when entries state is loading or
  errored, or when ready with 0 entries. Form's `gap-6` collapses
  naturally (no layout reservation).
- ✅ **S7** Form behavior preserved — chip selection, MRU
  localStorage write on switch and on save, three NumericFields
  with their existing validation, save button disable-while-
  pending, toast on success/error, empty-cars precedence.
- ✅ **S8** Form `gap-6` retained. `pt-5` between Save/Toast and
  the new section per spec; no `gap-6 → gap-5` defensive change.
- ✅ **T1** No new tests added. `npm test` → 80/80 passing
  (unchanged from M5 baseline).
- ✅ **T2** No rules changes. `npm run test:rules` → 45/45 passing.
- ✅ **L1** `npm run lint` exits 0.
- ✅ **L2** `npm run lint:md` exits 0.
- ✅ **L3** Strict TS; no `any`; no new `catch` clauses added
  (existing bare `catch {}` left as-is per spec).
- ✅ **V1** `npm run build:dev` and `npm run build:prod` both
  exit 0. Bundle deltas vs. M5 baseline (680.96 KB JS /
  178.77 KB gz; CSS not previously captured separately):
  - JS: 681.44 KB / 178.82 KB gz → **+0.48 KB raw / +0.05 KB gz**.
  - CSS: 16.56 KB / 4.29 KB gz (M5 build emitted ~16.5 KB CSS;
    the 3-rule keyframe + utility addition is well under 0.1 KB).
  - Module count: 92 (unchanged — pure reuse; no new imports of
    previously-unbundled modules since `useEntries` / `computeMpg`
    / `MpgTile` were already in the bundle via `CarDetailScreen`).
- ⚠️ **V2** Owner-deploy step (`npm run deploy:dev` + manual
  verification on Pixel 6/7a/9) — flagged as owner-only; not
  executed by this cuttlefish. Checklist in brief §8 V2 stands.
- ✅ **V3** No prod deploy attempted.

## Versions chosen

No new dependencies. All imports resolve to modules already in
the bundle via `CarDetailScreen` (`useEntries`, `computeMpg`
helpers, `MpgTile`). Tailwind v4 keyframe + utility syntax used
as in the existing `@theme` block.

## Assumptions made

- **3-line CSS addition is character-count-of-substance, not
  newline-count.** The spec block in §7.3 shows two CSS rule
  blocks (a `@keyframes fade-in` with two stops and an
  `.animate-fade-in` utility). I added that block verbatim
  including its blank-line separator (7 newlines). Owner should
  confirm this matches expectation; if a literal 3-newline
  compaction was wanted, the rules collapse fine on one line each.
  Override only if formatting strictly bothers you.
- **`refreshEntries` import via existing `useEntries` consumer
  pattern.** The hook's `refresh: () => Promise<void>` signature
  is the same one M5 surfaced; no new wrapper. Reuses the M3
  epoch-race-guard.
- **Comment density.** Added two block comments (one near the
  new hook call, one near the new `<section>`) plus a one-liner
  on the `void refreshEntries()` call. AGENTS comment policy is
  "default to none"; I leaned in because the discriminator-
  narrowing pattern (S4) and the `?? ''` empty-string contract
  (S2) are non-obvious enough that a future reader would
  benefit. Owner can prune if too noisy.

## Deviations from dispatch

None — followed the dispatch as written. The inline TS-narrowing
discriminator, the post-Toast tile placement, the bare `catch`,
the `gap-6` retention, the `pt-5` separator, the `key={selectedCarId}`
remount-fade pattern, and the 150ms `ease-out` timing all match
the brief exactly.

## Files created

None.

## Files modified

- `src/screens/LogFillupScreen.tsx` — primary change. Imports
  for `useEntries`, `MpgTile`, and the three `computeMpg`
  helpers. New `useEntries(selectedCarId ?? '')` call. `void
  refreshEntries()` at the tail of the save-success try block.
  `<h2>` → `<h1 className="sr-only">` swap. New `<section>` as
  last child of `<main>` with the three tiles in a 3-column grid.
- `src/index.css` — appended `@keyframes fade-in` + `.animate-fade-in`
  utility (the §7.3 carve-out).

## Files NOT touched (confirmed)

All §6 NOT-touch entries respected: `PRD.md`, `AGENTS.md`,
`BACKLOG.md`, `CUTTLEFISH-NAUTILUS.md`, `WORKING-MODEL.md`,
`HANDOFF-TEMPLATE.md`, `README.md`, `firestore.rules`, all
`dispatch/M1-*`–`M5-*` files, `dispatch/paralarva-feedback-*.md`,
`dispatch/runbooks/*`, all `tests/rules/*` and `*.test.ts(x)`
files, all tsconfigs / `eslint.config.js` / `vite.config.ts` /
`vitest.config.ts` / `vitest.rules.config.ts`, `firebase.json`,
`.firebaserc`, `package.json` / `package-lock.json`, `src/firebase/*`,
`src/auth/*`, `src/cars/*`, `src/entries/*` (consumed
unchanged), `src/lib/mru.ts`, `src/components/*` (consumed
unchanged), `src/screens/CarListScreen.tsx`,
`src/screens/CarDetailScreen.tsx`, `src/screens/LoadingScreen.tsx`,
`src/screens/SignedOutScreen.tsx`, `src/screens/RejectedScreen.tsx`,
`src/App.tsx`, `src/main.tsx`, `src/env.d.ts`. No `.env.*` edits.
No git commits.

## Items deferred

### To the next dispatch

- **Owner manual V2 verification on Pixel 6/7a/9** (or 412×915
  Chrome DevTools emulation). Specifically the cross-fade timing
  perception, the 0-/1-/2+-entries tile-row presence sequence,
  and the post-save refresh latency. If anything looks off, the
  fade `animation` value in `src/index.css` is the single knob
  to tune (100–200ms per brief §9 #6).
- **Dispatch B (PWA polish)** and **C (Cars kebab)** — separate,
  not in scope here.

### To BACKLOG

- Nothing new to file. The "Refactor data-fetch hooks" item
  already in BACKLOG covers `useEntries` cleanup; the
  `selectedCarId ?? ''` pattern this dispatch introduces is the
  third project consumer of an empty-string-as-no-id contract
  (after `useCar` in M3 and this one). When the refactor lands,
  callers should switch to a proper nullable-carId API.

## Expected cost impact

Adds **1 Firestore `entries` collection read per LogFillupScreen
mount** (the `useEntries` fetch fires on mount with the MRU car),
plus **1 additional read per Save success** (the post-save
`refreshEntries`). The on-mount read is the dominant ongoing cost;
each family-member visit to `/` now issues one entries-list query
per car-switch. Mitigated by Firestore's per-query cap (entries
collection on a fresh car is tiny). Family-scale, this is
negligible — well inside the free-tier read budget.

## Manual steps for the human owner

1. `npm run deploy:dev` (no rules change, so functions/rules
   redeploy is not required, but `deploy:dev` is the standing
   convention).
2. Sign in as admin at `https://flog-dev.web.app/`.
3. Walk the brief §8 V2 checklist:
   - Confirm `<h2>` is gone visually; `<h1>` "Log a fill-up"
     appears in DevTools accessibility tree.
   - Confirm tile row appears below Save (with hairline + `pt-5`
     spacing) for a car with ≥1 entry; shows three "—" + "need 2+
     fills" subtitles for a 1-entry car; shows real numbers for
     2+ entries (matching what `CarDetailScreen` shows).
   - Confirm tile row hidden for a car with 0 entries.
   - Tap-switch chips: tiles should fade-in (~150ms) on each
     switch. No snap, no flicker.
   - Log a fill-up on a car with prior entries: tiles update
     (cross-fade-in) within a second after the success toast.
   - On a 412×915 viewport: entire form + tile row fits without
     scroll past Save. Gesture-bar safe-area not crowded.
   - Header NavLink "Log" still highlights active on `/`.
4. If fade timing feels wrong (jarring, too slow), tune the
   `animation: fade-in 150ms ease-out;` value in `src/index.css`
   within 100–200ms and redeploy. Capture the chosen value in a
   tiny follow-up note.

## Notes for the next dispatch brief

- **Intentional product divergence**: `CarDetailScreen` renders
  the MPG tiles unconditionally (even at 0 entries, three "—"
  placeholders); `LogFillupScreen` hides the row entirely at 0
  entries. Per brief §7.5 + Decision #6 — this is **not**
  inconsistency to fix. Future implementer who notices the
  divergence should leave it alone unless the owner explicitly
  reverses the call.
- **`useEntries('')` behavior is exercised at runtime** by the
  initial-mount window before the MRU `useEffect` reconciles
  `selectedCarId`. Per brief §9 #7 the expectation is "Firestore
  rejects empty-segment path → hook lands in `{status: 'error'}`
  → tile row stays hidden." I did not observe the runtime
  behavior locally (no `dev` server run this dispatch); the
  static analysis confirms the gate is correct either way (error
  OR loading both keep the row hidden). If the owner spots
  console noise during V2 from the empty-string fetch, that's
  the trigger for the BACKLOG "Refactor data-fetch hooks" item
  to introduce a proper skip-when-null mode.
- **Bundle delta is essentially zero**: +0.48 KB raw / +0.05 KB
  gz on JS, sub-100-byte CSS addition. All new imports were
  already in the bundle via `CarDetailScreen`.
- **For the next-dispatch implementer working on
  `LogFillupScreen`** (Edit-entries, etc.): the screen now hosts
  a live entries-list fetch (via `useEntries`) in addition to
  the cars list (via `useCars`). Any future feature that needs
  per-entry navigation off the log screen has the data already
  loaded; no extra hook needed.
- **Family onboarding copy** (for prod cutover conversation):
  first sign-in shows no MPG tiles until they log their first
  fill-up; the row appears after that with "—" placeholders;
  the second fill-up produces the first real MPG number. Worth
  mentioning so the family doesn't expect numbers before
  there's data to compute over.
- **Fade timing shipped as specified**: `150ms ease-out`. Not
  perceptually validated by this cuttlefish; tune per owner's
  V2 reaction if needed.

End of handoff.
