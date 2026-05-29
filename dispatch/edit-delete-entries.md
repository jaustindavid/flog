# Edit / delete entries

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

**Status**: draft — pending pre-read by reviewer cuttlefish (per
WORKING-MODEL §3) before implementer dispatch.

---

## 1. Context

The first capability dispatch after the v0 codebase completed
(M1–M5 on `flog-dev`). Owner named edit/delete entries during the
PRD interview as the first post-v0 capability (PRD §1.3, §11.2).
It deliberately breaks the v0 "append-only" stance.

It's the feature that matters when someone fat-fingers an
odometer at the pump: today there's no in-app fix; you'd edit the
Firestore doc by hand. After this, an entry's three numeric
fields are editable, and an entry can be deleted, from the
per-car entries table.

What this dispatch does:

- Adds `updateEntry()` + `deleteEntry()` to the entries module
  (single write path, mirroring `createEntry`).
- Relaxes the entries `update` rule (currently `if false`) and
  extends the `delete` rule to the agreed access model.
- Makes editable rows in the M5 `EntriesTable` tappable → opens
  an edit modal (reuses M4 `NumericField` + validators) with
  Save + Delete.
- Wires the modal into `CarDetailScreen` (which owns the entries
  state + refresh).
- Amends PRD §5.3 / §6.3 / §11.2 per "ink not stone."

What this dispatch does NOT do:

- **`loggedAt` is not editable** (owner Q2, 2026-05-29). Edit
  touches odometer/gallons/cost only; the timestamp stays
  server-set. Preserves MPG ordering integrity and the AGENTS
  "loggedAt always serverTimestamp" guardrail. Date-editing is a
  later item if demand surfaces.
- **No audit trail / edit history** (owner Q3). Destructive
  overwrite; no "who changed this" tracking. YAGNI at family
  scale.
- No CSV import/export (separate dispatches).
- No cars-screen kebab (C, deferred).
- No new bottom-sheet primitive — the edit surface reuses the
  existing M3 modal pattern (see Decision #6).

---

## 2. Required reading

In order:

1. `PRD.md` §1.3 (deferred list), §5.3 (Entry shape +
   lifecycle — being amended), §6.3 (Entry rules — being
   amended), §7 Flow F (per-car detail; the edit surface lives
   here), §11.2 (edit-semantics open questions — being
   resolved), §9 (UI).
2. `AGENTS.md` — full read. Especially "`loggedAt` is always a
   server timestamp" (edit must NOT touch it), the one-write-
   path posture, no-`any`, and the Firestore-rules-tests gate.
3. `WORKING-MODEL.md` §3, §5, §6.
4. `HANDOFF-TEMPLATE.md`.
5. `dispatch/M5-mpg-and-entries-handoff.md` — `EntriesTable`,
   `useEntries`, `computeMpg`, and the CarDetailScreen
   integration this dispatch extends.
6. `dispatch/M4-entries-handoff.md` — `createEntry`,
   `NumericField`, `validateOdometer/Gallons/Cost`, the
   single-write-path pattern, the entries-delete rule M4 added
   (which this dispatch extends).
7. Current `firestore.rules` (entries block), current
   `src/entries/entries.ts`, current
   `src/components/EntriesTable.tsx`, current
   `src/screens/CarDetailScreen.tsx`, current
   `src/components/AddCarModal.tsx` + `ConfirmDialog.tsx` (the
   modal pattern the edit modal mirrors).

---

## 3. Scope

### In scope

- **`src/entries/entries.ts`** — two new exports (single write
  path; no inline writes elsewhere):
  - `updateEntry(carId, entryId, fields)` where `fields` is
    `{ odometer: number; gallons: number; cost: number }`.
    `updateDoc` on `cars/{carId}/entries/{entryId}` setting only
    those three fields. Does NOT touch `loggedByUid` or
    `loggedAt`.
  - `deleteEntry(carId, entryId)` — `deleteDoc` on the single
    entry. (Distinct from the existing `deleteEntriesForCar`
    cascade helper.)
- **`firestore.rules`** — entries block:
  - `update` rule: from `if false` to permit edit by
    **owner-of-parent-car OR the original logger (currently with
    read access)**, AND restrict mutable fields to
    odometer/gallons/cost. See §7.1 for the exact rule.
  - `delete` rule: extend from owner-only to **owner-of-parent-
    car OR the original logger (currently with read access)**.
    See §7.1.
- **`tests/rules/entries.test.ts`** — new + extended cases (see
  §8 T*).
- **`src/components/EditEntryModal.tsx`** (new) — modal styled
  after `AddCarModal`, pre-filled with the entry's current
  odometer/gallons/cost (three `NumericField`s), a Save button,
  and a Delete button (Delete routes through the existing
  `ConfirmDialog`). Reuses `validateOdometer/Gallons/Cost`.
- **`src/components/EntriesTable.tsx`** — editable rows become
  tappable (a `<button>`-wrapped row or a row click handler)
  with a subtle affordance; tap fires an `onEditEntry(entry)`
  callback. Non-editable rows stay static. The table receives
  enough context to know which rows are editable (see §7.3).
- **`src/screens/CarDetailScreen.tsx`** — owns the edit modal
  state; passes editability + `onEditEntry` to `EntriesTable`;
  on Save calls `updateEntry` then `refreshEntries()`; on
  Delete calls `deleteEntry` then `refreshEntries()`. Both also
  refresh the MPG tiles (same `useEntries` state already on the
  screen).
- **PRD amendments** (per "ink not stone"):
  - **§5.3** lifecycle line: from "append-only in v0 (no edit,
    no delete; deferred to Soon)" to edit/delete now supported
    (odometer/gallons/cost editable; `loggedAt` still not
    user-editable; destructive overwrite, no history). Dated
    note.
  - **§6.3** table: `update` row from "none in v0 (deferred to
    Soon)" → the new owner-or-logger rule with field
    restriction; `delete` row from its M4 "parent car owner
    only (for cascade)" wording → owner-or-logger. **AND
    amend the existing 2026-05-28 "Note on the delete rule"
    block (PRD §6.3, ~lines 287-299)** — it currently states
    "individual-entry edit/delete by any user remains a
    post-v0 BACKLOG → Soon item," which this dispatch
    contradicts. Add a dated follow-on note that this dispatch
    delivered individual edit/delete (owner-or-logger,
    overwrite, `loggedAt` not editable). Without this, the PRD
    self-contradicts (note says deferred; table says shipped).
  - **§11.2** edit-semantics open questions → marked resolved
    (who = owner-or-logger; overwrite not audit; `loggedAt` not
    editable in this pass).

