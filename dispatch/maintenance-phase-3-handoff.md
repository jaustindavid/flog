# Maintenance phase 3 — service reminders (handoff)

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

Implements Phase 3 of PRD §14.3 + §14.5: a per-car service reminder
(config on the Car), a DERIVED "last done" baseline, a reset checkbox
in the maintenance modal, and an in-app due/overdue banner on the log
screen. One dispatch (not split). Authoritative brief:
`dispatch/maintenance-phase-3.md`.

## Status

- ✅ **D (data/rules)** — Car gains `maintenanceReminder`;
  `setMaintenanceReminder` sets/clears it; the Car-update rule extends
  the diff's `affectedKeys().hasOnly` to include `maintenanceReminder`
  and validates the shape (`is number` + range, ≥1 interval). 13 new
  `cars.test.ts` cases (set miles/months/both, clear, absence-branch
  rename, bad shapes, double-encoded number, owner-only). All
  pre-existing rules-tests pass unchanged.
- ✅ **C (compute)** — `computeReminder` is pure (injected `now` +
  `currentOdometer`, no `new Date()` inside); covers inactive, mileage-
  due, time-due, whichever-first, overage values, null-odometer,
  null-baseline-date, baseline selection + tiebreak. `addMonths` clamps
  month-end; tested under the pinned `TZ=America/New_York`.
- ✅ **U (UI)** — car-detail shows/edits/clears the reminder (owner
  only); the maintenance modal shows the reset checkbox only when a
  reminder exists and writes `resetsReminder` on create AND edit; the
  log screen shows a tappable banner only when configured + baseline +
  due; tapping opens the modal; no reminder → no banner (log screen
  unchanged).
- ✅ **L (gates)** — `lint`, `lint:md`, `test`, `test:rules`,
  `build:dev`, `build:prod` all exit 0.
- ⚠️ **V / V2 (verify, owner)** — code paths are wired and unit/rules-
  tested, but the live round-trip (set reminder → log reset → drive
  odometer past via a fuel fill → banner fires → tap → modal → clear →
  banner gone) is a manual owner check. See "Manual steps".
