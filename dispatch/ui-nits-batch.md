# Dispatch — UI nits batch (car navigation)

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

**Status**: brief, ready for pre-read. Two accumulated UI nitpicks,
both touching car navigation. Source: `dispatch/ui-nitpicks.md` (items
1 and 2). **Model: Sonnet** — mechanical UI + one a11y reclassification; no
security / rules / schema / data surface.

---

## 1. Context

Two small, owner-flagged UI tweaks batched into one dispatch (both are
about moving between the fuel screen and a car's detail page):

1. **Drop the redundant in-page "← Back to cars" links** on the
   car-detail screen.
2. **Re-tap the already-selected car chip on the fuel screen →
   navigate to that car's detail page.**

Pure presentational + routing. No Firestore reads/writes change, no
rules, no schema, no data model.

---

## 2. Required reading

1. `src/screens/CarDetailScreen.tsx` — has the two back-links (lines
   ~153–158 in the error/not-found branch, ~175–180 in the loaded
   branch). Both are `<Link to="/cars">`.
2. `src/App.tsx` — routing. **Confirmed**: `AuthGate` renders
   `<Header />` ABOVE the route `<Routes>` for every signed-in route,
   so the header is global on all signed-in screens (including the
   car-detail error surface).
3. `src/components/Header.tsx` — the global header. Has a "Cars"
   `NavLink` (to `/cars`) that is always present → makes the in-page
   back-links redundant.
4. `src/components/CarPickerChips.tsx` — the fuel-screen car picker.
   Currently an ARIA `radiogroup` of `role="radio"` buttons; `onChange`
   selects. This is what nit #2 changes.
5. `src/screens/LogFillupScreen.tsx` — mounts `<CarPickerChips>` (~line
   253). Owns `selectedCarId` state. Does NOT currently import
   `useNavigate`.
6. `PRD.md` §14.5 (placement decisions) + Flow C (§7, log-screen flow)
   — the docs to reconcile for nit #2 (see §5).
7. `AGENTS.md` — guardrails: no `any`, no new deps, copyright header on
   new files, markdown ≤80 cols.

---

## 3. Nit #1 — drop both car-detail back-links

**Change**: remove BOTH `<Link to="/cars">← Back to cars</Link>`
blocks in `CarDetailScreen.tsx`:

- the loaded-view link (~175–180, in the top `<div>` above the rename
  form), and
- the error/not-found-view link (~153–158, under "Car not found or no
  access.").

**Why both**: the global `Header` (App.tsx `AuthGate`) renders its
"Cars" NavLink on every signed-in route, INCLUDING the car-detail error
surface — so neither back-link is the only way back; both duplicate the
header. (This resolves the open question parked in `ui-nitpicks.md` #1.)

**Cleanup**: `Link` is imported only for these two blocks
(`import { Link, useNavigate, useParams } from 'react-router'`). After
removal it is unused — **remove `Link` from that import** (keep
`useNavigate`, `useParams`) or ESLint `no-unused-vars` fails the gate.

**Leave intact**: the "Car not found or no access." message itself
(just drop its link), the rename form, and everything else on the
screen. In the loaded view, the link sits inside a
`<div className="flex flex-col gap-2">` wrapping the rename form / name
`<h1>` — **leave that wrapper `<div>` in place** (do not flatten it to
a single child; flattening churns layout/diff for no benefit).

### AC — nit #1

- **B1**: neither back-link renders on the car-detail screen (loaded or
  error/not-found).
- **B2**: the error surface still shows the header "Cars" link (verify
  by reading App.tsx — it's a global wrapper; no code change needed to
  preserve it).
- **B3**: `Link` import removed; `npm run lint` clean (no unused
  import).

---

## 4. Nit #2 — re-tap active chip → car detail

**Change**: on the fuel screen, tapping a car chip that is **already
selected** navigates to that car's detail page (`/cars/:carId`);
tapping a **non-selected** chip still just selects it (current
behavior, unchanged). Owner decision 2026-05-31 ("Re-tap → car detail"
variant — not an explicit caret, not a confirm guard).

### 4.1 Wiring (keep the chip presentational)

`CarPickerChips` must NOT own routing. Add an `onReselect(carId)` prop
alongside `onChange(carId)`. Inside the chip's click handler:

```text
onClick: if (car.id === selectedId) onReselect(car.id)
         else                       onChange(car.id)
```

In `LogFillupScreen`: import `useNavigate` from `react-router`, create
`const navigate = useNavigate()`, and pass
`onReselect={(id) => navigate(`/cars/${id}`)}`. (LogFillupScreen does
not currently use `useNavigate` — add the import.)

### 4.2 Accessibility (REQUIRED — load-bearing, pre-read focus)

The chips are today an ARIA `radiogroup` of `role="radio"` buttons. A
radio that navigates breaks the radio contract (a radio selects; it
does not navigate, and re-activating the checked radio is a no-op). Do
**NOT** leave them as radios.

**Target (firm — pre-read validated this exact model):** replace the
`radiogroup` / `radio` roles with a plain group of `<button>`s —
`<div role="group" aria-label="Choose a car">` containing
`<button type="button">` per car — and convey the selected car with
**`aria-current="true"`** on the selected chip. `aria-current` ("the
current item in a set") is the correct fit for single-select; **do NOT
use `aria-pressed`** (it implies an independent per-button toggle, which
misrepresents the mutual exclusivity). Drop `aria-checked`. Keep the
existing visual styling (filled selected / outlined unselected). The
selected chip now navigates on activation — a legitimate button action,
no contract violation.

**No keyboard handler is orphaned.** The current component implements NO
roving `tabIndex` and NO `onKeyDown` — each `role="radio"` button is
independently Tab-focusable today. Moving to `role="group"` + plain
buttons changes nothing about real keyboard behavior: every chip stays
Tab-focusable, Enter/Space activate. There is no arrow-key handler to
preserve or rebuild.

### 4.3 Accepted edge (do NOT guard)

A fast double-tap while selecting a *different* car (tap 1 selects, tap
2 lands on the now-selected chip and navigates, dropping any half-typed
fill-up) is **accepted as low-stakes** — re-tapping the already-active
car is a deliberate act. No confirm-on-unsaved dialog (owner declined
it; the robust alternative — draft persistence — is filed separately in
BACKLOG → Later). Note this in the handoff.

### AC — nit #2

- **R1**: tapping a non-selected chip selects it (form retargets); no
  navigation.
- **R2**: tapping the already-selected chip navigates to
  `/cars/<that car id>`.
- **R3**: `CarPickerChips` stays presentational — navigation lives in
  `LogFillupScreen` via `onReselect` + `useNavigate`; the chip gets no
  router import.
- **R4**: chips are no longer `role="radio"` / `radiogroup`; selection
  is conveyed accessibly (recommended `aria-current`); activating the
  selected chip is a real navigation. Group keeps an accessible label.
- **R5**: visual appearance unchanged (filled selected / outlined
  unselected, 44px tap targets).

---

## 5. Docs to reconcile (same dispatch)

- **PRD Flow C (§7)**: step 2 mentions the car picker. Add a short note
  that **re-tapping the already-selected car chip opens that car's
  detail page** (so the flow records the new affordance).
- **PRD §14.5**: the fuel-screen bullet was locked "the banner is the
  ONLY maintenance reference on the fuel screen — no standing 'log
  maintenance' link." The chip re-tap navigates to the car-detail page
  (a GENERAL car-nav affordance that surfaces fuel + MPG + maintenance
  together), which is distinct in kind from a maintenance-specific
  link. **Add one clarifying sentence** so the new affordance doesn't
  read as contradicting that lock — do NOT delete or weaken the lock.

Keep both doc edits tight; markdown ≤80 cols.

---

## 6. Scope

### In scope

- `CarDetailScreen.tsx` (remove links + import cleanup).
- `CarPickerChips.tsx` (a11y roles + `onReselect`).
- `LogFillupScreen.tsx` (`useNavigate` + `onReselect` wiring).
- `PRD.md` (Flow C + §14.5 notes).
- `dispatch/ui-nitpicks.md` (move #1 + #2 to "Dispatched / done").

### Out of scope / DO NOT TOUCH

- The reminder banner, `ReminderBanner`, the maintenance modal, the
  stats panel, `computeReminder` / `computeSpend`.
- Firestore rules, schema, any data fetch.
- Draft persistence / any unsaved-form guard (filed BACKLOG → Later).
- The `Header` component (it already does the right thing).
- No new dependencies.

---

## 7. Stop-and-ask

- The a11y model is settled (`role="group"` + `aria-current`; pre-read
  confirmed no keyboard handler is orphaned and no test depends on the
  radio roles). Only STOP if you discover something that contradicts
  that — e.g., a screen-reader/keyboard expectation the group model
  genuinely can't meet.
- If `Link` turns out to be used somewhere else in `CarDetailScreen`
  beyond the two back-links, keep the import — don't break it.

---

## 8. Gates + handoff

- All gates exit 0: `npm run lint`, `npm run lint:md`, `npm test`
  (pinned `TZ`), `npm run test:rules`, `npm run build:dev`,
  `npm run build:prod`. (No rules change — `test:rules` should be
  unaffected; run it anyway.)
- No component-test harness exists in the repo (no `*.test.tsx`); the
  select-vs-reselect logic is trivial. Tests are **not required** for
  this batch — rely on gates + owner V2. If you extract any pure logic
  worth a unit test, follow the existing `*.test.ts` convention.
- **No git commits.** Copyright header on any new file (none expected).
- Handoff at `dispatch/ui-nits-batch-handoff.md` per
  `HANDOFF-TEMPLATE.md`: AC checklist (B1–B3, R1–R5), the a11y model
  chosen + rationale, the accepted double-tap edge, files touched,
  bundle delta. Then mark nits #1/#2 done in `dispatch/ui-nitpicks.md`.
