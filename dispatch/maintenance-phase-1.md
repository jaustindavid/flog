# Maintenance phase 1 — logging (CRUD + car-detail list)

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

**Status**: draft — pending pre-read by reviewer cuttlefish (per
WORKING-MODEL §3) before implementer dispatch.

The authoritative design is **PRD §14** (Maintenance phase). This brief
implements **Phase 1 only** (logging). Phase 2 (spend reporting) and
Phase 3 (reminders) are out of scope and have their own dispatches.

---

## 1. Context

flog logs fuel fill-ups and computes MPG/range stats. The Maintenance
phase extends it to also track maintenance/service events (oil changes,
brakes, registration, etc.) and, later, spend reporting + reminders.

**Phase 1 ships a real, standalone maintenance log**: create / view /
edit / delete maintenance entries on a car, in a **new collection kept
separate from fuel `entries`**. The separate-collection decision is
load-bearing and final (PRD §14 intro): fuel `entries` stays the pure
MPG stream — the stat pipeline, the P1 validation rules, and
gap-detection all assume every entry is a full fuel fill-up. Maintenance
gets its own collection, its own module, its own rules.

What Phase 1 does NOT do: no spend report (Phase 2), no reminder config
/ banner / reset-checkbox (Phase 3). The `resetsReminder` field IS
written (default `false`) so Phase 3 can light it up without a schema
migration, but no UI exposes it in Phase 1.

---

## 2. Required reading

The whole point of Phase 1 is **mirror the fuel patterns** for a new
entity. Read these as templates, then build the parallel:

1. **PRD §14** — the design (esp. §14.1 data model, §14.2 access
   control, §14.5 placement, §14.7 phasing).
2. `src/entries/entries.ts` — the data-module template (create / list /
   update / delete / deleteForCar cascade; `loggedAt` always
   `serverTimestamp()`; does NOT import from `../cars` to avoid a
   circular dep). The maintenance module mirrors this shape.
3. `src/entries/useEntries.ts` — the per-car fetch hook template.
4. `src/components/EditEntryModal.tsx` — the edit+delete modal template
   (validation, save, delete-with-confirm).
5. `src/components/EntriesTable.tsx` — the per-car list template
   (tappable rows → open the edit modal).
6. `src/entries/validateOdometer.ts`, `validateCost.ts` (+ their
   `.test.ts`) — reuse these for maintenance odometer/cost; mirror the
   test style for a new note validator.
7. `src/components/NumericField.tsx` — reusable numeric input; reuse for
   odometer + cost.
8. `src/screens/CarDetailScreen.tsx` — where the new Maintenance section
   mounts (above the Fill-ups section). Note how the Fill-ups section
   wires `useEntries` + `EntriesTable` + `EditEntryModal` + `refresh`.
9. `src/cars/cars.ts` — `deleteCar` cascade (currently entries-only);
   Phase 1 adds the maintenance cascade.
10. `firestore.rules` — the `cars/{carId}/entries` block + its
    `parentCar()` / `canReadParent()` / `canMutate()` helpers, and the
    P1 field-validation idiom (`hasOnly`, type/range,
    `loggedAt == request.time`). The maintenance rules mirror these.
11. `tests/rules/entries.test.ts` — the rules-test template
    (`withSecurityRulesDisabled` seeding, `assertSucceeds`/`assertFails`,
    the P1 validation negatives). Mirror for maintenance.
12. `AGENTS.md` — no `any`, pure fns unit-tested, one write path per
    entity, no new deps.

---

## 3. Scope

### Decision S1 (scope) — **full CRUD in one dispatch** ⚑ owner-confirm

