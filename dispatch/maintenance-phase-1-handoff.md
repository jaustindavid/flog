# Maintenance phase 1 — logging (CRUD + car-detail list) — handoff

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

Implements `dispatch/maintenance-phase-1.md` (authoritative design:
PRD §14). Full CRUD (Decision S1, owner-confirmed). All gates exit 0.

---

## Status

- ✅ **S (schema/module)** — `maintenance.ts` does create / list /
  update / delete / cascade. `loggedAt` is server-set; `date` is a
  concrete user-set Timestamp (SF2). `updateMaintenance` writes only
  the four editable fields. `date` round-trips via `dateField.ts`.
- ✅ **R (rules)** — maintenance read/create/update/delete gated to
  parent owner-or-current-sharee via the lifted helpers. Create pins
  the field set + types + ranges + `loggedAt == request.time`; `date`
  accepts a backdated timestamp (positive test); `note` non-empty
  enforced; `loggedByUid`/`loggedAt` immutable on update. All 65
  pre-existing entries/cars/users/allowlist rules-tests still pass
  after the §7.4 helper-lift.
- ✅ **T (tests)** — `maintenance.test.ts` (32 cases) covers the full
  authz matrix + validation negatives (extra field, bad type,
  negative, missing/empty note, forged `loggedAt`, **non-bool
  `resetsReminder` on update** — SF1). `validateNote.test.ts` (8) and
  `dateField.test.ts` (15, incl. the year-boundary round-trip under
  non-UTC TZ) pass.
- ✅ **U (UI)** — car-detail shows a Maintenance section ABOVE
  Fill-ups; "Log maintenance" opens the create modal; saving adds a
  row; tapping a row edits; delete removes with confirm; the table
  owns its empty state (N2).
- ✅ **V (verify)** — `deleteCar` cascades `deleteMaintenanceForCar`
  before the car delete. The fuel stream (`entries.ts`, MPG pipeline,
  `MpgTile`, the fuel form) is untouched.
- ✅ **L (gates)** — `lint`, `lint:md`, `test`, `test:rules`,
  `build:dev`, `build:prod` all exit 0.
- ⚠️ **V2 (owner)** — owner-only manual verify on dev. Not run by me
  (no deploy). See "Manual steps." Backdated-date + cascade
  watch-outs called out below.

## Versions chosen

None. No new dependencies — native `<input type="date">` per Decision
10. No `any`. Existing stack unchanged (React 18, firebase ^11,
react-router ^7).

## Assumptions made

- **Note cap = 280 chars** (`validateNote`, brief §3). Tweet-length;
  the rule enforces only non-empty, the cap is a client UX guard.
  Owner may retune; low-stakes.
- **Note cell truncates at `max-w-[8rem]`** (N3). Picked to fit the
  4-column table at 375px; `title={note}` gives full text on hover.
- **Date input is the modal's first/autofocused field.** Mirrors the
  field order date → odometer → cost → note from the brief.
- **`MaintenanceModal` validates the date field** (disables Save when
  `dateInputToTimestamp` returns null) and shows "Enter a valid date".
  A native date input rarely yields a bad string, but the guard keeps
  the create input contract (`date: Timestamp`, non-null) honest.

## Deviations from dispatch

None — followed the dispatch as written. The §7.4 helper-lift was
done the recommended way (lift, not duplicate); the pre-read's "safe"
judgment held (see helper-lift note below).

## Files created

- `src/maintenance/` — 4 source + 2 test files:
  - `maintenance.ts` (data module; mirrors `entries.ts`, does NOT
    import `../cars`), `useMaintenance.ts` (fetch hook; mirrors
    `useEntries`), `validateNote.ts` + `.test.ts`, `dateField.ts` +
    `.test.ts` (the LOCAL-midnight bridge, SF3).
- `src/components/` — `MaintenanceModal.tsx` (one create-or-edit
  modal), `MaintenanceTable.tsx` (per-car list).
- `tests/rules/maintenance.test.ts` (authz matrix + validation).

## Files modified

- `firestore.rules` — lifted `parentCar()` / `canReadParent()` /
  `canMutate()` from the `entries` block up to `cars/{carId}` scope;
  added the `cars/{carId}/maintenance/{maintId}` block.
- `src/screens/CarDetailScreen.tsx` — new Maintenance `<section>`
  above Fill-ups, wired to `useMaintenance` + one `MaintenanceModal`.
- `src/cars/cars.ts` — `deleteCar` now also calls
  `deleteMaintenanceForCar(carId)` before deleting the car doc.

## Files NOT touched (confirmed)