### Out of scope (defer)

- **`loggedAt` editing** (owner Q2). Note as a follow-up
  candidate if demand surfaces; would need a date picker, MPG
  re-pairing on reorder, and an AGENTS/PRD guardrail amendment.
- **Audit trail / edit history** (owner Q3). Destructive
  overwrite only.
- **Monotonicity warning on edit.** The create flow warns on
  odometer-down (PRD §7 Flow C). On edit the user is in a
  deliberate correction context, looking at the data; the MPG
  column already renders "—" for any negative-delta row as
  immediate feedback. No modal warning on edit — simpler, and
  avoids the two-neighbor check complexity. (Type/sign
  validation still applies via the reused validators.)
- **Bulk edit / multi-select.** One entry at a time.
- **Undo / soft-delete / trash.** Delete is immediate
  (behind a confirm). No restore.
- **Cars-screen kebab (C), CSV (D), charts, dark mode** —
  separate items.

---

## 4. Decisions locked in (design conversation 2026-05-29)

1. **Access model (Q1)**: parent-car **owner can edit/delete
   any entry on their car**; a **sharee can edit/delete only
   entries they logged** (`loggedByUid == them`), and only while
   they still have read access to the car. Extends M4's
   owner-delete rule.
2. **`loggedAt` not editable (Q2)**: edit the three numeric
   fields only. Timestamp stays server-set. Date-editing
   deferred.
3. **Destructive overwrite, no audit trail (Q3)**.
4. **Tap-row-to-edit (Q4)**: tap an editable row in the
   per-car `EntriesTable` → edit modal. No per-row kebab; no
   separate edit screen.
5. **Same validators as create**: reuse `validateOdometer/
   Gallons/Cost`. No monotonicity warning on edit (see
   out-of-scope).
6. **Edit surface = modal in the M3 style** (mirrors
   `AddCarModal`), NOT a new bottom-sheet. Rationale: the
   bottom-sheet primitive belongs to the deferred C dispatch;
   E shouldn't invent it. Reusing the existing modal pattern is
   lower-risk and visually consistent with the app's other
   modals (AddCarModal, ConfirmDialog). If C later introduces a
   bottom-sheet, a future cleanup can unify. Nautilus call,
   2026-05-29; flag at review if owner prefers otherwise.
