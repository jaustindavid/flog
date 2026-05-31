# Next-due display — car-detail + Cars-list (handoff)

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

Implements the forward-looking "next maintenance due" projection on two
surfaces (PRD §14.3 "upcoming" — deferred from Phase 3). Authoritative
brief: `dispatch/next-due-display.md`.

## Status

- ✅ **C (compute)** — `computeReminder` extended with four projection
  fields (`dueOdometer`, `dueDate`, `milesRemaining`, `daysRemaining`).
  Additive: existing `active`/`due`/`overdueMiles`/`overdueDays`/`label`
  fields are untouched. All 18 pre-existing Phase-3 tests still pass.
- ✅ **T (tests)** — 14 new projection tests added to
  `computeReminder.test.ts`: both-intervals, miles-only, months-only,
  not-yet-due (positive remaining), overdue (negative remaining),
  null-odometer, no-baseline, exact-zero boundary (S4), DST spring-
  forward, DST fall-back. Run under the pinned `TZ=America/New_York`.
  Test count: 179 → 199 (net +20; 14 from this dispatch, 6 from a
  concurrent spend-distance working-tree change).
- ✅ **U (UI)** — car-detail Maintenance section shows the absolute
  next-due (`Next [label]: N mi or by [date]`) or "overdue by" copy
  when past due, and "Log a [label] to start" when reminder set but no
  baseline. Cars-list rows show a relative countdown ("next oil change
  in 1,200 mi / 45 days") or "overdue by" when past; nothing for no-
  reminder cars; invisible during loading/error (no flash).
- ✅ **L (gates)** — `lint`, `lint:md`, `test`, `build:dev`,
  `build:prod` all exit 0. (`test:rules` not re-run — no rules/schema
  changes.)
- ⚠️ **V2 (owner-only flag)** — manual round-trip check (set reminder
  → log baseline → log fuel past threshold / wait past date → verify
  both surfaces) is a manual owner step. Code is wired and unit-tested.

## Versions chosen

None — no new dependencies. Same React 18 / Firebase 11 / react-router
7 / vitest 4 stack.

## Assumptions made

- **`NextDueLine` copy** uses `reminder.label.toLowerCase()` for inline
  copy ("next oil change in …"). If the label is already lowercase
  (e.g. "oil change") this is idempotent. Owner tunes copy at V2.
- **"overdue" format on the list row** when both dimensions are overdue:
  "Oil change overdue by 500 mi / 3 days". When only one is overdue,
  shows only that dimension. Mirrors banner's preference for miles-
  first (ReminderBanner §5.5) but shows all overdue dimensions.
- **Car-detail "overdue" copy** when at-threshold (`milesRemaining == 0`
  or `daysRemaining == 0`): renders the overdue block (S4 — mirrors
  banner's `<= 0` → "due/overdue"). The zero case reads "Oil change
  overdue" without a "by 0 mi" suffix (parts filter yields nothing when
  abs is 0 — intentional; "overdue" alone is cleaner than "by 0 mi").
- **`NextDueDetail` is a file-local component** in `CarDetailScreen.tsx`
  (not a separate file). It takes already-loaded data from the parent,
  so no second fetch. Moved to a separate component file only if the
  screen grows unwieldy.
- **`daysRemaining` uses `Math.round`** rather than `Math.floor` in
  `localCalendarDayDiff`. Both `localMidnightMs(now)` and
  `localMidnightMs(dueDate)` are midnight-aligned integers; the
  division is always exact (no fractional remainder after flooring).
  `Math.round` is a defensive no-op but makes intent clear.

## Deviations from dispatch

None — followed the brief and pre-read findings exactly:

- S1 (stable child / no re-fetch churn): `NextDueLine` is a direct
  child of `CarListItem` with no unstable key.
- S2 (accepted staleness): per-row `getDocs` may serve cached data on
  re-navigation. Not synced. See note below.
- S3 (DST-safe `daysRemaining`): local-midnight floor on both operands,
  not raw ms division.
- S4 (=0 boundary): `<= 0` → overdue copy on both surfaces.
- N3 (invisible on error/loading): `NextDueLine` returns `null` when
  either state is not `'ready'`.
- N4 (empty-array guard): `currentOdometer` uses
  `entries.length > 0 ? Math.max(...) : null`.

## Files created

- `src/components/NextDueLine.tsx` — per-row countdown component for
  the Cars list.
- `dispatch/next-due-display-handoff.md` — this file.

## Files modified

- `src/maintenance/computeReminder.ts` — `ReminderStatus` gains
  `dueOdometer`, `dueDate`, `milesRemaining`, `daysRemaining`;
  `localMidnightMs`/`localCalendarDayDiff` helpers added; existing
  mileage/time branches extended to compute the new fields.
- `src/maintenance/computeReminder.test.ts` — 14 new projection tests
  in two new `describe` blocks.
- `src/components/CarListItem.tsx` — imports + mounts `<NextDueLine>`
  conditionally when `car.maintenanceReminder != null`.
- `src/screens/CarDetailScreen.tsx` — imports `computeReminder` +
  `MaintenanceReminder`; adds file-local `NextDueDetail` component +
  `formatLocalDate` helper; mounts `<NextDueDetail>` in the Maintenance
  section when reminder is set and both data states are ready.

## Files NOT touched (confirmed)

- `src/maintenance/addMonths.ts` — import only, not edited.
- `src/components/ReminderBanner.tsx` — untouched.
- `src/screens/LogFillupScreen.tsx` — untouched.
- `firestore.rules`, schema, `computeSpend`, `SpendReport` — untouched.
- `AGENTS.md`, `PRD.md`, `BACKLOG.md`, config, `package.json` —
  untouched by this dispatch.

## Items deferred

- **V2 copy tuning**: the label-casing ("next oil change in …") and
  overdue format are first-pass. Owner reviews live and adjusts.
- **Detail-screen "overdue at 0" copy**: at exactly-due, the car-detail
  shows "Oil change overdue" without a "by 0 mi / 0 days" suffix.
  Owner may prefer "Oil change due" at exactly zero. Trivial change to
  the `<= 0` branch.
- **Multiple reminders per car**: one only today (PRD §14.6). This
  feature is scoped the same way.
- **"Due soon" lead margin**: Phase 3 / this dispatch are both binary
  (due/overdue or upcoming). A lead-margin "due soon" state is a future
  dispatch (would need a config field + a third `computeReminder` state).

## S2 accepted-staleness note (for the next dispatch brief)

`NextDueLine` issues a one-shot `getDocs` on mount via `useMaintenance`
and `useEntries`. Firestore's offline cache means the data may reflect
a prior session's snapshot until the row re-mounts (list remount,
navigation away + back). If the user logs a maintenance reset on the
detail screen and immediately returns to the list, the countdown may
still show the old value for a moment. **This is accepted.** The Cars-
list countdown is advisory; the car-detail screen is authoritative and
always shows fresh data. Do NOT add a cross-screen sync mechanism here;
if it becomes a UX issue, the right fix is a real-time listener (BACKLOG
"subscribe-style refactor").