- `src/entries/*` — imported `validateOdometer` / `validateCost`
  read-only; not edited. Fuel form, `computeMpg` / `computeStats`,
  `MpgTile`, `StatRow`, `LogFillupScreen` — untouched.
- `PRD.md`, `AGENTS.md`, `BACKLOG.md`, `README.md`, `LICENSE`, the
  working-model/kit docs — untouched.
- `.env.*`, `firebase.json`, `package.json` (no new deps),
  `/public/*`, `scripts/*` — untouched.

## Helper-lift confirmation (load-bearing item #2)

The §7.4 lift moved the three function definitions up one scope and
left behavior identical. Rules functions resolve `request`/`resource`
at the CALL SITE, so `canMutate()`'s `resource.data.loggedByUid` still
refers to the subcollection doc (both `entries` and `maintenance`
carry `loggedByUid`), not the car. The duplicate `canMutate()` that
had lived inside the entries block was removed (a same-name nested
redefinition would not compile).

- **Pre-existing rules-tests before:** 65 (allowlist 8, cars 20,
  entries 25, users 12).
- **After the lift:** same 65, all green, unchanged.
- **Total rules-tests now:** 97 (65 + 32 maintenance). `test:rules`
  exits 0.

## Date round-trip confirmation (SF3)

`dateField.ts` uses LOCAL components only (`new Date(y, mo-1, d)` /
`getFullYear/getMonth/getDate`), never `new Date(str)` or
`toISOString()`. The round-trip test asserts `2026-01-01` survives
`input → Timestamp → input` unchanged. Verified passing under:

- `TZ='America/Los_Angeles'` (full suite, 138 unit tests).
- `TZ='Pacific/Kiritimati'` (+14) and `TZ='Pacific/Honolulu'` (-10) —
  the date-helper file (15 tests). Both pass; the helper is tz-correct
  by construction.

Run: `TZ='America/Los_Angeles' npm test`.

## Items deferred

### To the next dispatch

- **Phase 2 (spend reporting, PRD §14.4)** — the 3×3. `resetsReminder`
  is already written `false`; `date` is the calendar-year bucket key.
- **Phase 3 (reminders, PRD §14.3)** — the maintenance `create` and
  `update` rules already admit `resetsReminder` (bool, re-validated),
  so the Phase-3 reset checkbox drops into `MaintenanceModal` with NO
  rules change. The Car `update` rule still needs its `hasOnly`
  extended to `maintenanceReminder` (owner-only) — out of scope here
  (brief §8 V2 flag).

### To BACKLOG

- The `useMaintenance` hook is the 4th instance of the
  `react-hooks/set-state-in-effect` suppression (useCars / useCar /
  useEntries / useMaintenance). The pending "refactor data-fetch
  hooks" BACKLOG item should now remove four, not three.

## Expected cost impact

Adds 1 Firestore query (`listMaintenanceForCar`, ordered by `date`)
per car-detail mount, plus 1 write per maintenance create/update and 1
delete per maintenance delete. Car-delete now reads + batch-deletes
the maintenance subcollection (was entries-only). All family-scale.

## Manual steps for the human owner

- Deploy rules + app to dev: `npm run deploy:dev` (the maintenance
  rules block must be live before V2).
- **V2** on dev: open a car, "Log maintenance", enter a **backdated**
  date → save → confirm the row appears with the backdated date; edit
  it; delete it (confirm). Confirm the Fill-ups section + MPG tiles
  are unchanged. Then delete a car that has maintenance and confirm
  the maintenance docs are gone (Firebase Console → no orphans under
  the deleted car).

## Notes for the next dispatch brief

- **Backdated dates + ordering (N1):** `listMaintenanceForCar` orders
  by `date` (service date), NOT `loggedAt`. Same-day local-midnight
  ties have undefined relative order — fine for a log; Phase 2/3 must
  not assume intra-day ordering.
- **SF4 integer posture held:** `validMaintNumbers` is `is number`
  (not `is int`), matching the entries idiom; the client
  (`validateOdometer`) enforces integer odometers. Do not add `is int`
  to the rule.
- **`date` is `Timestamp | null` only in the read mapping** — writes
  always send a concrete Timestamp. A null `date` would be denied by
  the rule's `date is timestamp`.
- The Maintenance section reuses the Fill-ups section's loading /
  error / refresh wiring shape, so a future merged fuel+maintenance
  timeline (display nicety, not in any current phase) has two
  parallel hooks to draw from.

## Stop-and-ask items hit

None. The helper-lift was clean (no pre-existing test broke); the date
convention had no foot-gun once built from local components; full CRUD
fit one clean pass; no new dependency was needed.
