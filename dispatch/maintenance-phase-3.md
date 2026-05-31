# Maintenance phase 3 — service reminders

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

**Status**: draft — pending pre-read before implementer dispatch.

Authoritative design: **PRD §14.3 + §14.5**. This implements **Phase 3
only** (reminders). Phases 1 (logging) and 2 (spend reporting) shipped.

---

## 1. Context

Each car now has a `maintenance` subcollection (Phase 1) and a spend
report (Phase 2). Phase 3 adds **one per-car service reminder** — e.g.
"oil change every 3,000 mi or 3 months" — surfaced as an **in-app
banner on the fuel/log screen** when due, that you reset by logging the
service.

The whole behavior, locked in the design conversation:

- The reminder **config** lives on the Car (`maintenanceReminder`): a
  label + a mileage interval and/or a months interval (≥1).
- The "last done" baseline is **DERIVED**, never stored: the most-recent
  maintenance entry flagged `resetsReminder == true`. (Single source of
  truth; delete-safe. Owner: "risk is expensive; prefer a good data
  model over saving a fetch.")
- You set `resetsReminder` via a **checkbox in the maintenance modal**
  (Phase-1 modal, extended), shown only when the car has a reminder.
- The **banner** is on the log screen only, for the selected car, and
  only when the reminder is configured AND has a baseline AND is due.
  **No push — flog has no service worker; in-app only.**
- Tapping the banner opens the maintenance modal (so you log the
  service that resets the clock).

Worked example (owner): oil changed at 6,001 mi today, interval
3,000 mi / 3 months → banner fires at the first fuel reading ≥ 9,001 mi
OR the first date ≥ +3 months, whichever first.

---

## 2. Required reading

1. **PRD §14.3** (reminder mechanics) + **§14.5** (placement) + §14.6
   (decisions) + §14.7 (phasing — note Phase 3's scope line).
2. `src/maintenance/maintenance.ts` — the `Maintenance` type (has
   `resetsReminder` already, written `false` since Phase 1);
   `createMaintenance` (gains an optional `resetsReminder` param,
   default false) and `updateMaintenance` (gains a `resetsReminder`
   param) — both additive (S4).
3. `src/components/MaintenanceModal.tsx` — the Phase-1 create-or-edit
   modal; add the conditional reset checkbox here.
4. `src/cars/cars.ts` — the `Car` type + `renameCar` write-path
   template; add `maintenanceReminder` to the type + a
   `setMaintenanceReminder` write path.
5. `firestore.rules` — the **Car update rule** (`cars/{carId}` block):
   its `hasOnly(['name','shareeEmails'])` must extend to include
   `maintenanceReminder`, with shape validation. This is the one
   **security-surface** change — P1-style. See §5.3.
6. `tests/rules/cars.test.ts` — the Car-rules test template; add
   set/clear/bad-shape `maintenanceReminder` cases.
7. `src/screens/LogFillupScreen.tsx` — where the banner mounts; it
   already has `useCars()` (→ the selected car doc → `maintenanceReminder`)
   and `useEntries()` (→ latest fuel odometer = current mileage). Add a
   `useMaintenance(selectedCarId)` fetch + the banner + a mounted
   `MaintenanceModal`.
8. `src/maintenance/useMaintenance.ts` + `dateField.ts` — the fetch
   hook, and the LOCAL-date convention (the months-arithmetic helper
   must be local + tested, same discipline).
9. `src/entries/computeStats.ts` / `src/maintenance/computeSpend.ts` —
   the pure-fn + injected-input + unit-test template. `computeReminder`
   mirrors this (inject `now` + `currentOdometer`; NO `new Date()`
   inside the pure fn).
10. `src/screens/CarDetailScreen.tsx` — where the reminder **config**
    UI mounts (in the Maintenance section).
11. `AGENTS.md` — no `any`, pure fns unit-tested, one write path per
    entity, no new deps.

---

## 3. Scope

### In scope

- **Car data model** — `Car.maintenanceReminder:
  { label: string; intervalMiles: number | null; intervalMonths:
  number | null } | null` (null when unset; ≥1 interval non-null when
  set). Add to the `Car` interface, `CarDocData`, and `toCar`
  (coalesce). **`cars.ts`** gains `setMaintenanceReminder(carId,
  reminder | null)` (mirror `renameCar`).
- **Rules** (`firestore.rules`, Car update) — extend `hasOnly` to
  `['name','shareeEmails','maintenanceReminder']` + validate the
  reminder shape (§5.3). + `cars.test.ts` cases.
- **`updateMaintenance`** — extend to also write `resetsReminder` (the
  rules already permit it; Phase 1 just never wrote it).
- **`MaintenanceModal`** — add a reset checkbox, shown ONLY when the
  car has a reminder. Label "↺ Reset [label]". Default OFF. Writes
  `resetsReminder` on create AND edit. Needs the car's reminder
  (label + whether-set) passed in as a prop.
- **Reminder config UI** — on the car-detail Maintenance section: show
  the current reminder (or "no reminder"); a "Set/Edit reminder" modal
  (mirror `RenameCarForm`) to set label + miles and/or months (≥1
  required) or clear it. Writes via `setMaintenanceReminder`.
- **`src/maintenance/computeReminder.ts`** (+ `.test.ts`) — the pure
  derived-status fn (§5.1).
- **`src/maintenance/addMonths.ts`** (+ `.test.ts`) — a small local
  date helper (add N months, sane month-end rollover), used by
  `computeReminder`. (Or colocate in `computeReminder.ts` — but it's
  unit-testable, so give it its own test.)
- **Banner on `LogFillupScreen`** — add `useMaintenance(selectedCarId)`;
  derive status via `computeReminder`; render a tappable banner when
  due; mount a `MaintenanceModal` opened by the tap.
- **`ReminderBanner.tsx`** — small presentational banner component.

### Out of scope

- Multiple reminders per car (one only; multi is a future extension —
  PRD §14.6).
- "Upcoming"/lead-time pre-warning — Phase 3 is **binary** (banner when
  due/overdue, i.e. threshold crossed). A lead-margin "due soon" is a
  deferred refinement (note it; don't build).
- Push notifications (none — no service worker).
- Factory/VIN default schedules (none — user-set intervals).
- Changing the spend report, the fuel form, or the MPG pipeline.

---

## 4. Decisions locked

1. **One reminder per car**; config on the Car (`maintenanceReminder`).
2. **Derived baseline** — most-recent `resetsReminder == true`
   maintenance entry (latest by `date`, tiebreak `odometer`). No
   denormalized `lastDone`. No baseline yet → no banner.
3. **Reset via the modal checkbox**, default OFF, shown only when a
   reminder exists. (Owner V2 may later want the banner-tap flow to
   pre-check it — leave default OFF for now; flag as a V2 option.)
4. **Banner: due/overdue only** (binary, whichever-first across miles/
   months), log screen only, selected car, tappable → maintenance
   modal. No push. No banner when no reminder / no baseline / not due.
5. **`computeReminder` is pure**: inject `now` and `currentOdometer`
   (latest fuel odometer); never read the clock inside it.
6. **`currentOdometer`** = the latest fuel entry's `odometer` (from
   `entriesState`); null if no fuel entries → mileage-due can't be
   computed, time-due still can.
7. **Months arithmetic is local + tested** (rollover-safe), consistent
   with `dateField`.
8. No new deps; no push; no change to fuel/MPG/spend.

---

## 5. Architecture sketch

### 5.1 `computeReminder.ts`

```ts
export interface ReminderStatus {
  active: boolean;     // reminder configured AND a baseline exists
  due: boolean;        // active AND a threshold crossed
  label: string;
  overdueMiles: number | null;   // currentOdo - dueOdo, if mileage-due
  overdueDays: number | null;    // now - dueDate, if time-due
}

export function computeReminder(
  maintenanceNewestFirst: Maintenance[],
  reminder: MaintenanceReminder | null,
  currentOdometer: number | null,
  now: Date
): ReminderStatus;
```

- `reminder == null` → `{ active: false, due: false, ... }`.
- Baseline = the entry with `resetsReminder === true` and the latest
  `date` (tiebreak greater `odometer`). None → `active: false`.
- Mileage-due: `intervalMiles != null && currentOdometer != null &&
  currentOdometer >= baseline.odometer + intervalMiles`. `overdueMiles`
  = `currentOdometer - (baseline.odometer + intervalMiles)` (≥ 0 when
  due).
- Time-due: `intervalMonths != null && now >=
  addMonths(baseline.date, intervalMonths)`. `overdueDays` = whole days
  past.
- `due` = mileage-due OR time-due (whichever-first). `active` = true if
  reminder set AND baseline exists.
- Handle null `baseline.date` / null `currentOdometer` gracefully (skip
  that dimension; the other can still fire).
- **S3 — `addMonths(date, n)` CLAMPS to month-end**, not JS-native
  overflow: Jan 31 + 1mo → Feb 28/29 (valid due date), NOT Mar 3, and
  NOT null/reject (unlike `dateField`, which rejects overflow on
  *input* — `addMonths` must produce a usable date). Use local
  components with end-of-month clamping, e.g. build `new Date(y, mo+n,
  min(d, daysInMonth(y, mo+n)))` (or `new Date(y, mo+n+1, 0)` to get the
  last day when clamping). Local components only (consistent with
  `dateField`); `overdueDays` = `floor((now - dueDate) / 86_400_000)`
  (both are instants; DST gives at most a sub-day wobble that floor
  absorbs). Unit-test the rollover cases under the pinned non-UTC `TZ`.

### 5.2 Reminder config + the reset checkbox

- `setMaintenanceReminder(carId, reminder | null)` — `updateDoc(car,
  { maintenanceReminder: reminder })`. Mirror `renameCar`.
- Config modal (car-detail): label (text; sensible default e.g. "Oil
  change"; **N3 — add `validateReminderLabel`** mirroring
  `validateCarName` — trim, non-empty, max length), intervalMiles
  (NumericField, optional), intervalMonths (NumericField, optional),
  with **≥1 required** (disable Save otherwise), plus a "Remove
  reminder" action (writes null). Reuse `validateOdometer` (or an
  analogous positive-integer validator) for the intervals client-side
  (rules accept `is number`, but the client enforces integer-ness —
  same posture as odometer/SF4).
- `MaintenanceModal`: when the car has a reminder, show
  `☐ Reset [label]` (default OFF). Pass the entry's existing
  `resetsReminder` in edit mode. On save, include `resetsReminder` in
  the write. **S4 — BOTH write paths change**: `updateMaintenance`
  gains a `resetsReminder` param, AND `createMaintenance` gains an
  OPTIONAL `resetsReminder` param (default `false`) — it currently
  hardcodes `false` with no param, but the banner-tap opens the modal
  in CREATE mode, so create must be able to set it. (The create rule
  already permits `resetsReminder`; this is purely the client write
  path. Correct §6 accordingly — the create path DOES change,
  additively.)

### 5.3 Rules — Car update shape validation (pre-read folded)

**B2 — the existing rule applies `hasOnly` to
`request.resource.data.diff(resource.data).affectedKeys()`** (NOT
`request.resource.data.keys()`). So: change THAT line (currently
`...affectedKeys().hasOnly(['name','shareeEmails'])`) to
`.hasOnly(['name','shareeEmails','maintenanceReminder'])`, then append
the shape block below. `ownerUid`/`createdAt` stay immutable as a side
effect (they remain outside the affectedKeys set) — do not add a second
`keys().hasOnly`.

The reminder may be absent (rename/share writes), null (clearing), or a
map. **B1 — use `is number` + range, NOT `is int`** (the project's
deliberate convention — `firestore.rules` `validMaintNumbers` + the SF4
comment; the JS SDK may encode a whole number as a double, so `is int`
would reject a valid `intervalMiles: 3000` at runtime). **S1 — enforce
≥1 interval server-side** (one clause; matches the file's pin-the-shape
posture). Shape block:

```text
&& (
     !('maintenanceReminder' in request.resource.data)
  || request.resource.data.maintenanceReminder == null
  || (
       request.resource.data.maintenanceReminder.keys()
         .hasOnly(['label','intervalMiles','intervalMonths'])
    && request.resource.data.maintenanceReminder.label is string
    && (request.resource.data.maintenanceReminder.intervalMiles == null
        || (request.resource.data.maintenanceReminder.intervalMiles is number
            && request.resource.data.maintenanceReminder.intervalMiles > 0
            && request.resource.data.maintenanceReminder.intervalMiles < 100000000))
    && (request.resource.data.maintenanceReminder.intervalMonths == null
        || (request.resource.data.maintenanceReminder.intervalMonths is number
            && request.resource.data.maintenanceReminder.intervalMonths > 0
            && request.resource.data.maintenanceReminder.intervalMonths < 1200))
    && (request.resource.data.maintenanceReminder.intervalMiles != null
        || request.resource.data.maintenanceReminder.intervalMonths != null)
  )
)
```

`cars.test.ts` cases: owner sets a valid reminder (miles-only,
months-only, both); clears it (null); rejects a bad shape (extra key,
non-string label, both intervals null, a non-number interval). The
create path is unaffected (`validCarCreate` pins its own field set;
`createCar` never writes a reminder). Existing Car-update tests write
only name/shareeEmails (a subset) and have no `maintenanceReminder`, so
the absence-branch no-ops — they stay green.

### 5.4 Banner on LogFillupScreen

- Add `const { state: maintState } = useMaintenance(selectedCarId ?? '')`.
  **N2 — gate on `maintState.status === 'ready'`** (and
  `entriesState.status === 'ready'`) before calling `computeReminder`;
  an empty/error carId state must not feed the pure fn (mirror the
  MPG-tile ready gate).
- `selectedCar = state.cars.find(c => c.id === selectedCarId)` →
  `selectedCar?.maintenanceReminder`.
- **S2 — `currentOdometer` = the MAX `odometer` across the fuel
  entries**, not `entries[0]` (newest-*logged*). Entries sort by
  `loggedAt desc`, so a backdated/corrected fill could leave the
  newest-logged entry with a lower odometer and under-fire the banner.
  Odometer is monotonic, so `max` is the true current mileage. Null if
  no fuel entries (mileage-due then can't fire; time-due still can).
- `const status = computeReminder(maintState.maintenance,
  reminder, currentOdometer, new Date())` (the screen reads the clock
  and injects it).
- If `status.active && status.due` → render `<ReminderBanner>` (near
  the top of the screen), tappable → open a mounted `MaintenanceModal`
  in create mode for `selectedCarId`. The modal shows the reset
  checkbox (reminder is set). Default checkbox OFF (see Decision #3).
- No reminder / no baseline / not due → no banner; the log screen is
  exactly as today.

### 5.5 Banner copy

`[label] due` when just crossed; `[label] overdue by N mi` /
`overdue by N days` when past (show the crossed dimension; if both, show
the more-overdue one, or miles). Quiet, mobile-first, tappable; visually
a gentle nudge (amber-ish), not an error.

---

## 6. Files NOT to touch

- `src/entries/*`, the fuel log form's existing fields, the MPG/stat
  pipeline, `computeSpend`, `SpendReport`.
- `dateField.ts` (import only). `maintenance.ts` changes additively
  only: both `createMaintenance` and `updateMaintenance` gain a
  `resetsReminder` param (S4) — nothing else in that module moves.
- `PRD.md`, `AGENTS.md`, `BACKLOG.md`, config, `package.json`.

---

## 7. Acceptance criteria

- **D (data/rules)**: Car gains `maintenanceReminder`;
  `setMaintenanceReminder` sets/clears it; the Car update rule allows
  it with shape validation and rejects a malformed reminder; **all
  existing rules-tests still pass**; new cars.test.ts cases cover
  set / clear / bad-shape.
- **C (compute)**: `computeReminder` — inactive (no reminder / no
  baseline), mileage-due, time-due, whichever-first, overage values,
  null-odometer (time still fires), null-baseline-date handled.
  `addMonths` rollover-safe (Jan 31 + 1mo, Dec + 1mo → next year),
  LOCAL, tested under the pinned non-UTC `TZ`.
- **U (UI)**: car-detail shows + edits + clears the reminder; the
  maintenance modal shows the reset checkbox only when a reminder
  exists and writes `resetsReminder`; the log screen shows a tappable
  banner ONLY when configured + baseline + due; tapping opens the
  modal; a car with no reminder shows no banner (log screen unchanged).
- **V (verify)**: log a maintenance event with reset checked → it
  becomes the baseline; the banner clears until the next interval; a
  fuel fill crossing the mileage threshold re-fires the banner.
- **L (gates)**: `lint`, `lint:md`, `test`, `test:rules`, `build:dev`,
  `build:prod` all exit 0.
- **V2 (owner)**: set a reminder; log a reset; drive the odometer past
  the threshold via a fuel fill; confirm the banner appears on the log
  screen and taps through to the modal; clear the reminder → banner
  gone.

---

## 8. Stop-and-ask

- **Scope/size**: this is the biggest of the three phases (a rules
  change, two screens, a config UI, a modal change, two pure fns). If
  it's too large for one clean pre-read + V2, flag splitting into **3a**
  (data + rules + config + reset checkbox + `computeReminder`/tests)
  and **3b** (the log-screen banner + modal mount). Note 3a has little
  user value without 3b, so prefer one dispatch unless genuinely too
  big.
- If the Car-update reminder-shape rule (§5.3) can't be made sound
  without weakening an existing guarantee — STOP and surface it.
- The months-rollover convention (Jan 31 + 1 month) — surface the
  choice if ambiguous.

## 9. Model note

**Opus implementer.** It changes `firestore.rules` (the security
boundary — the Car update rule + reminder-shape validation) and carries
the derived-baseline + due-date math. The UI is mechanical, but the
rules + date math are the risk. Do not tier down without the pre-read
explicitly judging the rules change low-risk.