## Expected cost impact

Adds **N × 2 one-shot `getDocs`** on Cars-list mount (one maintenance
and one entries subcollection query per car with a reminder). At family
scale (≤10 cars) this is negligible. Per the brief, "fetches cheap" —
accepted. Resolved from Firestore offline cache on repeat visits.
`NextDueDetail` on the car-detail screen adds **no new reads** (it
reuses the parent screen's already-loaded `maintState` + `entriesState`).

## Manual steps for the human owner (V2)

1. On the Cars list, a car with a configured reminder + baseline should
   show a quiet grey line below the name: e.g. "next oil change in
   1,200 mi / 45 days". A car without a reminder shows only the name
   (and shared-with count if applicable) — unchanged.
2. On the car-detail Maintenance section (below the reminder config),
   the absolute threshold should appear: "Next oil change: 9,001 mi or
   by Aug 31, 2026". If only a mileage interval is set: "Next oil
   change: 9,001 mi". If only months: "Next oil change: by Aug 31,
   2026".
3. When the odometer passes the threshold (or the date passes), both
   surfaces should flip to overdue copy.
4. A car with a reminder but no `resetsReminder == true` maintenance
   entry: car-detail shows "Log a oil change to start the reminder."
   The list row shows nothing (no countdown without a baseline).

## Notes for the next dispatch brief

- **`computeReminder` extension is additive** — all Phase-3 consumers
  (`ReminderBanner`, `LogFillupScreen`) only read the original five
  fields. Adding more fields to `ReminderStatus` is safe.
- **`daysRemaining` uses `localCalendarDayDiff` (DST-safe)** — do NOT
  replace with `Math.floor((dueDate - now) / MS_PER_DAY)`. The existing
  `overdueDays` field uses raw ms division with a `Math.floor` that
  only works because overdue values are always ≥0 (sub-day DST wobble
  rounds down safely). The forward projection can be negative, so the
  DST-immune local-midnight approach is required.
- **`NextDueLine` has no refresh trigger** — it will not re-fetch when
  the user logs a fill-up or maintenance entry elsewhere in the same
  session. This is S2 accepted staleness. The list row re-mounts only
  on navigation away + back or a full page reload.
- **`formatLocalDate` uses `toLocaleDateString('en-US', …)`** — this
  is consistent with the local-getter convention and produces
  "Aug 31, 2026" style output. If the app goes international, this
  locale string needs revisiting.