Phase 1 = create + list + **edit + delete**, via a single create-or-edit
modal. Rationale: the edit/delete patterns (EditEntryModal, tappable
EntriesTable rows, the update/delete rules) all exist now, so mirroring
them is cheap; a maintenance log you can't correct is a half-feature
(cost/note typos are at least as likely as odometer typos). The
fuel-side create-then-editdelete split was historical (those patterns
didn't exist at M4 time), not a design preference. **Lighter
alternative if the owner prefers**: create + list only, with edit/delete
as a Phase-1b fast-follow. Flagged; default is full CRUD.

### In scope

- **`src/maintenance/maintenance.ts`** (new) — data module:
  `createMaintenance`, `listMaintenanceForCar`, `updateMaintenance`,
  `deleteMaintenance`, `deleteMaintenanceForCar` (cascade). Mirrors
  `entries.ts`. MUST NOT import from `../cars` (circular-dep guard,
  like entries.ts).
- **`src/maintenance/useMaintenance.ts`** (new) — per-car fetch hook,
  mirrors `useEntries`.
- **`src/maintenance/validateNote.ts`** (+ `.test.ts`) — required,
  trimmed-non-empty, max length (mirror `validateCarName` style; cap
  280). Reuse `validateOdometer` / `validateCost` from `src/entries/`
  for those fields (do not duplicate).
- **`src/components/MaintenanceModal.tsx`** (new) — create-or-edit modal
  (no entry → create; entry → edit), with delete-with-confirm in edit
  mode. Fields: **date** (`<input type="date">`, default today),
  **odometer** (NumericField, required), **cost** (NumericField,
  required), **note** (text input, required). Mirrors EditEntryModal +
  a create mode.
- **`src/components/MaintenanceTable.tsx`** (new) — per-car list;
  columns date / odometer / cost / note; tappable rows open the modal in
  edit mode. Mirrors EntriesTable.
- **`src/screens/CarDetailScreen.tsx`** (modified) — a new
  **Maintenance** `<section>` ABOVE the Fill-ups section: a "Log
  maintenance" button (opens the modal in create mode) + the
  MaintenanceTable + an empty state. Wires `useMaintenance` + refresh,
  mirroring the Fill-ups wiring.
- **`src/cars/cars.ts`** (modified) — `deleteCar` also calls
  `deleteMaintenanceForCar(carId)` so car-delete cascades both
  collections (no orphans).
- **`firestore.rules`** (modified) — a new
  `match /cars/{carId}/maintenance/{maintId}` block (read/create/update/
  delete) with P1-style field validation. See §7.4 for the
  helper-scoping decision.
- **`tests/rules/maintenance.test.ts`** (new) — authz + validation,
  mirrors `entries.test.ts`.

### Out of scope (later phases / defer)

- Spend reporting / the 3×3 (Phase 2, PRD §14.4).
- Reminder config, the fuel-screen banner, the reset-checkbox (Phase 3,
  PRD §14.3/§14.5). `resetsReminder` is written `false` but NOT exposed.
- Categories (PRD §14.6 — deliberately none; `note` carries meaning).
- Merged fuel+maintenance timeline (a display nicety, not Phase 1).
- Touching `entries.ts`, the fuel log form, the MPG/stat pipeline.

---

## 4. Decisions locked

1. **Separate `maintenance` subcollection** — `cars/{carId}/
   maintenance/{maintId}`. Fuel `entries` untouched. (PRD §14 intro.)
2. **Full CRUD** (Decision S1) — owner-confirm; default yes.
3. **One create-or-edit modal** (`MaintenanceModal`), not two modals.
4. **`date` is user-set and backdatable** — `<input type="date">`,
   default today, parsed to a Firestore `Timestamp` at submit. It is
   NOT `serverTimestamp()` and NOT pinned to `request.time` in rules
   (backdating real service dates is the point). `loggedAt` remains the
   server-set audit timestamp.
5. **`note` required**, trimmed-non-empty (owner: with no category, the
   note carries the entry's meaning; an unlabeled cost ages badly).
6. **`odometer` required**, **`cost` required**. Reuse the fuel numeric
   validators + the same rule ranges as the P1 entry rules.
7. **`resetsReminder` written `false`, no UI** (Phase 3 lights it up).
8. **Maintenance section sits ABOVE Fill-ups** on car-detail (PRD §14.5).
9. **Car-delete cascades maintenance** (cars.ts).
10. **No new dependencies** (native date input).

---

## 5. Files in play

```text
flog/
├── src/
│   ├── maintenance/                    (new dir, mirrors entries/)
│   │   ├── maintenance.ts               (new — data module)
│   │   ├── useMaintenance.ts            (new — fetch hook)
│   │   ├── validateNote.ts              (new)
│   │   └── validateNote.test.ts         (new)
│   ├── components/
│   │   ├── MaintenanceModal.tsx          (new — create-or-edit)
│   │   └── MaintenanceTable.tsx          (new — per-car list)
│   ├── screens/
│   │   └── CarDetailScreen.tsx           (modified — new section)
│   └── cars/
│       └── cars.ts                       (modified — delete cascade)
├── firestore.rules                       (modified — maintenance block)
└── tests/rules/
    └── maintenance.test.ts               (new)
```

Handoff at `dispatch/maintenance-phase-1-handoff.md`.

---

## 6. Files NOT to touch

- `src/entries/*` — import `validateOdometer` / `validateCost` only; do
  NOT edit. The fuel stream + MPG/stat pipeline stay exactly as-is.
- The fuel log form (`LogFillupScreen`), `MpgTile`, `StatRow`,
  `computeMpg`, `computeStats`.
- `PRD.md`, `AGENTS.md`, `BACKLOG.md`, README, LICENSE, the
  working-model/kit docs.
- `.env.*`, `firebase.json`, `package.json` (no new deps), `/public/*`,
  `scripts/*`.

---

## 7. Architecture sketch

### 7.1 Data shape (`maintenance.ts`)

```ts
export interface Maintenance {
  id: string;
  loggedByUid: string;
  date: Timestamp | null;   // service date (user-set, backdatable)
  odometer: number;
  cost: number;
  note: string;
  resetsReminder: boolean;  // Phase 3; always false in Phase 1 writes
  loggedAt: Timestamp | null; // server-set audit
}
```

- `createMaintenance(carId, { date, odometer, cost, note }, loggedByUid)`
  writes `{ ...fields, resetsReminder: false, loggedByUid,
  loggedAt: serverTimestamp() }`. `date` is a `Timestamp` the caller
  built from the date input (see §7.3).
- **SF2 — `date` is always a concrete `Timestamp` on write**, never a
  server sentinel (unlike `loggedAt`). The `| null` in the interface
  exists ONLY for the read mapping (`toMaintenance`) to defensively
  coalesce a hand-edited bad doc, mirroring `toEntry`'s `loggedAt`.
  Type the create/update input `date` as a non-null `Timestamp`; do NOT
  write a null `date` (the rule's `date is timestamp` would deny it).
- `listMaintenanceForCar(carId)` — `orderBy('date', 'desc')`, all docs
  (family scale; no cap, mirroring the M5 entries decision). **N1 —
  order by `date` (service date) is DELIBERATE**; do NOT reflexively
  copy `entries.ts`'s `orderBy('loggedAt')`. A maintenance log reads by
  when the service happened, and `date` is backdatable. Same-day ties
  (local-midnight `date`s) have undefined relative order — fine for a
  log; don't depend on intra-day ordering anywhere.
- `updateMaintenance(carId, id, { date, odometer, cost, note })` —
  writes ONLY those four; never `loggedByUid` / `loggedAt` /
  `resetsReminder`.
- `deleteMaintenance(carId, id)`.
- `deleteMaintenanceForCar(carId)` — batch-delete the subcollection
  (mirror `deleteEntriesForCar`, 500-chunked).

### 7.2 Car-delete cascade (`cars.ts`)

`deleteCar` currently: `deleteEntriesForCar` → `deleteDoc(car)`. Add
`deleteMaintenanceForCar(carId)` before the car delete (entries +
maintenance both cleared, then the car). Import it from
`../maintenance/maintenance` (maintenance.ts must not import cars — same
acyclic direction as entries).

### 7.3 Date handling — LOCAL-midnight convention (SF3, load-bearing)

`<input type="date">` yields a local `YYYY-MM-DD` string. The trap:
`new Date('2026-01-01')` parses as **UTC** midnight, which in any
US timezone renders back as the *previous day* on edit AND can bucket a
Jan-1/Dec-31 service date into the wrong calendar year (Phase 2 reports
by calendar year of `date` — PRD §14.4). **Mandatory convention:**

- **input → Timestamp**: build the Date from explicit LOCAL components:
  `const [y, mo, d] = s.split('-').map(Number);`
  `Timestamp.fromDate(new Date(y, mo - 1, d));` — local midnight.
- **Timestamp → input**: format via LOCAL getters:
  `` `${y}-${pad(mo)}-${pad(d)}` `` from `getFullYear/getMonth/getDate`.
  **NEVER `toISOString().slice(0,10)`** — that's UTC and reintroduces
  the bug.

Put the pair (`dateInputToTimestamp` / `timestampToDateInput`) in a pure
`src/maintenance/dateField.ts` and **unit-test round-trip stability for
a year-boundary date (e.g. `2026-01-01`) — the test must pass under a
non-UTC `TZ`** (the helper must be tz-correct by construction, using
local components, so it passes regardless of `TZ`). Default the input
to today (also via local getters).

### 7.4 Rules — helper scoping ⚑ pre-read please validate

The entries rules define `parentCar()`, `canReadParent()`,
`canMutate()` INSIDE the `entries` match block. Maintenance needs the
same authz. **Recommended**: lift these three helpers UP one scope to
the `match /cars/{carId}` block so both `entries` and `maintenance`
subcollections share them (they're car-level concepts; `canMutate`'s
logic — parent-owner OR logger-with-read-access — is identical for both,
since maintenance also has `loggedByUid`). This is a small refactor:
move the function definitions, leave behavior identical, **all existing
entries rules-tests must stay green**. Alternative: duplicate the three
helpers in the maintenance block (more rules, no entries-block change).
Pre-read to confirm the lift is clean (watch `canMutate`'s
`resource.data.loggedByUid` reference — valid for both subcollections).

Maintenance rules (P1 idiom), assuming lifted helpers:

```text
match /maintenance/{maintId} {
  function validMaintNumbers(d) {
    return d.odometer is number && d.odometer >= 0
             && d.odometer < 100000000
        && d.cost is number && d.cost >= 0 && d.cost < 100000000;
  }
  allow read: if canReadParent();
  allow create: if canReadParent()
    && request.resource.data.keys().hasOnly(['loggedByUid','date',
         'odometer','cost','note','resetsReminder','loggedAt'])
    && request.resource.data.loggedByUid == request.auth.uid
    && request.resource.data.date is timestamp        // NOT request.time
    && request.resource.data.note is string
    && request.resource.data.note.size() > 0
    && request.resource.data.resetsReminder is bool
    && request.resource.data.loggedAt == request.time
    && validMaintNumbers(request.resource.data);
  allow update: if canMutate()
    && request.resource.data.diff(resource.data).affectedKeys()
         .hasOnly(['date','odometer','cost','note','resetsReminder'])
    && request.resource.data.date is timestamp
    && request.resource.data.note is string
    && request.resource.data.note.size() > 0
    && request.resource.data.resetsReminder is bool   // SF1: re-validate
    && validMaintNumbers(request.resource.data);
  allow delete: if canMutate();
}
```

(`resetsReminder` is in the update allow-set so Phase 3's checkbox can
flip it without a rules change; Phase 1's modal just never touches it.)

**SF4 — integer posture**: `validMaintNumbers` checks `is number` (not
`is int`), DELIBERATELY mirroring the entries rules (which dodge the
int-vs-double SDK-encoding trap and let the client enforce integer-ness
for UX). Reuse `validateOdometer` (which DOES reject decimals) in
`MaintenanceModal` so the client posture matches entries. Do NOT add
`is int` to the rule — it would diverge from the entries idiom.

### 7.5 UI

- **MaintenanceModal**: mirror EditEntryModal. Create mode (no entry):
  empty fields, date=today, "Log maintenance" title, Save. Edit mode
  (entry passed): prefilled, Save + Delete (ConfirmDialog). Validate
  with `validateOdometer` / `validateCost` / `validateNote`; disable
  Save until valid. On success, call the parent's `refresh` + close.
- **MaintenanceTable**: mirror EntriesTable; rows show date / odometer /
  cost / note; tap a row → modal edit mode. **N2 — the table owns its
  empty state** ("No maintenance logged yet."), exactly like
  EntriesTable's "No fill-ups yet." — do NOT also render a section-level
  empty state (pick one; mirror the template). **N3 — truncate the note
  cell** with Tailwind `max-w-…` + `truncate` so a long note doesn't
  blow out the row.
- **CarDetailScreen**: new `<section>` above Fill-ups —
  `<h2>Maintenance</h2>`, a "Log maintenance" button, then the
  MaintenanceTable (which renders its own empty state). Wire
  `useMaintenance(carId)` + `refresh`, mount one `MaintenanceModal`
  controlled by open-state + the selected entry (mirror how Fill-ups
  controls EditEntryModal).

---

## 8. Acceptance criteria

- **S (schema/module)**: `maintenance.ts` create/list/update/delete/
  cascade work; `loggedAt` server-set; update writes only the four
  editable fields; `date` round-trips (input → Timestamp → input).
- **R (rules)**: maintenance read/create/update/delete gated to parent
  owner-or-current-sharee; create pins the field set + types + ranges +
  `loggedAt==request.time`; `date` accepts a backdated timestamp;
  `note` non-empty enforced; `loggedByUid`/`loggedAt` immutable on
  update. **All existing entries/cars/users rules-tests still pass** (the
  §7.4 helper lift must not regress them).
- **T (tests)**: `maintenance.test.ts` covers the authz matrix (owner/
  sharee/outsider × read/create/update/delete) + validation negatives
  (extra field, bad type, negative, missing/empty note, forged
  `loggedAt`, **and a non-bool `resetsReminder` on update is denied**
  — SF1). `validateNote.test.ts` passes; **the date-helper test asserts
  a year-boundary date (`2026-01-01`) round-trips unchanged under a
  non-UTC `TZ`** (SF3).
- **U (UI)**: car-detail shows a Maintenance section above Fill-ups;
  "Log maintenance" opens the create modal; saving adds a row; tapping a
  row edits; delete removes it (with confirm); empty state when none.
- **V (verify)**: deleting a car removes its maintenance docs (cascade).
  Fuel logging + MPG stats are visibly unchanged.
- **L (gates)**: `lint`, `lint:md`, `test`, `test:rules`, `build:dev`,
  `build:prod` all exit 0.
- **V2 (owner)**: log a maintenance event on dev (backdated), edit it,
  delete it; confirm the fuel screen + MPG are untouched; confirm a
  car-delete cleans up maintenance.

---

## 9. Stop-and-ask

- If lifting the rules helpers (§7.4) turns out to break any existing
  entries test in a non-obvious way — stop and surface it rather than
  weakening an existing rule.
- If the date round-trip has a timezone foot-gun (input is local,
  Timestamp is UTC) that risks off-by-one-day — surface the chosen
  convention.
- If Decision S1 (full CRUD) makes the dispatch feel too large for one
  clean pre-read + V2 — flag splitting edit/delete into Phase 1b.
- Anything requiring a new dependency — stop (none should be needed).

---

## 10. Model note

Likely an **Opus** implementer: it touches `firestore.rules` (the
security boundary) and a cross-cutting rules-helper refactor (§7.4),
which is exactly the rules/data-model work that stays Opus per the
model-tiering rule. The UI/module parts are mechanical mirrors, but the
rules refactor + its test parity carry the risk, so don't tier this
down to Sonnet without the pre-read explicitly judging the rules change
low-risk.
