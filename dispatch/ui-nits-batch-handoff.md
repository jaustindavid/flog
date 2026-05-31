# Dispatch handoff — UI nits batch (car navigation)

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

---

## Status

### Nit #1 — drop both "← Back to cars" back-links

- ✅ **B1**: Neither back-link renders — both removed from
  `CarDetailScreen.tsx` (loaded view ~175 and error/not-found ~153).
- ✅ **B2**: Error surface keeps the header "Cars" link — `App.tsx`
  `AuthGate` wraps `<Header />` above `<Routes>`, so it is present on
  every signed-in route including the error surface. No code change
  needed; verified by reading `App.tsx`.
- ✅ **B3**: `Link` import removed from `CarDetailScreen.tsx`;
  `npm run lint` clean.

### Nit #2 — re-tap active chip → car detail

- ✅ **R1**: Tapping a non-selected chip calls `onChange(car.id)` →
  selects it, no navigation.
- ✅ **R2**: Tapping the already-selected chip calls
  `onReselect(car.id)` → `LogFillupScreen` navigates to
  `/cars/${id}`.
- ✅ **R3**: `CarPickerChips` stays presentational — no router import.
  `onReselect` is a plain callback prop; navigation lives in
  `LogFillupScreen` via `useNavigate`.
- ✅ **R4**: `role="radiogroup"` / `role="radio"` / `aria-checked`
  removed. Replaced with `role="group"` + `aria-label="Choose a car"`;
  selected chip carries `aria-current="true"`. No `aria-pressed`; no
  `aria-checked`.
- ✅ **R5**: Visual styling unchanged — filled-blue selected, outlined
  unselected, `min-h-[44px]` tap targets, focus-ring classes all
  intact.

---

## Versions chosen

No new dependencies. All existing versions unchanged.

---

## Assumptions made

- `aria-current={selected ? 'true' : undefined}` — omitting the
  attribute entirely on unselected chips (rather than
  `aria-current="false"`) matches the spec intent: only the current
  item carries the attribute. Safe to override with `false` if a
  screen-reader audit prefers it.

---

## Deviations from dispatch

None — followed the dispatch as written.

---

## Files created

None. All changes are edits to existing files.

---

## Files NOT touched (confirmed)

- `src/components/Header.tsx` — untouched.
- `src/components/ReminderBanner.tsx` — untouched.
- `src/maintenance/computeReminder.ts` — untouched.
- `src/maintenance/computeSpend.ts` — untouched.
- `firestore.rules` — untouched.
- `AGENTS.md`, `ARCHITECTURE.md`, `HANDOFF-TEMPLATE.md` — untouched.
- `dispatch/ui-nits-batch.md` (the brief itself) — untouched.

---

## Items deferred

### To the next dispatch brief

None from this batch.

### To BACKLOG

- **Draft persistence / unsaved-form guard** (already in BACKLOG →
  Later from the nitpicks log): the accepted double-tap edge (tap 1
  selects a different car, tap 2 immediately navigates, dropping a
  half-typed fill-up) remains unguarded by owner decision. A robust
  fix is draft persistence; the simpler interim would be a
  confirm-on-navigate when fields are dirty. Owner declined the
  confirm variant; draft persistence is the right path. Keep in
  BACKLOG → Later.

---

## Expected cost impact

None. Pure client-side routing and presentational changes; no
Firestore reads/writes added or removed.

---

## Manual steps for the human owner

1. `npm run lint && npm run lint:md && TZ=America/New_York npm test &&
   npm run test:rules && npm run build:prod` — all exit 0 as of this
   handoff.
2. Smoke-test on device / emulator:
   - Open the fuel screen. Tap a non-selected chip — should select it
     without navigating.
   - Tap the already-selected chip — should navigate to
     `/cars/<that-car-id>`.
   - Navigate to a car-detail URL for a car you don't own / doesn't
     exist — should show "Car not found or no access." with the header
     "Cars" link still visible above it; no orphaned back-link in the
     page body.

---

## A11y model implemented

**`role="group"` + `aria-current="true"` on selected chip.**

Rationale: the original `radiogroup`/`radio` ARIA pattern implies that
activating the checked radio is a no-op (per the radio-button contract).
Once the selected chip navigates, that contract is violated. A plain
`role="group"` of `<button type="button">` elements makes every
activation a legitimate button action (no implied no-op). Selection
state is conveyed by `aria-current="true"` ("the current item in this
set"), which is the correct token for single-select navigation sets (cf.
breadcrumb, pagination). `aria-pressed` was explicitly rejected: it
implies an independent per-button toggle and misrepresents the mutual
exclusivity of the picker.

No keyboard handler was orphaned. The prior component had no roving
`tabIndex` and no `onKeyDown`; every chip was independently
Tab-focusable before and remains so now.

---

## Accepted edge

A fast double-tap while switching to a *different* car (tap 1 selects
the new car, tap 2 now lands on the newly-selected chip and navigates
to car-detail, discarding any half-typed fill-up) is accepted as
low-stakes by owner decision 2026-05-31. Re-tapping the active chip is
a deliberate gesture. No confirm dialog. Robust guard (draft
persistence) is in BACKLOG → Later.

---

## Bundle delta

Prod build (gzip): 212.98 kB baseline → 213.03 kB after (+0.05 kB,
rounding noise). Raw: 822.75 kB → 822.43 kB (−0.32 kB). Dead `Link`
removal in `CarDetailScreen` roughly offset by new `useNavigate` +
`onReselect` wiring in `LogFillupScreen`.

---

## Notes for the next dispatch brief

- The chip re-tap wiring is intentionally simple: `onReselect` is a
  plain `(carId: string) => void`. If the chip ever gains a second
  call-site (e.g. a car-picker in an edit-entry modal), the same prop
  contract works — the caller just passes a different handler or a
  no-op.
- PRD §14.5's "banner is the ONLY maintenance reference" lock is
  intact and clarified. The clarifying sentence explicitly calls out
  that chip re-tap is general car navigation, not a maintenance link,
  so the lock reads cleanly.
