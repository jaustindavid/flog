# Edit / delete entries — handoff

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

Matched to `dispatch/edit-delete-entries.md`. Gates green; the V2
owner deploy + manual test is owner-only (flagged, not run).

---

## Status

### R — Rules

- ✅ **R1** `update` rule moved from `if false` to
  `canMutate() && diff().affectedKeys().hasOnly(['odometer',
  'gallons','cost'])`. `canMutate()` defined in the entries `match`
  scope, reusing the existing `parentCar()` / `canReadParent()`.
- ✅ **R2** `delete` rule moved from owner-only to `canMutate()`.
- ✅ **R3** `loggedByUid` / `loggedAt` immutable on update — two
  negative rules tests (write that also includes each key → denied).
- ⚠️ **R4** Rules deploy is the owner V2 step (`deploy:rules:dev`),
  not run from dispatch. Rules compile clean under the emulator (all
  rules tests pass).

### D — Data module

- ✅ **D1** `entries.ts` exports `updateEntry(carId, entryId,
  {odometer,gallons,cost})` and `deleteEntry(carId, entryId)`. No
  inline entry writes anywhere else.
- ✅ **D2** `updateEntry` writes only the three numeric fields; never
  `loggedByUid`, never `loggedAt`.
- ✅ **D3** `deleteEntry` deletes the single entry doc; distinct from
  `deleteEntriesForCar` (the cascade helper, untouched).

### U — UI

- ✅ **U1** `EntriesTable` accepts optional `canEditEntry` +
  `onEditEntry`; editable rows are interactive (whole-row tap,
  `role="button"`, `tabIndex=0`, Enter/Space, `py-3` cells for ≥44pt,
  hover/active/focus-ring affordance). Non-editable rows render
  exactly as before. Columns/format/empty-state unchanged.
- ✅ **U2** `EditEntryModal` (new) pre-fills the three fields, reuses
  the M4 validators, Save disabled until valid, Save → `updateEntry`
  → parent refresh, inline "Couldn't save — try again". Mirrors
  AddCarModal a11y floor (autofocus first field, Esc, Cancel,
  backdrop-dismiss).
- ✅ **U3** Delete inside the modal → `ConfirmDialog` ("Delete this
  fill-up? This can't be undone.") → `deleteEntry` → parent refresh.
- ✅ **U4** `CarDetailScreen` wires the modal; `canEditEntry` is
  `isOwner || e.loggedByUid === user?.uid` (optional chaining per
  refinement #5). Save/delete call `refreshEntries()` (recomputes the
  3 MPG tiles + table).
- ✅ **U5** Mobile-first; ≥44pt; accent blue-600; Delete uses red
  (existing `text-red-600` / `destructive` ConfirmDialog tokens). No
  new accent tokens.

### T — Tests

- ✅ **T1** No new pure helpers; nothing to unit-test (validators
  already covered in M4).
- ✅ **T2** Update rules cases added — positives write the full
  three-field object (mirroring `updateEntry`): owner-edits-own,
  owner-edits-a-sharee's-entry, logger-sharee-edits-own. Negatives:
  sharee-edits-another's, outsider-edits, +loggedByUid denied,
  +loggedAt denied. Plus one labeled rule-property case
  (single-key `{cost}` → succeeds, documenting `hasOnly` subset).
- ✅ **T3** Delete rules cases: owner-deletes (kept green),
  logger-sharee-deletes-own (new positive), sharee-deletes-another's
  (new negative), outsider-deletes (negative).
- ✅ **T4** `npm test` → 80 passed. `npm run test:rules` → 53 passed.

### L — Lint + types

- ✅ **L1** `npm run lint` exits 0. No `any`; the modal catch is
  `catch (err: unknown)` (mirrors AddCarModal).
- ✅ **L2** `npm run lint:md` exits 0 (27 files).

### P — PRD

- ✅ **P1** §5.3 lifecycle amended (append-only → edit/delete;
  `loggedAt` not user-editable; destructive overwrite, no history),
  dated.
- ✅ **P2** §6.3 `update` + `delete` rows amended to owner-or-logger;
  `update` row notes the field restriction. **The 2026-05-28 "Note
  on the delete rule" block was also amended** with a dated follow-on
  so it no longer claims individual edit/delete is deferred. The
  prior M4-cascade paragraph is retained for history; the follow-on
  supersedes its "remains a post-v0 item" wording.
- ✅ **P3** §11.2 edit-semantics open question marked RESOLVED.

### V — Build / verification

- ✅ **V1** `build:dev` + `build:prod` exit 0. Bundle delta below.
- ⚠️ **V2** Owner manual test — NOT run (owner-only). Needs BOTH
  `npm run deploy:dev` AND `npm run deploy:rules:dev` (rules changed).
- ✅ **V3** No prod deploy.

---

## Versions chosen

None new. Reused `firebase/firestore` (`updateDoc` + `deleteDoc` are
new imports; `doc` was already imported for `deleteEntriesForCar`).
No `package.json` change.

## Assumptions made

- **Interactive-row pattern: whole-row tap** (Decision #4), not a
  trailing edit affordance. Editable `<tr>` gets `role="button"`,
  `tabIndex=0`, Enter/Space, and `py-3` cells (12px × 2 + ~16px
  line-height ≈ 40–44pt effective tap height). Non-editable rows keep
  `py-2`. At 412px the five short columns still fit without the
  overflow wrapper kicking in; the per-row affordance is the row's
  hover/active background + focus ring, so no extra column width is
  spent. Owner can override toward a trailing pencil affordance if
  the whole-row tap feels too easy to mis-tap.
- **Nested-Esc mechanism: don't-bind.** The EditEntryModal's window
  Esc `useEffect` early-returns (and its cleanup removes the
  listener) while `confirming` is true, so only the ConfirmDialog's
  Esc is live when it's open. Chosen over `stopPropagation` because
  it's local to one effect and leaves ConfirmDialog untouched (a
  file the brief says not to modify). The backdrop-dismiss is also
  gated on `!confirming` for the same reason.
- **Gallons/cost pre-fill uses `.toFixed(2)`** so an unedited field
  doesn't read as already-changed (matches the table's display
  precision). Odometer pre-fills as the raw integer string.