7. **Delete lives inside the edit modal** (a Delete button that
   routes through `ConfirmDialog`), not as a separate row
   affordance. One surface for both edit and delete of an
   entry.
8. **Refresh after edit/delete**: re-fetch entries
   (epoch-guarded `useEntries.refresh`), which recomputes the
   MPG tiles + per-row MPG. Since `loggedAt` is immutable, only
   values change, never ordering — no re-pairing complexity.
9. **Opus implementer** (not Sonnet). This dispatch changes
   `firestore.rules` — the highest-blast-radius, thinnest-gate-
   coverage surface. Rules bugs are expensive (silent
   over-permission) and the access model has real subtlety
   (owner-or-logger + field immutability + current-read-access).
10. **Pre-read required** (WORKING-MODEL §3).

---

## 5. Files in play

```text
flog/
├── PRD.md                                  (modified — §5.3, §6.3, §11.2)
├── firestore.rules                         (modified — entries update + delete)
├── src/
│   ├── entries/
│   │   └── entries.ts                      (modified — updateEntry, deleteEntry)
│   ├── components/
│   │   ├── EditEntryModal.tsx              (new)
│   │   └── EntriesTable.tsx                (modified — editable rows tappable)
│   └── screens/
│       └── CarDetailScreen.tsx             (modified — modal wiring)
└── tests/
    └── rules/
        └── entries.test.ts                 (modified — update + delete tests)
```

Handoff at `dispatch/edit-delete-entries-handoff.md`.

---

## 6. Files NOT to touch

- `AGENTS.md`, `BACKLOG.md`, `CUTTLEFISH-NAUTILUS.md`,
  `WORKING-MODEL.md`, `HANDOFF-TEMPLATE.md`, `README.md`
