# Log screen restructure — MPG tiles at the bottom

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

**Status**: draft — pending pre-read by reviewer cuttlefish (per
WORKING-MODEL §3) before implementer dispatch.

---

## 1. Context

This is the first post-v0-codebase dispatch (M1–M5 all shipped on
`flog-dev` 2026-05-28; prod cutover deferred). The dominant
user-facing surface is `LogFillupScreen` at `/` — the screen the
family interacts with at the pump for every fill-up. M4 shipped
the form; M5 shipped MPG tiles on `CarDetailScreen`. Owner observed
during V9 that the MPG numbers are interesting enough to want on
the log screen too, so the family sees their fuel-economy signal
on the surface they're already on.

A UI-design cuttlefish produced a design recommendation
2026-05-29 (memo in chat history, not on disk). Owner approved the
recommendation with minor adjustments. This brief translates the
approved design into ACs.

What this dispatch does:

- Drops the visible "Log a fill-up" `<h2>` title; replaces with an
  `<h1 class="sr-only">` so the document landmark survives.
- Adds a Fill-ups tile row below the Save button — three reused
  `<MpgTile />` components computing Last fill / Avg last 5 /
  Lifetime over the **currently-selected car's** entries.
- Hairline separator (`border-t`) + `pt-5` between Save and the
  tile row so the visual rhythm reads as "do (form) → look (tiles)"
  rather than competing with the CTA.
- Cross-fade (150ms) on tile values when the user switches the
  selected car via the chip row.
- Tile row hidden entirely when the selected car has zero entries
  (no MPG signal to communicate; suppresses noise for brand-new
  cars).
- Refetch entries after a successful Save so the tiles reflect the
  just-saved entry.

What this dispatch does NOT do:

- No PWA polish / manifest / icons — separate B dispatch.
- No Cars-screen kebab menu — separate C dispatch.
- No PRD amendments expected.
- No `firestore.rules` changes (entries READ rule already permits
  the query the log screen will now issue).
- No new components, hooks, modules — pure reuse of M4/M5
  primitives (`MpgTile`, `useEntries`, `computeMpg.ts`).

**Target devices** (per owner 2026-05-29): Pixel 6, Pixel 7a,
Pixel 9. All ≈ 412 × 915 CSS px on Chrome for Android. Worst-case
375×667 sizing constraints from the design memo **do not apply**.
The cuttlefish's `gap-6 → gap-5` defensive recommendation is
NOT adopted; keep `gap-6` everywhere as-shipped.

---

## 2. Required reading

In order:

1. `PRD.md` §1.1 (goals — MPG insight on per-car view), §1.2
   (no analytics; no third-party scripts), §2 (target user),
   §7 Flow C (log a fill-up; the dominant surface), §9 (UI
   requirements — mobile-first, ≥44pt tap targets, "Desktop
   works but is not the design center").
2. `AGENTS.md` — full read. Especially the no-`any` /
   no-real-time-listeners / no-external-state-library /
   no-analytics guardrails.
3. `WORKING-MODEL.md` §3 (pre-read), §5 (operational
   conventions), §6 (antipatterns).
4. `HANDOFF-TEMPLATE.md` for the handoff doc shape.
5. `dispatch/M5-mpg-and-entries-handoff.md` — the most-recent
   handoff; especially the `useEntries` hook semantics + the
   MpgTile / computeMpg APIs that this dispatch reuses.
6. `dispatch/M4-entries-handoff.md` — current LogFillupScreen
   shape; this dispatch modifies that file.

---

## 3. Scope

### In scope

- **`src/screens/LogFillupScreen.tsx` modification**:
  - Drop the visible `<h2>` title.
  - Add `<h1 className="sr-only">Log a fill-up</h1>` for the
    document landmark.
  - Wire `const { state: entriesState } = useEntries(selectedCarId
    ?? '')` alongside the existing `useCars()` call.
    Capture `refresh` too — see save-flow change below.
  - After the existing Save flow succeeds, call
    `entriesRefresh()` (alongside the existing form-reset).
    Refetch the entries so the tile values update with the
    just-saved entry. Owner explicitly preferred refetch over
    optimistic-append (more correct; latency cost is fine).
  - Below the existing Save button, add a `<section>`:
    - `border-t border-gray-200 pt-5` (hairline + spacing)
    - Three `<MpgTile />` instances in a `grid grid-cols-3 gap-2`
      row: "Last fill" / "Avg last 5" / "Lifetime"
    - Values from `lastFillMpg(entries)`, `avgLastNMpg(entries,
      5)`, `lifetimeMpg(entries)` — all from existing
      `src/entries/computeMpg.ts`
    - `subtitleWhenEmpty="need 2+ fills"` on each (matches
      CarDetailScreen)
  - The tile row renders ONLY when
    `entriesState.status === 'ready' && entriesState.entries.length >= 1`.
    Hide entirely otherwise (no skeleton, no loading text, no
    "—" placeholder — the form above is the action; tiles are
    reference-info that doesn't earn screen real estate until
    there's data).
  - The tile-row outer wrapper gets `key={selectedCarId}` so
    React unmounts + remounts the row when the user switches
    cars. Apply Tailwind `animate-fade-in` OR an inline
    `transition-opacity duration-150` with `opacity-0` →
    `opacity-100` mount transition. Net effect: tile values
    fade in on car switch instead of snapping. Simpler than a
    true cross-fade; visually equivalent at 150ms.
- Form gap (`gap-6`), chip row, three numeric fields, and Save
  button: **unchanged**. Owner explicitly called these out as
  keepers.
- Header: unchanged.

### Out of scope (defer)

- PWA polish / manifest / icons — separate dispatch (B).
- Cars-screen kebab menu — separate dispatch (C).
- Edit/delete entries, CSV import — separate dispatches.
- Charts / trends / cross-car aggregates — BACKLOG → Later.
- Dark mode — BACKLOG → Later.
- Modal focus-trap / ARIA pass — BACKLOG → Later.
- Optimistic-append save flow — explicitly rejected in favor of
  refetch (owner call 2026-05-29).
- True cross-fade with state-machine choreography — keyed
  fade-in suffices at 150ms.
- Loading skeleton for tiles during initial mount or refresh —
  hide-while-loading is the chosen UX.

---

## 4. Decisions locked in (from design conversation 2026-05-29)

These are settled. Implementer treats as fixed unless flagged
stop-and-ask.

1. **Drop visible title; add `sr-only` `<h1>`.** Owner-confirmed.
2. **Tiles below Save, hairline separator.** Owner accepted the
   cuttlefish's "do → look" rhythm argument.
3. **Tiles compute over the currently-selected car only.** Same
   per-car semantic as CarDetailScreen.
4. **Cross-fade on car switch via key-based remount + 150ms
   opacity transition.** Owner-confirmed (Q3 "crossfade").
5. **Refetch on save** (not optimistic-append). Owner-confirmed
   (Q3 "refetch").
6. **Tile row hidden when 0 entries on selected car.** Hides
   completely; no skeleton, no "—" placeholder. Owner accepted
   the cuttlefish's onboarding-noise argument; M5 brief §11
   "Empty entries-list state" lesson reinforces (legit
   context-specific empty states are OK; reference tiles for a
   brand-new car with no fills are not).
7. **Tile row hidden during loading state.** Same posture —
   no transient skeleton; the row appears once data is ready
   AND entries exist.
8. **Tile values use the same `subtitleWhenEmpty="need 2+ fills"`
   shown on CarDetailScreen** when ≥1 entry but the relevant
   MPG can't be computed (e.g., 1-entry car shows the row but
   all three tiles say "—" + "need 2+ fills" subtitle).
9. **Pixel-only family (Pixel 6 / 7a / 9 ≈ 412×915 CSS px)**
   means we don't fight for vertical space. Keep `gap-6`. The
   cuttlefish's defensive `gap-6 → gap-5` recommendation is
   NOT adopted.
10. **Pure-reuse of M5 components**: `MpgTile`, `useEntries`,
    `computeMpg.ts`. No new components, no new hooks, no new
    modules. The dispatch is a single-file modification to
    `LogFillupScreen.tsx`.
11. **Fade-in via CSS keyframe in `src/index.css`** (Option B
    per §7.3). 3-line addition, authorized exception to §6
    NOT-touch on `index.css`. Reusable; no React state needed.
12. **No new dependencies.** No animation library; CSS
    keyframe + React `key` prop suffice.
13. **Pre-read required** (WORKING-MODEL §3; M-sized work bar
    is generous since this is genuinely smaller than M2-M5).

---

## 5. Files in play

```text
flog/
└── src/
    ├── screens/
    │   └── LogFillupScreen.tsx     (modified — primary)
    └── index.css                   (modified — 3-line fade-in CSS)
```

Two files. LogFillupScreen.tsx is the substantive change; index.css
gets a 3-line keyframe-and-utility addition (Decision #11 + §7.3 +
NOT-touch carve-out in §6).

This handoff at `dispatch/log-screen-restructure-handoff.md`
written at the end. Brief §13 forward-feedback populated by
the implementer if rakes surface.

---

## 6. Files NOT to touch

- `PRD.md` (no amendments this dispatch)
- `AGENTS.md`
- `BACKLOG.md`
- `CUTTLEFISH-NAUTILUS.md`
- `WORKING-MODEL.md`
- `HANDOFF-TEMPLATE.md`
- `README.md`
- `firestore.rules` (entries READ rule already permits the query)
- All `dispatch/M1-*`, `dispatch/M2-*`, `dispatch/M3-*`,
  `dispatch/M4-*`, `dispatch/M5-*` files — closed records.
- `dispatch/paralarva-feedback-*.md` — closed.
- `dispatch/runbooks/gcp-firebase-env-setup.md` — closed.
- All `tests/rules/*` files — no rules change.
- All `*.test.ts` / `*.test.tsx` files — no test changes
  expected. The change is a visual recomposition that reuses
  unit-tested primitives (`computeMpg` helpers tested in M5;
  `useEntries` hook tested via M5 V9 manual test). If you find
  yourself wanting a new unit test, surface — AGENTS testing
  posture is "component / integration tests deferred until a
  real regression slips through manual review."
- `.firebaserc`, `firebase.json`, `vite.config.ts`,
  `tsconfig.app.json`, `tsconfig.node.json`,
  `tsconfig.test.json`, `tsconfig.json`, `eslint.config.js`,
  `vitest.config.ts`, `vitest.rules.config.ts`.
- `package.json` — no new dependencies.
- `src/firebase/*` — closed.
- `src/auth/*` — closed.
- `src/cars/*` — closed.
- `src/entries/*` — all M4/M5-shipped; this dispatch consumes
  the existing exports unchanged.
- `src/lib/mru.ts` — closed.
- `src/components/*` — `MpgTile`, `EntriesTable`,
  `CarPickerChips`, `NumericField`, `Header`, etc. all
  consumed unchanged. No new components.
- `src/screens/CarListScreen.tsx`, `CarDetailScreen.tsx`,
  `LoadingScreen.tsx`, `SignedOutScreen.tsx`,
  `RejectedScreen.tsx` — unchanged.
- `src/App.tsx`, `src/main.tsx`, `src/env.d.ts` — no changes.

**One intentional exception**, documented in §7.3 and
Decision #11:

- `src/index.css` — append a 3-line `@keyframes fade-in` +
  `.animate-fade-in` utility after the existing `@theme` block.
  Per §7.3, this is the cleaner of the two fade-in implementation
  paths and consistent with the file's existing M2 content.
- `.env.development`, `.env.production` — no new vars.

---

## 7. Architecture sketch

### 7.1 Current LogFillupScreen shape (M4 baseline, verified against actual file)

```tsx
// Verified shape — `<main>` IS the flex column directly (no inner div).
// `<Toast>` is the LAST child after `<button>`. Early-return branches
// (loading / error / no-cars) live before this happy-path return.
export function LogFillupScreen() {
  const { state, refresh } = useCars();              // carsState
  const [selectedCarId, setSelectedCarId] = useState<string | null>(...);
  // ... form field state, validation, save handler ...

  if (state.status === 'loading') return <main>Loading cars…</main>;
  if (state.status === 'error') return <main>Couldn't load… retry</main>;
  if (state.cars.length === 0) return <main>You don't have any cars yet… Add a car →</main>;

  return (
    <main className="p-6 max-w-md mx-auto w-full flex flex-col gap-6">
      <h2 className="text-xl font-semibold">Log a fill-up</h2>
      <CarPickerChips ... />
      <NumericField label="Odometer (mi)" ... />
      <NumericField label="Gallons" ... />
      <NumericField label="Cost ($)" ... />
      <button onClick={() => void handleSave()}>{saving ? 'Saving…' : 'Save'}</button>
      <Toast state={toast} onDismiss={() => setToast(null)} />
    </main>
  );
}
```

### 7.2 New LogFillupScreen shape (post-this-dispatch)

```tsx
import { useEntries } from '../entries/useEntries';
import {
  lastFillMpg,
  avgLastNMpg,
  lifetimeMpg,
} from '../entries/computeMpg';
import { MpgTile } from '../components/MpgTile';

export function LogFillupScreen() {
  const { state, refresh } = useCars();
  const [selectedCarId, setSelectedCarId] = useState<string | null>(...);
  // NEW: useEntries called unconditionally at component top.
  // When selectedCarId is null (initial mount, pre-MRU-effect),
  // we call useEntries(''). Firestore rejects empty-segment paths
  // → useEntries lands in {status: 'error'}, which the `showTiles`
  // gate hides cleanly. The hook is also called during the early-
  // return loading/error/no-cars branches — same outcome (tiles
  // aren't rendered in those branches anyway).
  const { state: entriesState, refresh: refreshEntries } = useEntries(
    selectedCarId ?? ''
  );
  // ... form field state, validation ...

  async function handleSave() {
    setSaving(true);
    try {
      // ... existing save logic (createEntry, MRU update, form-reset) ...
      void refreshEntries();  // NEW: inside try, after form-reset,
                              // before the try block closes. Fire-and-
                              // forget; tile updates async ~one read
                              // latency later.
    } catch {
      // ... existing error toast (file uses bare `catch {}` —
      //     no err parameter; leave it that way) ...
    } finally {
      setSaving(false);
    }
  }

  // Early-return branches (loading / error / no-cars) unchanged.
  if (state.status === 'loading') return <main>Loading cars…</main>;
  if (state.status === 'error') return <main>Couldn't load…</main>;
  if (state.cars.length === 0) return <main>Add a car first…</main>;

  return (
    <main className="p-6 max-w-md mx-auto w-full flex flex-col gap-6">
      {/* CHANGED: h2 → sr-only h1; same DOM position. */}
      <h1 className="sr-only">Log a fill-up</h1>

      <CarPickerChips ... />
      <NumericField label="Odometer (mi)" ... />
      <NumericField label="Gallons" ... />
      <NumericField label="Cost ($)" ... />
      <button onClick={() => void handleSave()}>{saving ? 'Saving…' : 'Save'}</button>

      {/* Toast keeps its position — sits between Save and the new
          tile section. If it has fixed positioning internally that's
          fine; if it's in-flow, the new tile section follows it as a
          sibling. */}
      <Toast state={toast} onDismiss={() => setToast(null)} />

      {/* NEW: tile section as the LAST child of main. Inside the
          discriminator narrowing so TypeScript accepts
          entriesState.entries access. */}
      {entriesState.status === 'ready' && entriesState.entries.length >= 1 && (
        <section
          key={selectedCarId}
          className="border-t border-gray-200 pt-5 animate-fade-in"
        >
          <div className="grid grid-cols-3 gap-2">
            <MpgTile
              label="Last fill"
              value={lastFillMpg(entriesState.entries)}
              subtitleWhenEmpty="need 2+ fills"
            />
            <MpgTile
              label="Avg last 5"
              value={avgLastNMpg(entriesState.entries, 5)}
              subtitleWhenEmpty="need 2+ fills"
            />
            <MpgTile
              label="Lifetime"
              value={lifetimeMpg(entriesState.entries)}
              subtitleWhenEmpty="need 2+ fills"
            />
          </div>
        </section>
      )}
    </main>
  );
}
```

**Critical TS-narrowing note**: The conditional inlines
`entriesState.status === 'ready' && entriesState.entries.length >= 1`
directly in the JSX expression — NOT via a `const showTiles = ...`
extracted variable. TypeScript's control-flow narrowing only
propagates through inline checks; an extracted `const` loses the
type narrowing on subsequent uses of `entriesState.entries`. The
implementer will hit a TS error if they try to extract `showTiles`
as a const; either inline (as above) or destructure inside an IIFE.

### 7.3 Fade-in implementation — Option B (CSS keyframe), pre-specified

Tailwind v4 doesn't ship an `animate-fade-in` utility by
default. **Use Option B**: add a keyframe + utility class to
`src/index.css` (which already has a `@theme {}` block from M2's
accent setup — adding fade-in there is consistent with file
structure). Exact addition:

```css
/* Append to src/index.css after the existing @theme block: */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.animate-fade-in {
  animation: fade-in 150ms ease-out;
}
```

3 lines + a blank-line separator. The `<section key={selectedCarId}
className="... animate-fade-in">` then fires this animation on
each mount (which happens on each car switch via the key change).

**This requires editing `src/index.css`** which is otherwise on
the NOT-touch list (see §6). The exception is authorized by this
brief and §4 Decision #11 — bounded 3-line addition, file-format-
consistent with existing M2 content, reusable for any future fade
needs.

Option A (inline `useState` + `opacity-0` → `opacity-100` toggle
on mount) was considered and rejected: the keyframe approach is
more idiomatic, doesn't need component state, and avoids the
class-collision risk that the original §7.2 pseudocode's
`opacity-0 animate-fade-in-100` mix would have produced.

### 7.4 Save-flow refresh semantics

The existing M4 save handler is fire-and-forget for the form
state (resets fields on success). The new refresh-entries call
is also fire-and-forget — we don't `await` it before clearing
the form. Rationale:

- The form clears immediately on success (the user wants to
  log another fill, not wait for tile refresh).
- The tile refresh happens asynchronously; the tile values
  cross-fade-in when the new data arrives (~one Firestore
  read latency, ~100-300ms on family-network).
- If the refresh fails (network drop), the tiles show the
  pre-save values; user re-tries Save next fill-up and the
  refresh catches up.

This is the same epoch-race-guarded pattern `useEntries`
already implements. No new logic needed.

### 7.5 Divergence from `<CarDetailScreen />` tile rendering

`CarDetailScreen` renders the three MpgTiles unconditionally
(within its `ready` branch) — even at 0 entries on the car,
where all three tiles show "—" + "need 2+ fills" subtitle.
`LogFillupScreen` **diverges**: tile row hides entirely at 0
entries (per Decision #6).

Justification: on CarDetailScreen, the tiles ARE the point of
the screen — empty state is legitimate empty-state content. On
LogFillupScreen, the tiles are reference info next to the
dominant action (logging). A brand-new car with no fills has no
MPG signal to communicate, and three "—" placeholders for a
user who hasn't logged anything yet is noise without payoff.
First fill flips the row visible (with "—" tiles + subtitles —
because per-fill MPG needs 2+ fills). Second fill produces real
numbers.

This is intentional product divergence, not implementer error.
Note in the handoff so a future implementer doesn't "fix the
inconsistency" by making both screens behave identically.

### 7.6 Empty-state coordination

LogFillupScreen already has an "empty-cars" state (M4 AC U16:
"You don't have any cars yet." with link to `/cars`). That
state takes precedence — the user has no car to log against;
showing tiles for nothing is incoherent. The implementation
naturally handles this: if `carsState.status !== 'ready'` or
`carsState.cars.length === 0`, the existing empty state
renders and the form (including the tile row) doesn't render
at all. No special case needed.

For a car with 0 entries: the form renders, `useEntries`
fetches successfully and returns `entries: []`, `showTiles`
evaluates false, tile row is hidden. User logs first fill;
`refreshEntries` re-fetches, `entries: [entry]`, `showTiles`
flips true, tile row appears with "—" + "need 2+ fills"
subtitle in each tile (the first-fill case where per-fill MPG
can't be computed because there's no prior pair). Second
fill-up → all three tiles light up with real numbers.

This is the intended UX progression: brand-new car shows no
tiles; first fill makes the row appear (acknowledges the log);
second fill produces the first MPG number.

---

## 8. Acceptance criteria

Numbered by subsection. Continuing past M5's prefixes; this
dispatch is the first post-v0 work, so the prefixes restart
from 1 with a dispatch-local namespace (the BACKLOG-takes-over
transition per BACKLOG.md preamble). Implementer references
ACs as `S1`, `T1`, etc. without a milestone prefix.

### S* — Screen modification

- **S1** Visible `<h2>Log a fill-up</h2>` is removed from
  `LogFillupScreen.tsx`. An `<h1 className="sr-only">Log a
  fill-up</h1>` is added in its place (at the same DOM
  position) to preserve the document landmark for screen
  readers and the accessibility tree.
- **S2** `useEntries(selectedCarId ?? '')` is invoked in
  `LogFillupScreen` alongside the existing `useCars()` call.
  The returned `state` and `refresh` are both captured (the
  latter named `refreshEntries` to avoid colliding with any
  existing variable).
- **S3** The existing Save handler calls `void
  refreshEntries()` **inside the `try` block, as the last
  statement before the closing `}`**. Specifically: the
  existing handler's success path runs in order —
  `setMruCarId(selectedCarId)` first, then the three field-
  clear `setOdometer('')` / `setGallons('')` / `setCost('')`
  calls. Insert `void refreshEntries();` AFTER all of those,
  immediately before the existing `} catch {` block. NOT in
  `finally` (refresh should only fire on save success). NOT
  after the `try` block (same reason). The refresh is
  fire-and-forget (`void`); we don't `await` it so the form
  remains responsive. Note: the existing `catch` clause is
  bare (`catch {}`, no parameter) — leave it that way.
- **S4** A new `<section>` is rendered as the **last child of
  `<main>`** (after the existing `<Toast>` element), conditional
  on `entriesState.status === 'ready' && entriesState.entries.length >= 1`.
  **The conditional is inlined directly in the JSX** (not
  extracted to a `const showTiles` — extracting breaks TypeScript
  discriminator narrowing on subsequent `entriesState.entries`
  access). The section has:
  - `key={selectedCarId}` to force remount on car switch
  - `className="border-t border-gray-200 pt-5 animate-fade-in"`
    — hairline separator + spacing + CSS keyframe animation
  - Inner `<div className="grid grid-cols-3 gap-2">` with three
    `<MpgTile />` instances:
    - `label="Last fill"`,
      `value={lastFillMpg(entriesState.entries)}`,
      `subtitleWhenEmpty="need 2+ fills"`
    - `label="Avg last 5"`,
      `value={avgLastNMpg(entriesState.entries, 5)}`,
      `subtitleWhenEmpty="need 2+ fills"`
    - `label="Lifetime"`,
      `value={lifetimeMpg(entriesState.entries)}`,
      `subtitleWhenEmpty="need 2+ fills"`
- **S5** `src/index.css` is appended with the 3-line keyframe +
  utility from §7.3. The `<section>`'s `animate-fade-in` class
  fires the keyframe on each mount (which happens on car switch
  via the key change). 150ms ease-out.
- **S6** Section is hidden entirely (no skeleton, no
  placeholder) when state is loading or entries are empty.
  No layout reservation; the form's `gap-6` collapses
  naturally when there's no tile section.
- **S7** Existing form behavior preserved unchanged: chip
  selection updates `selectedCarId`; the three NumericFields
  retain their values across keystrokes and clear on
  successful Save; Save button disabled-while-pending; toast
  on success/error; MRU localStorage update on car switch and
  on Save; empty-cars state ("Add a car first" with `/cars`
  link) takes precedence over the form when no cars exist.
- **S8** Form `gap-6` retained (NOT reduced to `gap-5`
  despite cuttlefish memo). Target devices Pixel 6/7a/9 ≈
  412×915 CSS px; vertical space is generous.

### T* — Tests

- **T1** No new tests added. Existing `npm test` suite
  (computeMpg tests from M5, validateOdometer/Gallons/Cost
  from M4, canonicalEmail from M2) continues to pass
  unchanged.
- **T2** No new rules tests. `npm run test:rules` passes
  unchanged (45 tests).

### L* — Lint + types

- **L1** `npm run lint` exits 0.
- **L2** `npm run lint:md` exits 0.
- **L3** Strict TS; no `any`; catch clauses (if any added)
  use `unknown` + type guards (none expected this dispatch).

### V* — Build / Verification

- **V1** `npm run build:dev` and `npm run build:prod` exit 0.
  Bundle delta captured in handoff. Expected: tiny (~1-2 KB
  raw / < 1 KB gz — just an additional hook invocation, three
  `MpgTile` renders, and the conditional section JSX; no new
  imports of unimported modules since `useEntries`,
  `computeMpg`, and `MpgTile` are all already in the bundle
  via `CarDetailScreen`'s use).
- **V2** Owner manual test (post-deploy to `flog-dev`; no
  rules change, so `npm run deploy:dev` alone suffices):
  - Sign in as admin → land on `/` (LogFillupScreen).
  - Verify the visible "Log a fill-up" `<h2>` is gone.
  - Open DevTools → Accessibility tree (or browser's
    screen-reader sim) → confirm the `<h1>` "Log a fill-up"
    landmark is present in the document outline.
  - With a car selected that has 2+ fills from M4/M5 V9
    testing: verify three tiles appear below Save with the
    same numbers `CarDetailScreen` shows for that car.
  - Tap a different car chip: verify tile values fade in
    (150ms) with the new car's numbers. No snap, no flicker.
  - Tap a car with 0 entries: verify NO tile row appears.
  - Tap a car with exactly 1 entry: verify tile row appears
    with three "—" + "need 2+ fills" subtitles.
  - Log a new fill-up on a car with existing entries: verify
    tiles update (cross-fade-in via the key-or-refresh
    mechanism) within a second or two of the success toast.
  - On a 412×915 viewport (Chrome DevTools device emulation,
    or actual Pixel device): verify entire log-screen content
    fits without scroll past Save. Tile row sits comfortably
    below; gesture-bar safe-area not crowded.
  - Header active state on "/" still reads as Log
    (NavLink behavior unchanged).
- **V3** No prod deploy attempted.

---

## 9. Stop and ask

Pause and surface before:

1. **Adding any new dependency**. None expected. AGENTS
   guardrail.
2. **Any schema change** to Car / Entry / User / Allowlist.
   None expected.
3. **Any `firestore.rules` change**. None expected — the
   entries READ rule already permits the query
   `useEntries` issues (verified across M5 V9).
4. **Adding component or unit tests** for the new screen
   composition. AGENTS posture defers component-integration
   tests; this dispatch is pure reuse of already-tested
   primitives. If you find a logic split that genuinely
   warrants a unit test (unlikely for this scope), surface
   first.
5. **Editing `src/index.css` beyond the 3-line addition**
   spec'd in §7.3. The carve-out authorizes the keyframe +
   utility specifically; any other CSS additions need a
   stop-and-ask.
6. **Cross-fade timing feels wrong** during your local dev
   test (jarring, too slow, perceptibly different from "no
   animation"). 150ms is a starting point; implementer can
   tune within 100-200ms if it looks better. Surface the
   tuned value in the handoff. If tuning, edit the CSS
   `animation: fade-in {VALUE}ms ease-out;` not the JSX class.
7. **`useEntries(selectedCarId ?? '')` empty-string behavior
   has been verified by pre-read**: empty carId → Firestore
   rejects empty path segment → hook lands in
   `{status: 'error'}` → `showTiles` condition is false →
   tile row hides cleanly. This is the intended behavior; no
   guard needed. **Surface only if you observe different
   behavior** (e.g., the hook actually crashes the screen,
   or floods the console with errors enough to be noisy
   during normal use).
8. **`<Toast>` placement** — current shape keeps Toast above
   the new tile section. If you observe layout jumps when
   Toast appears mid-action (Toast is in-flow, not portal),
   that's a pre-existing M4 layout issue, not something this
   dispatch introduces — surface in handoff but don't fix in
   this dispatch's scope.
9. **TS narrowing extraction temptation** — if you try to
   extract `const showTiles = entriesState.status === 'ready'
   && entriesState.entries.length >= 1` and use
   `entriesState.entries` outside the original expression,
   TypeScript will error. The brief specifies inline; honor
   the inline pattern.

---

## 10. Dependencies expected

No new runtime or dev dependencies. The dispatch consumes
existing modules:

- `react`, `react-router` — already installed.
- `firebase` — already installed (transitively, via
  `useEntries`).
- `src/entries/useEntries.ts`, `src/entries/computeMpg.ts`,
  `src/components/MpgTile.tsx` — all M5-shipped.

---

## 11. Handoff guidance

Implementer writes
`dispatch/log-screen-restructure-handoff.md` per
`HANDOFF-TEMPLATE.md`. Required sections (template): Status,
Versions chosen (likely "no changes"), Assumptions made,
Deviations from dispatch, Files created, Files NOT touched
(confirmed), Items deferred, Expected cost impact, Manual
steps for the human owner, Notes for the next dispatch brief.

Specific things to capture:

- If you tuned the fade timing away from 150ms or chose a
  different easing function (the spec is `150ms ease-out`),
  capture the final value + the perceptual reason. If you
  shipped at the spec'd 150ms ease-out, note "shipped as
  specified."
- Any `useEntries(... ?? '')` behavior observation —
  particularly whether it issues a wasted query or
  short-circuits gracefully. Inform the future hook-cleanup
  dispatch (the BACKLOG → Soon "Refactor data-fetch hooks"
  item).
- Bundle delta from M5 baseline (680.96 KB JS / 178.77 KB gz).
- Anything the **next-dispatch** implementer (B PWA polish OR
  C cars kebab OR E edit-entries) will want to know about
  `LogFillupScreen`'s new shape. E.g.: if Edit-entries later
  wants to navigate from a tile to a deeper view, the tile
  data flow is now on the log screen — does that change
  navigation assumptions?
- Note for the **prod cutover conversation**: this dispatch
  changes what the family sees on first sign-in. The tiles
  are visible BEFORE they have data (the row hides at 0
  entries, so first sign-in shows no tiles; second fill-up
  reveals them). Worth mentioning in family-onboarding copy
  so they don't expect MPG numbers before they've logged at
  least 2 fills.

---

## 12. Pre-read checklist

The reviewer cuttlefish reads this brief + the supporting
artifacts and reports against:

- **Brief-internal consistency**: §4 decisions ↔ §8 ACs ↔ §5
  files. Every AC has the one file in §5; every decision maps
  to at least one AC.
- **`useEntries` API match**: verify by reading
  `src/entries/useEntries.ts` that the hook returns
  `{ state: discriminated union, refresh: () => Promise<void> }`
  and accepts `carId: string`. Confirm the
  `selectedCarId ?? ''` empty-string pattern won't cause an
  unhandled error (compare to M3's `useCar(carId ?? '')`
  precedent).
- **`MpgTile` API match**: read `src/components/MpgTile.tsx`
  and verify props (`label`, `value`, `subtitleWhenEmpty`)
  match the §7.2 call sites.
- **`computeMpg` API match**: read
  `src/entries/computeMpg.ts` and verify
  `lastFillMpg(entries)`, `avgLastNMpg(entries, 5)`,
  `lifetimeMpg(entries)` exist with those signatures.
- **Current LogFillupScreen shape**: read
  `src/screens/LogFillupScreen.tsx` and verify the existing
  empty-cars state, form structure, save handler, and chip
  selection are well-bounded for the surgical modification
  this dispatch proposes. Identify if the existing file shape
  makes the §7.2 sketch impossible (e.g., the save handler
  isn't structured to easily call `refreshEntries`).
- **Pixel-only viewport assumption**: trace the §1 "412×915"
  claim against Tailwind's `max-w-md` (28rem = 448px). The
  form sits in a 448-wide container; with a 412-wide
  viewport, the container is constrained by viewport
  (412 - 48px main-padding = 364px). Tile row is `grid
  grid-cols-3 gap-2` inside that — each tile ~117px wide.
  MpgTile's existing styling: verify it renders cleanly at
  ~117px column width.
- **Internal contradictions**: any ACs that conflict.
- **Missing edge cases**:
  - What happens if `useEntries` errors? Per S6, hide section.
    Verify the §7.2 sketch correctly handles
    `entriesState.status === 'error'` (it does — `showTiles`
    is false unless status is 'ready' AND length >= 1).
  - What if Save succeeds but `refreshEntries` errors? Tiles
    show stale data; eventually corrected on next car switch
    or page reload. Acceptable. Verify the sketch doesn't
    crash the screen on refresh error.
- **`key={selectedCarId}` semantics**: if the user switches
  car BACK to the previously-selected one before the in-flight
  fetch completes, what happens? `useEntries` has the M3
  epoch race-guard, so the stale fetch is discarded; the new
  fetch fires with the same carId; tile row remounts (because
  key changed once and is now "the same" again — but the
  remount happens on each switch regardless). Trace the
  React reconciliation behavior here.

Report format: BLOCKING / SHOULD-FIX / NITS / CONFIRMED-OK.
Reviewer modifies no files.

---

## 13. Forward feedback channel

If the implementer hits rakes during execution that future
flog dispatches (or paralarva-kit consumers) should know
about, add them here as numbered items. Examples:

- Tailwind v4 animation utility surprises (Option B path).
- `useEntries(... ?? '')` short-circuit behavior under empty
  string.
- Cross-fade timing perception variance across the Pixel
  devices.

(empty until execution)

---

End of brief.