- **`canEditEntry` / `onEditEntry` are optional props** on
  EntriesTable (back-compat; a caller that omits them gets all-static
  rows). CarDetailScreen always passes both.

## Deviations from dispatch

None — followed the dispatch as written.

## Files created

- `src/components/EditEntryModal.tsx` — the edit/delete modal.

## Files modified

- `firestore.rules` — entries `update`/`delete` + `canMutate()`.
- `src/entries/entries.ts` — `updateEntry`, `deleteEntry`, two
  new imports.
- `src/components/EntriesTable.tsx` — tappable editable rows.
- `src/screens/CarDetailScreen.tsx` — modal state + wiring.
- `tests/rules/entries.test.ts` — update + delete cases.
- `PRD.md` — §5.3, §6.3 (table + note block), §11.2.

## Files NOT touched (confirmed)

- `AGENTS.md`, `BACKLOG.md`, `CUTTLEFISH-NAUTILUS.md`,
  `WORKING-MODEL.md`, `HANDOFF-TEMPLATE.md`, `README.md` — untouched.
- `src/entries/computeMpg.ts`, `useEntries.ts`, the validators,
  `NumericField`, `ConfirmDialog`, `AddCarModal`, all other
  components/screens — consumed/mirrored, not modified.
- `firestore.indexes.json` — unchanged (query unchanged; no index).
- All config, `package.json`, `.env.*`, `/public/*`, other
  `dispatch/*`, other `tests/rules/*` — untouched.

## Items deferred

### To the next dispatch

- **`loggedAt` editing** (owner Q2) — would need a date picker, MPG
  re-pairing on reorder, and an AGENTS/PRD guardrail amendment.
- **C (cars-screen kebab / bottom-sheet)** — if C introduces a real
  bottom-sheet primitive, `EditEntryModal` is a candidate to migrate
  to it for consistency (Decision #6 flagged this).

### To BACKLOG

- **Full focus-trap / ARIA on modals** — still the standing M3
  deferral; EditEntryModal inherits the same a11y floor (autofocus +
  Esc + Cancel), not a trap.

## Expected cost impact

Per edit/delete: ≥1 extra Firestore read from `parentCar()` in
`canMutate()` (the logger branch may evaluate it up to twice via
`canReadParent()`). Negligible at family scale; consistent with the
existing owner-delete rule. No new per-page reads on normal viewing —
the entries query is unchanged.

## Manual steps for the human owner

V2 (rules changed this dispatch, so BOTH deploys are required):

1. `npm run deploy:dev` — push the app bundle to `flog-dev`.
2. `npm run deploy:rules:dev` — push the new Firestore rules.
3. As owner: open a car with entries → tap a row → modal pre-filled →
   change odometer → Save → row + MPG tiles update; reload persists.
4. Edit gallons/cost; verify MPG recomputes. Delete an entry from the
   modal → confirm → row gone, tiles recompute, reload persists.
5. As a sharee (second account on a shared car): only your own logged
   rows are tappable; owner's rows static. Edit your own → works.
6. **Firestore Console**: confirm an edited entry's `loggedByUid` and
   `loggedAt` are UNCHANGED after an edit (only the numeric field
   changed). `updateEntry` writes exactly `{odometer,gallons,cost}`
   and the `hasOnly` rule rejects anything else, so both survive.

Note for **prod cutover**: this dispatch changes `firestore.rules`,
so the cutover must run `deploy:rules:prod` (not just `deploy:prod`).
Add to the cutover checklist.

## Notes for the next dispatch brief

- **`updateDoc` diff / `hasOnly` agreement confirmed via tests.**
  `updateEntry` writes exactly the three keys; Firestore's
  `affectedKeys()` reflects keys *written*, so the diff is always
  exactly `{odometer,gallons,cost}` and `hasOnly` of those three
  passes — even when a value is unchanged. The labeled single-key
  `{cost}` rules-property test plus the +loggedByUid / +loggedAt
  negatives pin this down. No surprise from the SDK including
  unchanged fields.
- **The 9 access cases the pre-read traced are exercised and pass**
  (see the breakdown in the implementer report): owner-edits-any,
  logger-edits-own, sharee-edits-others-denied, outsider-edits-
  denied, change-loggedByUid-denied, change-loggedAt-denied,
  owner-deletes, logger-deletes-own, sharee/outsider-deletes-denied.
- **Bundle delta** from the M5 baseline (680.96 KB / 178.77 KB gz):
  now **685.03 KB / 179.56 KB gz** — +4.07 KB raw / +0.79 KB gz, one
  modal + two helpers. Still a single chunk (the >500 KB warning is
  the pre-existing firebase-in-one-chunk note, unchanged by this
  dispatch).