- All other `dispatch/*` (closed; this brief is the active one)
- `dispatch/assets/*`
- `src/entries/computeMpg.ts` + its test — unchanged (edit
  changes values; the pure MPG helpers don't change). The
  tiles/table recompute automatically on refresh.
- `src/entries/useEntries.ts` — unchanged (its `refresh` is
  reused as-is).
- `src/components/NumericField.tsx`, `ConfirmDialog.tsx`,
  `MpgTile.tsx`, `CarPickerChips.tsx`, `Header.tsx`,
  `AddCarModal.tsx`, `ShareForm.tsx`, `SharedWithList.tsx`,
  `RenameCarForm.tsx`, `CarListItem.tsx` — consumed/referenced,
  not modified. (EditEntryModal *mirrors* AddCarModal's pattern
  but is a new file; don't edit AddCarModal.)
- `src/entries/validateOdometer.ts` / `validateGallons.ts` /
  `validateCost.ts` (+ tests) — reused unchanged.
- `src/screens/LogFillupScreen.tsx`, `CarListScreen.tsx`, the
  M2 auth screens — unchanged.
- `src/cars/*`, `src/auth/*`, `src/firebase/*`, `src/lib/*`
- `tests/rules/{users,cars,allowlist}.test.ts` — only
  `entries.test.ts` changes.
- `firestore.indexes.json` — the entries query is unchanged
  (still `orderBy loggedAt desc`); no new index. (If the
  implementer believes an index is needed, that's a
  stop-and-ask — it shouldn't be.)
- All config files, `package.json`, `.env.*`, `/public/*`.

---

## 7. Architecture sketch

### 7.1 Rules — the load-bearing part

Current entries block (M4-shipped):

```text
allow update: if false;
allow delete: if request.auth != null
                 && parentCar().ownerUid == request.auth.uid;
```

New shape. `parentCar()` and `canReadParent()` helpers already
exist in the entries `match` scope — reuse them.

```text
// Owner of the parent car may edit/delete ANY entry on it.
// The original logger may edit/delete their OWN entry, but only
// while they still have read access to the car (canReadParent()
// closes the unshared-former-sharee hole — a removed sharee
// can't reach back and mutate their old entries).
function canMutate() {
  return parentCar().ownerUid == request.auth.uid
      || (canReadParent()
          && resource.data.loggedByUid == request.auth.uid);
}

allow update: if canMutate()
                 && request.resource.data.diff(resource.data)
                      .affectedKeys()
                      .hasOnly(['odometer', 'gallons', 'cost']);

allow delete: if canMutate();
```

Notes:

- **Null-safety** (corrected per pre-read): the owner branch
  `parentCar().ownerUid == request.auth.uid` is safe on an
  unauthenticated request because `request.auth.uid` is then
  `null` and `parentCar().ownerUid == null` is `false` — so an
  unauth caller falls through to the logger branch, where
  `canReadParent()`'s own `request.auth != null` check denies.
  (The owner branch's safety does NOT come from
  `canReadParent()` — that helper only guards the logger
  branch. Stating this precisely so a future reader doesn't
  build on a wrong premise.)
- **Cost**: `parentCar()` is a `get()` (one billed read).
  After this change, every entry `update`/`delete` incurs ≥1
  `parentCar()` read (the logger branch may evaluate it up to
  twice via `canReadParent()`). Negligible at family scale and
  consistent with the existing owner-delete rule; noted for
  PRD §8 completeness, not a concern.
- The `hasOnly(['odometer','gallons','cost'])` guard makes
  `loggedByUid` and `loggedAt` immutable on update — the same
  field-restriction idiom M2 used for the User-doc
  `displayName`. A client trying to also change `loggedByUid`
  (e.g., reassign authorship) has those keys in the diff →
  `hasOnly` fails → denied.
- `hasOnly` permits a subset. **But note `updateEntry` always
  writes all three fields**, so in practice the diff's
  affectedKeys is always exactly `{odometer, gallons, cost}`,
  never a strict subset — Firestore's `affectedKeys()` reflects
  keys *written*, not keys whose *value changed*. `hasOnly` of
  the three permits exactly-the-three, so it passes. (The
  subset-permitted property is real at the rule level but the
  app never exercises it — see T2 note.) An update touching
  `loggedAt` or `loggedByUid` fails.
- Define `canMutate()` inside the entries `match` block
  alongside `parentCar()` / `canReadParent()`.

### 7.2 entries.ts helpers

```ts
import {
  // ...existing imports...
  deleteDoc,
  doc,
  updateDoc,
} from 'firebase/firestore';
// (doc is already imported for deleteEntriesForCar; add
//  updateDoc + deleteDoc.)

export async function updateEntry(
  carId: string,
  entryId: string,
  fields: { odometer: number; gallons: number; cost: number }
): Promise<void> {
  await updateDoc(doc(firestore, 'cars', carId, 'entries', entryId), {
    odometer: fields.odometer,
    gallons: fields.gallons,
    cost: fields.cost,
    // NOT loggedByUid, NOT loggedAt — both immutable (rule enforces).
  });
}

export async function deleteEntry(
  carId: string,
  entryId: string
): Promise<void> {
  await deleteDoc(doc(firestore, 'cars', carId, 'entries', entryId));
}
```

### 7.3 EntriesTable — editability

`CarDetailScreen` knows `isOwner` (it already computes
`car.ownerUid === user.uid`) and the current `user.uid`. Pass
that down so the table can decide which rows are editable:

```tsx
interface EntriesTableProps {
  entries: Entry[];
  // NEW:
  canEditEntry: (entry: Entry) => boolean;
  onEditEntry: (entry: Entry) => void;
}
```

- `canEditEntry(entry)` is computed in CarDetailScreen as
  `isOwner || entry.loggedByUid === user?.uid` (use optional
  chaining — `user` from `useAuth()` is nullable in the type,
  even though the route is auth-guarded; `user.uid` non-
  optional would trip strict TS / the no-`any` lint gate).
- In the table, editable rows render as an interactive control
  (wrap the row in a `<button>`-like affordance, or make the
  `<tr>` clickable with `role="button"` + keyboard support +
  `cursor-pointer` + a subtle hover/active style). Tap →
  `onEditEntry(entry)`. ≥44pt effective tap height.
- Non-editable rows render exactly as today (static, no
  affordance). At family scale most rows are editable for the
  owner; a sharee viewing the owner's car sees only their own
  rows tappable.
- Keep the existing columns/format/empty-state unchanged. The
  per-row MPG "—"/negative behavior stays.

Implementer picks the exact interactive pattern (clickable
`<tr>` vs. a trailing edit affordance). Mobile-first; ≥44pt;
keyboard-accessible (Enter/Space). Flag the choice in handoff.

### 7.4 EditEntryModal

Mirrors `AddCarModal`'s structure (overlay + centered panel,
Esc-to-close, autofocus, Cancel). Contents:

```text
<EditEntryModal entry onClose onSaved onDeleted>
  - Three NumericFields pre-filled from entry.odometer / .gallons
    / .cost (use the same NumericField + decimal flags as the
    log form: odometer integer, gallons/cost decimal).
  - Validate via validateOdometer/Gallons/Cost; Save disabled
    until all valid.
  - Save → updateEntry(carId, entry.id, validatedFields) →
    onSaved() (which closes + triggers parent refresh). Error →
    inline "Couldn't save — try again" (mirror existing modal
    error handling).
  - Delete button → opens ConfirmDialog ("Delete this fill-up?
    This can't be undone.") → on confirm: deleteEntry(carId,
    entry.id) → onDeleted() (closes + parent refresh).
  - carId comes from the parent (CarDetailScreen has it from
    useParams).
</EditEntryModal>
```

Accessibility floor (consistent with M3 modals): autofocus the
first field, Esc closes, explicit Cancel. Full focus-trap/ARIA
remains the deferred BACKLOG item — don't expand scope.

**Nested-modal Esc** (pre-read N4): when the Delete
`ConfirmDialog` opens on top of the EditEntryModal, both attach
window-level Esc listeners (AddCarModal-style). A single Esc
would fire both `onCancel`s — closing the confirm AND the edit
modal. Guard this: while the ConfirmDialog is open, the edit
modal's Esc handler should be inert (e.g., don't bind it when a
child dialog is open, or `stopPropagation` in the confirm's
handler). Implementer's choice of mechanism; flag in handoff.

### 7.5 CarDetailScreen wiring

```tsx
const [editing, setEditing] = useState<Entry | null>(null);
// ...
<EntriesTable
  entries={entriesState.entries}
  canEditEntry={(e) => isOwner || e.loggedByUid === user.uid}
  onEditEntry={(e) => setEditing(e)}
/>
{editing && (
  <EditEntryModal
    carId={carId ?? ''}
    entry={editing}
    onClose={() => setEditing(null)}
    onSaved={() => { setEditing(null); void refreshEntries(); }}
    onDeleted={() => { setEditing(null); void refreshEntries(); }}
  />
)}
```

`refreshEntries` is the `useEntries` refresh already on the
screen (M5). It recomputes the three MPG tiles + the table.
Since `loggedAt` is immutable, ordering is stable; only the
edited row's values + any MPG pairings that reference it change.

### 7.6 The sharee-edits-own subtlety (worth getting right)

- A sharee on a shared car sees the full entries table (M5:
  sharees can read all entries). With this dispatch, only the
  rows they logged are tappable for them; the owner's/other
  sharees' rows are static. This matches the rule: a sharee can
  only mutate their own.
- If a sharee somehow triggers an edit on a non-own entry (they
  shouldn't be able to — affordance gated), the rule denies it
  and the modal surfaces "Couldn't save." Defense in depth.
- The owner sees every row tappable.

---

## 8. Acceptance criteria

### R* — Rules

- **R1** Entries `update` rule changed from `if false` to
  `canMutate() && hasOnly(['odometer','gallons','cost'])` per
  §7.1, with `canMutate()` defined in the entries match scope
  reusing `parentCar()` / `canReadParent()`.
- **R2** Entries `delete` rule changed from owner-only to
  `canMutate()` (owner OR current-read-access logger).
- **R3** `loggedByUid` and `loggedAt` are immutable on update
  (the `hasOnly` guard); attempts to change them are denied.
- **R4** Rules deploy clean (`firebase deploy --only
  firestore:rules` — owner V-step, not run from dispatch).

### D* — Data module

- **D1** `entries.ts` exports `updateEntry(carId, entryId,
  {odometer, gallons, cost})` and `deleteEntry(carId,
  entryId)`. No inline entry writes anywhere else.
- **D2** `updateEntry` sets only the three numeric fields; never
  writes `loggedByUid` or `loggedAt`.
- **D3** `deleteEntry` deletes the single entry doc (distinct
  from `deleteEntriesForCar`).

### U* — UI

- **U1** `EntriesTable` accepts `canEditEntry` + `onEditEntry`;
  editable rows are interactive (≥44pt tap, keyboard-
  accessible, subtle affordance), non-editable rows static.
  Existing columns/format/empty-state unchanged.
- **U2** `EditEntryModal` (new) pre-fills the three fields from
  the entry, validates via the M4 validators, Save disabled
  until valid, Save → `updateEntry` → parent refresh, inline
  error on failure. Mirrors AddCarModal's pattern + a11y floor
  (autofocus, Esc, Cancel).
- **U3** Delete inside the modal → `ConfirmDialog` → `deleteEntry`
  → parent refresh. Confirm copy makes irreversibility clear.
- **U4** `CarDetailScreen` wires the modal: owner can edit/delete
  any row; sharee only their own (`canEditEntry` predicate).
  After save/delete, the entries table + 3 MPG tiles refresh.
- **U5** Mobile-first (Pixel ≈412px); ≥44pt targets; accent
  blue-600; destructive (Delete) may use red; no new accent
  tokens.

### T* — Tests

- **T1** Pure-function tests: none required new (no new pure
  helpers; validators already tested in M4). If the implementer
  extracts any pure helper, unit-test it.
- **T2** Rules tests in `entries.test.ts` — update. The
  positive cases must write the **three-field object**
  `{odometer, gallons, cost}` to mirror what `updateEntry`
  actually sends (not a hand-crafted single-key write — that
  would test a path the app never takes; see §7.1 note):
  - owner edits any entry on their car (writes all three) →
    succeeds (positive)
  - logger-sharee edits their own entry (writes all three) →
    succeeds (positive)
  - sharee edits another user's entry on a shared car → denied
    (negative)
  - non-related user edits an entry → denied (negative)
  - update whose write object also includes `loggedByUid` →
    denied (negative — `hasOnly`)
  - update whose write object also includes `loggedAt` →
    denied (negative — `hasOnly`)
  - (Optional rule-semantics case: a single-key `{cost}` write
    → succeeds, documenting that `hasOnly` permits a subset.
    Label it clearly as a rule-property test, not app
    behavior.)
- **T3** Rules tests — delete:
  - owner deletes any entry on their car → succeeds (existing
    M4 owner-delete test stays/green)
  - logger-sharee deletes their own entry → succeeds (positive,
    new)
  - sharee deletes another user's entry → denied (negative,
    new)
  - non-related user deletes → denied (negative)
- **T4** `npm test` exits 0; `npm run test:rules` exits 0.

### L* — Lint + types

- **L1** `npm run lint` exits 0; no `any`; catch clauses use
  `unknown` + type guards (mirror existing `isFirebaseError`).
- **L2** `npm run lint:md` exits 0.

### P* — PRD amendments

- **P1** §5.3 lifecycle amended (append-only → edit/delete
  supported; `loggedAt` still not user-editable; overwrite, no
  history) with dated note.
- **P2** §6.3 `update` + `delete` rows amended to the
  owner-or-logger model; `update` notes the field restriction.
  **The existing 2026-05-28 "Note on the delete rule" block
  (~lines 287-299) is also amended** with a dated follow-on so
  it no longer claims individual edit/delete is deferred (this
  dispatch ships it). PRD must not self-contradict between the
  table and the note.
- **P3** §11.2 edit-semantics open questions marked resolved.

### V* — Build / Verification

- **V1** `build:dev` + `build:prod` exit 0; bundle delta in
  handoff (small — one modal + helpers).
- **V2** Owner manual test (post `npm run deploy:dev` AND
  `npm run deploy:rules:dev` — rules changed this time):
  - As admin/owner: open a car with entries, tap a row → modal
    pre-filled → change odometer → Save → row + MPG tiles
    update; reload persists.
  - Edit gallons/cost similarly; verify MPG recomputes.
  - Delete an entry from the modal → confirm → row gone, tiles
    recompute, reload persists.
  - As a sharee (second account on a shared car): only your own
    logged rows are tappable; owner's rows static. Edit your
    own → works. (Optionally, via console, confirm you cannot
    edit the owner's entry.)
  - Firestore Console: confirm an edited entry's `loggedByUid`
    and `loggedAt` are unchanged after an edit (only the
    numeric field changed).
- **V3** No prod deploy.

---

## 9. Stop and ask

1. Any new dependency (none expected).
2. Any rules change beyond the entries `update`/`delete` in
   §7.1 — surface immediately.
3. Any schema change beyond what's specified (no new fields;
   the three editable fields already exist).
4. If a Firestore **composite index** is demanded during
   rules-testing or runtime — it shouldn't be (query unchanged)
   — surface before adding.
5. If the `hasOnly` field-restriction interacts badly with how
   `updateDoc` serializes the write (e.g., the SDK includes an
   unchanged field in the diff) — surface; the test
   `update changing only cost → succeeds` will catch it.
6. `catch (err: unknown)` + type guard, never `any`.
7. If the EntriesTable interactive-row pattern can't hit ≥44pt
   without distorting the dense table layout on 412px — surface
   the tradeoff (a trailing edit affordance vs. whole-row tap).
8. Modal-vs-bottom-sheet (Decision #6): if you have a strong
   reason the bottom-sheet is better here, surface — but the
   default is reuse-the-modal-pattern, don't invent the sheet.

---

## 10. Dependencies expected

None. Reuses `firebase/firestore` (`updateDoc`, `deleteDoc`,
`doc` — all already available), `NumericField`, the validators,
`ConfirmDialog`, `useEntries`. No npm changes.

---

## 11. Handoff guidance

`dispatch/edit-delete-entries-handoff.md` per template. Capture:

- The EntriesTable interactive-row pattern chosen (clickable
  `<tr>` vs. trailing affordance) + a11y approach.
- Confirmation that `loggedByUid`/`loggedAt` survive an edit
  (the V2 console check) — and that the `hasOnly` rule + the
  `updateEntry` field set agree.
- Whether `updateDoc` with exactly the three fields produces a
  diff of exactly those keys (the rule depends on it).
- Bundle delta from the log-restructure baseline.
- Note for **prod cutover**: this dispatch changes
  `firestore.rules`, so the cutover must run
  `deploy:rules:prod` (not just `deploy:prod`). Add to the
  cutover checklist.
- Note for **C (cars kebab)**: if C later introduces a real
  bottom-sheet, EditEntryModal is a candidate to migrate to it
  for consistency — flagged, not required.

---

## 12. Pre-read checklist

- **Rules correctness** (the load-bearing part): read the
  *actual* current `firestore.rules` entries block; verify
  `parentCar()` / `canReadParent()` exist in scope and that the
  proposed `canMutate()` + `hasOnly(...)` compiles and means
  what §7.1 claims. Specifically trace: owner-edits-any,
  logger-edits-own, sharee-edits-others-denied, change-
  loggedByUid-denied, change-loggedAt-denied. This is the same
  class of bug as the M3 allowlist-read miss — verify against
  the rules text, not the brief's prose.
- **`hasOnly` semantics**: confirm `diff().affectedKeys()
  .hasOnly([...])` is the right idiom (it's what M2 used for
  User `displayName`) and that an update of a subset of the
  three fields passes.
- **`updateDoc` diff behavior**: does writing `{odometer,
  gallons, cost}` with unchanged values still produce a diff
  containing those keys? (It produces affectedKeys for the
  written fields regardless of value-change in most Firestore
  rules semantics.) The T2 "edit only cost" case is the guard;
  confirm the test models it correctly.
- **entries.ts**: verify `doc` is already imported (it is, for
  `deleteEntriesForCar`); only `updateDoc` + `deleteDoc` are
  new imports.
- **EntriesTable current shape**: confirm the props addition is
  additive and the existing `perFillMpg`/format logic is
  untouched.
- **CarDetailScreen**: confirm it already has `isOwner`,
  `user`, `carId`, and the `useEntries` `refresh` in scope for
  the wiring in §7.5.
- **AddCarModal / ConfirmDialog**: confirm the modal pattern
  EditEntryModal mirrors actually exists and how it's
  structured (overlay, Esc, autofocus) so the new modal is
  consistent.
- **PRD §6.3 current wording**: confirm the M4 delete-row
  amendment text so P2 amends the right baseline.
- **Internal consistency**: §4 ↔ §8 ↔ §5/§7. Every AC maps to
  a file; every file has ACs.
- **Missing edge cases**: editing an entry whose edit makes a
  *neighbor's* MPG go negative (no warning by design — confirm
  that's intended and the table shows "—"); deleting the only
  entry on a car (tiles → hidden per M5/log-screen rules;
  table → "No fill-ups yet."); deleting the oldest entry
  (re-pairs MPG — fine, recompute handles it).

Report: BLOCKING / SHOULD-FIX / NITS / CONFIRMED-OK. Reviewer
modifies no files.

---

## 13. Forward feedback channel

(empty until execution)

Candidates: Firestore `updateDoc` diff/affectedKeys behavior vs
the `hasOnly` rule; interactive-table-row a11y patterns at
dense mobile widths; any rules-test rake around update field
restriction.

---

End of brief.