- ⚠️ **V2 owner-only flag** — the reminder CONFIG UI is owner-only
  (sharees can't set/edit/clear it), matching the Car-update rule which
  is owner-only. Sharees DO see the reset checkbox in the modal and the
  banner (they can read the car + log maintenance). Flagged per brief.

## Versions chosen

None — no new dependencies. Same React 18 / firebase 11 / react-router
7 / vitest 4 stack.

## Assumptions made

- **Reminder label cap = 60 chars** (`validateReminderLabel`,
  `MAX_REMINDER_LABEL_LENGTH`). Mirrors `validateCarName`'s posture;
  client-side UX guard only (the rule enforces `is string`, not length).
  Override if 60 feels short for a label.
- **Interval ranges in the rule**: `intervalMiles` `0 < x < 100_000_000`
  (matches `validMaintNumbers`' odometer ceiling); `intervalMonths`
  `0 < x < 1200` (100 years — generous NaN/Infinity guard, not a quality
  bound). Owner can widen/narrow.
- **Default label "Oil change"** pre-filled in the config form (PRD §14
  worked example). Editable before save.
- **Banner copy**: `[label] due` at threshold; `overdue by N mi` /
  `overdue by N days` past it; when both dimensions overdue, prefer
  miles (§5.5). Amber nudge, not red.
- **Reset checkbox default OFF** in create mode — including the banner-
  tap create flow (Decision #3). The owner may later want the banner-tap
  to pre-check it; left OFF and flagged as a V2 option.
- **Edit mode pre-fills the checkbox** from the entry's stored
  `resetsReminder`, so editing an existing baseline entry keeps it a
  baseline unless the user unchecks.

## Deviations from dispatch

None — followed the dispatch as written. Note the brief itself
(§5.2 S4) corrected the §6 "create path unchanged" line: both
`createMaintenance` (new optional `resetsReminder`, default false) and
`updateMaintenance` (new required `resetsReminder` field) changed
additively, as implemented.

## Files created

- `src/maintenance/addMonths.ts` (+ `.test.ts`, 10 cases) — pure
  month-add with end-of-month clamp.
- `src/maintenance/computeReminder.ts` (+ `.test.ts`, 18 cases) — pure
  derived reminder status.
- `src/maintenance/validateReminderLabel.ts` (+ `.test.ts`, 6 cases) —
  label validator mirroring `validateCarName`.
- `src/components/ReminderBanner.tsx` — presentational due/overdue
  banner.
- `src/components/ReminderConfigForm.tsx` — owner-only inline reminder
  config (mirrors `RenameCarForm`).

## Files modified

- `src/cars/cars.ts` — `MaintenanceReminder` type; `Car` /`CarDocData`
  /`toCar` gain `maintenanceReminder`; `setMaintenanceReminder` write
  path.
- `firestore.rules` — Car-update rule: `affectedKeys().hasOnly` extended
  to `['name','shareeEmails','maintenanceReminder']` + shape block.
- `src/maintenance/maintenance.ts` — `createMaintenance` optional
  `resetsReminder` param; `updateMaintenance` `resetsReminder` field.
- `src/components/MaintenanceModal.tsx` — `reminderLabel` prop + reset
  checkbox; writes `resetsReminder` on both paths.
- `src/screens/CarDetailScreen.tsx` — mounts `ReminderConfigForm`
  (owner) + passes `reminderLabel` to the modal.
- `src/screens/LogFillupScreen.tsx` — `useMaintenance`, max-odometer
  current mileage, `computeReminder`, banner, mounted reset modal.
- `tests/rules/cars.test.ts` — 13 reminder shape/authz cases.

## Files NOT touched (confirmed)

- `src/entries/*`, the fuel form's existing fields, the MPG/stat
  pipeline, `computeSpend`, `SpendReport` — untouched.
- `src/maintenance/dateField.ts` — imported convention only; not edited.
- `PRD.md`, `AGENTS.md`, `BACKLOG.md`, config, `package.json`,
  `HANDOFF-TEMPLATE.md`, the brief — untouched.

## Items deferred

- **To the next dispatch / refinement**: the "upcoming" (lead-margin
  "due soon") banner state. PRD §14.3 lists `upcoming / due / overdue`,
  but Phase 3 is BINARY (due/overdue only, threshold crossed) per brief
  §3. This is a deliberate scope line, NOT a gap — `computeReminder`
  returns `due` as a boolean; adding a lead margin means a third state +
  a config field for the margin.
- **V2 option**: pre-check the reset checkbox when the modal is opened
  via the banner tap (currently always OFF). Trivial — pass an initial
  flag into `MaintenanceModal`.
- **To BACKLOG**: multiple reminders per car (one only today — PRD
  §14.6); factory/VIN default schedules (none).

## Expected cost impact

Adds **1 Firestore query per LogFillupScreen mount / car-switch** — the
new `useMaintenance(selectedCarId)` fetch (one `getDocs` of the car's
maintenance subcollection, same shape as the car-detail screen's
existing maintenance fetch). The car-detail screen already fetched
maintenance; the config form adds no new reads (it reads
`car.maintenanceReminder` from the already-loaded Car doc).
`setMaintenanceReminder` is one `updateDoc` per save/clear.

## Manual steps for the human owner (V2)

1. As owner on a car detail screen: in the **Maintenance** section, tap
   **Set reminder** → enter a label + a mileage interval and/or months
   interval (≥1 required; Save disabled otherwise) → Save.
2. **Log a reset**: open the maintenance modal (Log maintenance), fill
   it, check **↺ Reset [label]**, Save. This entry becomes the baseline.
3. **Drive the odometer past**: log a fuel fill on the log screen with
   an odometer ≥ baseline odometer + intervalMiles (or wait until the
   date passes baseline + intervalMonths). The banner should appear at
   the top of the log screen for that car.
4. **Tap the banner** → the maintenance modal opens in create mode with
   the reset checkbox visible. Logging a reset here re-baselines and the
   banner clears.
5. **Clear**: back on car detail, Edit the reminder → **Remove
   reminder**. The banner should disappear; the log screen returns to
   exactly its prior behavior.

## Notes for the next dispatch brief

- **`currentOdometer` is MAX across fuel entries**, not `entries[0]`
  (newest-LOGGED). Entries sort by `loggedAt desc`; a backdated fill can
  leave `entries[0]` with a lower odometer. The screen computes
  `Math.max(...entries.map(e => e.odometer))`. Don't "simplify" this to
  `entries[0].odometer` — it would under-fire the banner (S2).
- **The rule uses `is number`, NOT `is int`**, on both intervals —
  deliberate (the JS SDK can encode a whole number as a double; `is int`
  would reject a valid `intervalMiles: 3000` at runtime). A rules test
  (`...double (is number, not is int)`) pins this. Same SF4 convention
  as `validMaintNumbers` / `validEntryNumbers`.
- **The Car-update rule extends the diff's `affectedKeys` hasOnly** — it
  is NOT a `keys().hasOnly`. `ownerUid`/`createdAt` stay immutable as a
  side effect (they're outside the affectedKeys set). A rename/share
  write omits `maintenanceReminder`, so the shape block's first clause
  (`!('maintenanceReminder' in request.resource.data)`) no-ops and the
  pre-existing update tests stay green.
- **`computeReminder` and `addMonths` are pure** — `now` and
  `currentOdometer` are injected by the screen; never add a `new Date()`
  inside them (the test suite asserts determinism under a pinned TZ).
- **`addMonths` clamps, `dateField` rejects** — opposite behaviors on
  overflow, deliberately. `addMonths(Jan 31, 1)` → Feb 28/29 (a usable
  due date); `dateField` returns null on a bad user input. Don't unify
  them.
