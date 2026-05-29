# M4 — Entries (log fill-up)

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

**Status**: draft — pending pre-read by reviewer cuttlefish (per
WORKING-MODEL §3) before implementer dispatch.

---

## 1. Context

M4 is v0's fourth milestone (PRD §10). Builds atop M3's Cars
surface and is **the milestone that makes flog functionally
replace the Google Form**. Per PRD §10 M4 acceptance: "Family can
switch from Google Form to flog without losing capture function."

What M3 shipped (recap from `dispatch/M3-cars-handoff.md`):

- Cars CRUD + share/unshare with atomic batched share writes.
- Routing introduction (`react-router@^7.15.1`): `/` →
  `<CarListScreen />`, `/cars/:carId` → `<CarDetailScreen />`.
- `<Header />` component with persistent sign-out across signed-in
  routes.
- `<CarDetailScreen />` scaffolds a reserved "Fill-ups" region
  with placeholder copy — that's M4's insertion point.
- M3 V2 surfaced the allowlist read-rule loosening; PRD §6.4
  amended in-place. M4 inherits a fully-working share flow.

M4's job:

- Wire the **log-fill-up form** as the new landing page (`/`).
- Restructure routing: car list moves to `/cars`; log form
  becomes `/`. PRD §7 Flow C is explicit that landing = log form.
- Introduce **Entries module** (`src/entries/entries.ts`),
  mirroring the `src/cars/cars.ts` pattern: single write path,
  pure boundary between screens/hooks and Firestore.
- Ship **odometer-monotonicity flag-but-accept** per PRD §7
  Flow C edge case.
- Ship **entries cascade-delete on car delete** (M3 Decision #6
  pinned this to M4): rule relaxation + `deleteCar` extension +
  rules tests. The rule and the code land together.
- Track **most-recently-used car** in `localStorage` (per-device,
  per Austin 2026-05-28 — single-device-per-person family usage
  doesn't justify a User schema amendment).
- Replace the `<CarDetailScreen />` "Fill-ups" placeholder with
  a more honest "Coming in the next update" line (M5 fills it
  for real).

M5 (Per-car detail + MPG) follows. M4 deliberately does NOT
ship a per-car entries list — family captures with M4; they see
their data with M5.

**Prod deploy is NOT in scope for M4.** Per Austin 2026-05-28:
prod cutover is a separate post-M4 concern, not a within-
milestone deliverable. M4 ships dev-only, same posture as
M2/M3.

---

## 2. Required reading

In order:

1. [`../PRD.md`](../PRD.md) — §1.1 (goals), §1.4 (philosophical
   commitments), §4 (architecture), §5.3 (Entry shape — load-
   bearing), §6.3 (Entry rules — needs amendment this dispatch),
   §7 Flow C (log a fill-up — load-bearing), §8 (cost — needs
   amendment this dispatch), §9 (UI), §10 (M4 row), §11.2
   (open questions; the optional `note` field is M4-relevant).
2. [`../AGENTS.md`](../AGENTS.md) — all of it. Particularly
   "`loggedAt` is always a server timestamp" and the one-write-
   path posture (mirrored from cars to entries for M4).
3. [`../WORKING-MODEL.md`](../WORKING-MODEL.md) — §3 (pre-read),
   §5 (operational conventions), §6 (antipatterns).
4. [`../HANDOFF-TEMPLATE.md`](../HANDOFF-TEMPLATE.md) — for the
   handoff doc shape at the end.
5. [`M3-cars-handoff.md`](M3-cars-handoff.md) — current code
   state. Especially:
   - "Post-ship findings" (the allowlist read-rule loosening
     fix — M4 inherits this clean).
   - "Items deferred → To the next dispatch (M4)" — the M3
     author's hand-off notes for you (entries cascade-delete +
     `useEntries` hook + `loggedAt` enforcement + single Entries
     write helper).
   - "Notes for the next dispatch brief" — especially the epoch
     race-guard pattern and the recurring "PRD rule rows drift"
     observation.
6. [`M3-cars.md`](M3-cars.md) §13 (forward feedback) — both
   M3 rakes (`react-hooks@7` rule conflict + atomic-conditional-
   write read-access requirement).

---

## 3. Scope

### In scope

- **Entries module** (`src/entries/entries.ts`):
  - `createEntry(carId, {odometer, gallons, cost}, loggedByUid)`
    — single write of the Entry doc; `loggedAt` set via
    `serverTimestamp()` at the boundary; returns the new entryId.
  - `getLatestEntry(carId)` — single-query fetch of the
    most-recent entry on a car for the monotonicity check.
    Returns `Entry | null`. Implemented as a Firestore
    `query(entries, orderBy('loggedAt', 'desc'), limit(1))`.
  - `listEntriesForCar(carId, limit = 50)` — stub for M5 use;
    M4 doesn't render an entries list, but the helper lands now
    so M5's brief can reference it.
  - `deleteEntriesForCar(carId)` — batched delete of all entries
    in the subcollection. Used by `deleteCar` for cascade.
- **`src/cars/cars.ts` `deleteCar` extension**: before deleting
  the Car doc, call `deleteEntriesForCar(carId)` to cascade.
  Order matters (entries first, car last) so a partial failure
  leaves the car recoverable.
- **Rule relaxation** in `firestore.rules` for
  `cars/{carId}/entries/{entryId}` delete: from
  `allow delete: if false` to
  `allow delete: if request.auth != null && request.auth.uid ==
   get(/databases/$(database)/documents/cars/$(carId)).data.ownerUid`.
  Owner of parent car can delete entries. Sharees cannot. PRD
  §6.3 needs amendment to reflect this (see §4 #11 below).
- **Log form screen** (`src/screens/LogFillupScreen.tsx`) at `/`:
  - Car picker (chip row) preselected to MRU (localStorage) or
    first available car.
  - Three numeric inputs (odometer, gallons, cost) with
    appropriate `inputmode`.
  - Save button (large, prominent).
  - On Save: 1 read (`getLatestEntry`) for monotonicity → if
    new < prior, toast warning "Odometer went down from {prior}.
    Saved anyway." → `createEntry` → success toast "Saved" →
    form clears → MRU updated in localStorage → same car
    preselected.
- **Routing restructure** (`src/App.tsx`):
  - `/` → `<LogFillupScreen />` (was `<CarListScreen />`).
  - `/cars` → `<CarListScreen />` (new path).
  - `/cars/:carId` → `<CarDetailScreen />` (unchanged).
  - `*` → `<Navigate to="/" replace />` (unchanged).
- **Header nav** (`src/components/Header.tsx` extension):
  - "Log" link → `/`
  - "Cars" link → `/cars`
  - Sign-out button (unchanged from M3)
  - Active-route highlighting using react-router's `NavLink`.
- **Components** (`src/components/`):
  - `CarPickerChips.tsx` — horizontal chip row; takes `cars: Car[]`,
    `selectedId: string`, and `onChange: (id: string) => void`.
  - `NumericField.tsx` — labeled numeric input with appropriate
    `inputmode`; takes `label`, `value`, `onChange`, plus a
    `decimal: boolean` to switch between integer (odometer) and
    decimal (gallons, cost) keypads.
  - `Toast.tsx` — minimal toast notifier (success / warning /
    error variants). Inline render or portal; implementer's call.
    Required for "Saved" + "Odometer went down" + error surfaces.
- **`src/lib/mru.ts`** — localStorage helpers:
  - `getMruCarId(): string | null`
  - `setMruCarId(carId: string): void`
  - Key: `flog:mru:carId`. SSR-safe (`typeof window` guards) even
    though we don't SSR — defensive against future change.
- **Validation helpers** (`src/entries/`):
  - `validateOdometer(raw): {ok, value?, reason?}` — integer ≥ 0.
  - `validateGallons(raw): {ok, value?, reason?}` — number > 0.
  - `validateCost(raw): {ok, value?, reason?}` — number ≥ 0
    (free fill-ups exist; promo days, employee fuel).
  - All three: trim, parse, validate sign + type. Soft posture
    (hard block only on non-numeric / wrong sign). No upper-bound
    caps. Mirrors the M3 odometer-monotonicity philosophy:
    flag-but-accept where possible, never block a real fill-up
    over a misjudged threshold.
- **Hooks** (`src/cars/useCars.ts` reuse; `src/entries/` new):
  - The log form needs the user's cars list — reuse M3's
    `useCars()` directly.
  - Monotonicity check is one-shot inside the submit handler;
    no dedicated hook needed (avoid the `set-state-in-effect`
    suppression for one-shot reads).
- **PRD amendments** (per "ink not stone" principle —
  `feedback_collaboration.md`):
  - **§6.3 Entry rules**: `delete` row from "none in v0
    (deferred to Soon)" to "parent car owner only (for cascade)"
    with the new rule expression and an inline amendment note
    dated 2026-05-28 referencing M3 Decision #6.
  - **§8 Cost control**: two rows amended this dispatch.
    First, `Log a fill-up` row from "0 reads, 1 write" to "1
    read, 1 write" with an inline note explaining the read is
    the monotonicity check required by Flow C edge case
    (which §8 v1 didn't account for). Second, `Home (car
    list)` row from "1 query (<10 docs)" to "2 queries
    (owner and sharee, parallel; <10 docs each)" — M3 actually
    ships
    two parallel queries (the schema's `ownerUid` vs.
    `shareeEmails` split makes a single combined query
    impossible without denormalization), and v1's "1 query"
    text was directional, not literal. Both amendments use
    inline "amended on DATE because…" notes per "ink not
    stone." The total-read budget is unchanged in either case.
- **BACKLOG addition** (during this dispatch):
  - Soon: **"Optional `note` field on fuel entries"** (XS) —
    per PRD §11.2 and Q3 design conversation 2026-05-28; family
    may want this back; legacy form had it at ~1% usage.
- **Tests**:
  - Unit tests for `validateOdometer`, `validateGallons`,
    `validateCost`, and the `mru.ts` helpers (mock
    `localStorage` or use `node`'s built-in handling under
    vitest).
  - Rules tests in `tests/rules/entries.test.ts`:
    - Owner of parent car can delete an entry (positive — new).
    - Sharee of parent car cannot delete an entry (negative —
      new).
    - Non-related user cannot delete an entry (negative — new).
    - Existing M2 entry tests still pass (read + create still
      gated as before).
  - Rules test in `tests/rules/cars.test.ts` for the cascade:
    - Owner can issue a batched-delete-entries-then-delete-car
      (positive). Could be one test that seeds N entries, calls
      `deleteCar` from `src/cars/cars.ts` (with appropriate
      auth context), then asserts all entries + the car gone.
      Alternative: a unit test that mocks Firestore and asserts
      the helper issues the right sequence. Implementer's call;
      flag in handoff.

### Out of scope (defer)

- **Per-car entries list / MPG view** — M5. The
  `<CarDetailScreen />` Fill-ups region stays a placeholder
  (text updated to "Entries and MPG land in the next update").
- **Edit / delete an individual entry** — BACKLOG → Soon
  (already there: "Edit / delete entries"; status unchanged).
- **Optional `note` field** — moves to BACKLOG → Soon during
  this dispatch per Q3.
- **Aggregate doc for per-car MPG** — BACKLOG → Later
  (unchanged).
- **CSV export** — BACKLOG → Soon (unchanged).
- **Prod cutover** — separate post-M4 conversation per Austin
  2026-05-28.

---

## 4. Decisions locked in (from design conversation 2026-05-28)

These are settled. Implementer treats as fixed unless flagged
stop-and-ask.

1. **Routing restructure**: `/` = `<LogFillupScreen />`,
   `/cars` = `<CarListScreen />`, `/cars/:carId` =
   `<CarDetailScreen />`. Approved Q1.
2. **MRU = localStorage** at key `flog:mru:carId`. **No PRD
   §5.1 amendment**. Family is overwhelmingly single-device-
   per-person; cross-device sync isn't worth the schema delta.
   Approved Q2.
3. **Optional `note` field**: skipped in M4. Filed as BACKLOG →
   Soon during this dispatch. Approved Q3.
4. **Prod cutover**: post-M4 concern; M4 ships dev-only. Approved
   Q4.
5. **One M-sized cuttlefish**, no split. Approved Q5.
6. **Entries module mirrors cars module**: single write path at
   `src/entries/entries.ts`; AGENTS guardrail.
7. **`loggedAt` always `serverTimestamp()`** at the entries.ts
   boundary; no client clocks. AGENTS.
8. **Soft validation on all three numeric inputs** (hard block
   only on non-numeric / wrong sign; no upper-bound caps).
   Consistent with odometer-monotonicity flag-but-accept.
9. **Car picker = horizontal chip row**. At family scale (4-5
   cars), all chips fit on a 375px viewport with 44pt tap
   targets. MRU chip pre-highlighted.
10. **Save flow**: 1 read (`getLatestEntry` for monotonicity) +
    1 write (entry doc). MRU update is localStorage-only; no
    Firestore write for that. PRD §8 amended accordingly.
11. **Two PRD amendments** this dispatch (per "ink not stone"):
    - §6.3 (entries delete rule)
    - §8 (log fill-up cost)
12. **Entries cascade delete ships in M4** alongside entries-
    create. Rule + code + tests together. Per M3 Decision #6.
13. **Header gains nav** ("Log" / "Cars"). Active-route
    highlighting via `NavLink`.
14. **Empty state on log form**: if user has zero cars (owned +
    shared = 0), render "Add a car first" with a link to
    `/cars`. New admin signs in → empty state on `/` → tap link
    → `/cars` empty state → tap Add car → modal → on create,
    navigate back to `/` (or to `/cars/:newId`; implementer's
    judgment, mirror M3 AddCarModal posture).
15. **Pre-read required** (WORKING-MODEL §3; M-sized).

---

## 5. Files in play

```text
flog/
├── PRD.md                                      (modified — §6.3, §8 amendments)
├── BACKLOG.md                                  (modified — note-field entry in Soon)
├── firestore.rules                             (modified — entries delete relaxed)
├── src/
│   ├── App.tsx                                 (modified — routes shuffled)
│   ├── cars/
│   │   └── cars.ts                             (modified — deleteCar cascade)
│   ├── entries/                                (new module)
│   │   ├── entries.ts                          (new — CRUD + helpers)
│   │   ├── validateOdometer.ts                 (new)
│   │   ├── validateOdometer.test.ts            (new)
│   │   ├── validateGallons.ts                  (new)
│   │   ├── validateGallons.test.ts             (new)
│   │   ├── validateCost.ts                     (new)
│   │   └── validateCost.test.ts                (new)
│   ├── lib/                                    (new directory)
│   │   ├── mru.ts                              (new — localStorage helpers)
│   │   └── mru.test.ts                         (new)
│   ├── components/
│   │   ├── Header.tsx                          (modified — nav links)
│   │   ├── CarPickerChips.tsx                  (new)
│   │   ├── NumericField.tsx                    (new)
│   │   └── Toast.tsx                           (new)
│   └── screens/
│       ├── LogFillupScreen.tsx                 (new)
│       └── CarDetailScreen.tsx                 (modified — placeholder copy + nav updates)
└── tests/
    └── rules/
        ├── entries.test.ts                     (modified — 3 new delete tests)
        └── cars.test.ts                        (modified — 1 cascade test)
```

This handoff at `dispatch/M4-entries-handoff.md` written at the
end. Brief §13 forward-feedback populated by the implementer if
rakes surface.

---

## 6. Files NOT to touch

- `AGENTS.md`
- `CUTTLEFISH-NAUTILUS.md`
- `WORKING-MODEL.md`
- `HANDOFF-TEMPLATE.md`
- `README.md`
- This brief (`dispatch/M4-entries.md`) — except §13 forward
  feedback if a rake is captured.
- All `dispatch/M1-*`, `dispatch/M2-*`, `dispatch/M3-*` files —
  closed records.
- `dispatch/paralarva-feedback-*.md` — closed forward-feedback
  artifacts.
- `dispatch/runbooks/gcp-firebase-env-setup.md` — closed.
- `.firebaserc`, `firebase.json`, `vite.config.ts`,
  `tsconfig.app.json`, `tsconfig.node.json`,
  `tsconfig.test.json`, `tsconfig.json`, `eslint.config.js`,
  `vitest.config.ts`, `vitest.rules.config.ts` — set in M1/M2;
  no changes for M4.
- `src/firebase/config.ts`, `src/firebase/app.ts`,
  `src/firebase/auth.ts`, `src/firebase/firestore.ts` — M2.
- `src/auth/*` — M2-closed.
- `src/screens/LoadingScreen.tsx`,
  `src/screens/SignedOutScreen.tsx`,
  `src/screens/RejectedScreen.tsx`,
  `src/screens/CarListScreen.tsx` — M2/M3-closed.
  (`<CarDetailScreen />` IS modified — see §5 + ACs U17 and
  U17b. Four surgical changes: Fill-ups placeholder copy update,
  and three `/` → `/cars` navigation updates per U17b
  enumeration.)
- `src/components/` everything except `Header.tsx` (modified)
  and the new files listed in §5.
- `src/cars/` everything except `cars.ts` (modified for cascade).
- `tests/rules/users.test.ts`, `tests/rules/allowlist.test.ts`
  — M2/M3-closed.
- `src/index.css` — accent block untouched.
- `.env.development`, `.env.production` — no new vars.

**Two intentional exceptions from the usual NOT-touch posture**,
both documented in Decision #11:

- `PRD.md` — §6.3 + §8 amendments (with inline notes per "ink
  not stone").
- `firestore.rules` — entries delete relaxation. Paired with new
  rules tests.

---

## 7. Architecture sketch

### 7.1 Routing structure

```text
<BrowserRouter>
  <AuthProvider>
    {status === 'loading'  → <LoadingScreen />}
    {status === 'signed-out' → <SignedOutScreen />}
    {status === 'rejected'   → <RejectedScreen email={user?.email} />}
    {status === 'signed-in'  →
      <>
        <Header />
        <Routes>
          <Route path="/"            element={<LogFillupScreen />} />
          <Route path="/cars"        element={<CarListScreen />} />
          <Route path="/cars/:carId" element={<CarDetailScreen />} />
          <Route path="*"            element={<Navigate to="/" replace />} />
        </Routes>
      </>
    }
  </AuthProvider>
</BrowserRouter>
```

Three routes now (was two). Header's nav adapts.

### 7.2 `src/entries/entries.ts` shape

```ts
import {
  addDoc, collection, getDocs,
  limit as fbLimit, orderBy, query, serverTimestamp,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { firestore } from '../firebase/firestore';

export interface Entry {
  id: string;
  loggedByUid: string;
  odometer: number;
  gallons: number;
  cost: number;
  loggedAt: Timestamp;
}

export async function createEntry(
  carId: string,
  data: { odometer: number; gallons: number; cost: number },
  loggedByUid: string
): Promise<string> {
  const ref = await addDoc(collection(firestore, 'cars', carId, 'entries'), {
    loggedByUid,
    odometer: data.odometer,
    gallons: data.gallons,
    cost: data.cost,
    loggedAt: serverTimestamp(),  // AGENTS: never client clock
  });
  return ref.id;
}

export async function getLatestEntry(carId: string): Promise<Entry | null> {
  const q = query(
    collection(firestore, 'cars', carId, 'entries'),
    orderBy('loggedAt', 'desc'),
    fbLimit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  // Cast without runtime validation: rules enforce shape on create.
  // A hand-edited doc with missing fields would silently skip the
  // monotonicity warning; acceptable at family scale where Firestore
  // Console edits are rare and intentional.
  return { id: d.id, ...d.data() } as Entry;
}

export async function listEntriesForCar(
  carId: string,
  limit = 50
): Promise<Entry[]> {
  // Stub for M5 — order by loggedAt desc, limit configurable.
  const q = query(
    collection(firestore, 'cars', carId, 'entries'),
    orderBy('loggedAt', 'desc'),
    fbLimit(limit)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Entry));
}

export async function deleteEntriesForCar(carId: string): Promise<void> {
  // Cascade helper for deleteCar. Batched delete in chunks of 500
  // (Firestore batch limit). Family scale: ~30 entries/car expected,
  // so single batch suffices.
  const snap = await getDocs(
    collection(firestore, 'cars', carId, 'entries')
  );
  if (snap.empty) return;
  // Chunk defensively in case a car ever grows past 500 entries.
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 500) {
    const batch = writeBatch(firestore);
    docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}
```

### 7.3 `deleteCar` cascade extension

```ts
// src/cars/cars.ts (modify the existing deleteCar)
import { deleteEntriesForCar } from '../entries/entries';

export async function deleteCar(carId: string): Promise<void> {
  // M4 cascade per Decision #6 (now implemented).
  // Entries first, car last — so a partial failure leaves the
  // car deletable on retry.
  await deleteEntriesForCar(carId);
  await deleteDoc(doc(firestore, 'cars', carId));
}
```

Note: this introduces a circular-import concern at the module
level (cars imports entries; if entries ever imports cars it
breaks). Currently fine; the implementer should keep entries
free of cars imports going forward.

### 7.4 Rule relaxation in `firestore.rules`

Current entries block (M2):

```text
allow update, delete: if false;
```

New M4 shape — **reuse the existing `parentCar()` helper** that
M2 R3 already defines inside the entries `match` block (see
`firestore.rules:53-54` as shipped). Don't inline a fresh
`get()`; consistency with the read/create rules matters and the
helper is already in scope:

```text
allow update: if false;
allow delete: if request.auth != null
                 && parentCar().ownerUid == request.auth.uid;
```

The `parentCar()` helper expands to
`get(/databases/$(database)/documents/cars/$(carId)).data`. The
M2/M3 BACKLOG item about rules `get()` caching semantics applies
here too — at M4 the rule fires on cascade-delete (rare). Per-
cascade cost trace at family scale (~30 entries/car): roughly
~60 reads (1 `getDocs` enumeration ≈ 30 reads + 30 rule-eval
`get()` calls, one per batched delete) + 30 writes. Trivial vs.
PRD §8 tripwire. Worth re-flagging when M5's per-car-detail
entries query starts hitting the same pattern on every page view.

### 7.5 `LogFillupScreen.tsx` shape

```text
<LogFillupScreen>
  <CarPickerChips
    cars={cars}
    selectedId={selectedCarId}
    onChange={(id) => { setSelectedCarId(id); setMruCarId(id); }}
  />
  <NumericField label="Odometer (mi)" decimal={false}
                value={odometer} onChange={setOdometer} />
  <NumericField label="Gallons" decimal={true}
                value={gallons} onChange={setGallons} />
  <NumericField label="Cost ($)" decimal={true}
                value={cost} onChange={setCost} />
  <SaveButton onClick={handleSave} disabled={!canSave || saving}>
    {saving ? 'Saving…' : 'Save'}
  </SaveButton>
  <Toast ... />
</LogFillupScreen>
```

`canSave` = all three fields pass validation AND a car is
selected. `handleSave` flow:

```ts
async function handleSave() {
  setSaving(true);
  try {
    const prior = await getLatestEntry(selectedCarId);
    const odo = validatedOdometer; // pre-parsed integer
    const wentDown = prior !== null && odo < prior.odometer;

    await createEntry(selectedCarId,
      { odometer: odo, gallons: validatedGallons, cost: validatedCost },
      user.uid);

    setMruCarId(selectedCarId);  // localStorage; idempotent

    if (wentDown) {
      toast.warn(`Odometer went down from ${prior!.odometer}. Saved anyway.`);
    } else {
      toast.success('Saved');
    }

    setOdometer(''); setGallons(''); setCost('');
    // selectedCarId stays — per PRD Flow C step 5
  } catch (err: unknown) {
    toast.error("Couldn't save — try again");
  } finally {
    setSaving(false);
  }
}
```

### 7.6 Empty-state handling

If `useCars()` returns `[]` (zero owned + zero shared), the log
form renders:

```text
You don't have any cars yet.

[Add a car →]   (links to /cars)
```

Avoids users staring at an empty form they can't submit. Once
they add a car at `/cars` and create it, the AddCarModal's
post-create navigation (per M3) takes them to
`/cars/:newId` — from there they can navigate back to `/` and
log the first fill-up.

### 7.7 MRU initialization

`useCars()` (per M3 `src/cars/useCars.ts`) returns
`{ state, refresh }` where `state` is a discriminated union
`{ status: 'loading' } | { status: 'ready'; cars: Car[] } |
 { status: 'error'; error: unknown }`. The log screen must
handle all three states explicitly (see AC U16, U16a, U16b).

```ts
const { state } = useCars();

// MRU initialization fires once; refined when cars load.
const [selectedCarId, setSelectedCarId] = useState<string | null>(
  () => getMruCarId()
);

useEffect(() => {
  if (state.status !== 'ready') return;
  const { cars } = state;
  if (cars.length === 0) {
    setSelectedCarId(null);
    return;
  }
  // Honor MRU if it's still in the user's available cars;
  // otherwise fall back to first car in the list.
  setSelectedCarId(prev => {
    if (prev && cars.some(c => c.id === prev)) return prev;
    return cars[0].id;
  });
}, [state]);

// Render branches:
//   state.status === 'loading' → <LoadingScreen /> or inline spinner
//   state.status === 'error'   → "Couldn't load cars — try again" + retry
//   state.status === 'ready' && state.cars.length === 0 → empty state (U16)
//   state.status === 'ready' && state.cars.length > 0   → log form proper
```

Note: the effect uses the `setSelectedCarId(prev => ...)`
functional update form to avoid a stale-closure read of
`selectedCarId`, which lets us drop `selectedCarId` from the
deps array. That fixes the brief-original double-render issue
flagged in pre-read and keeps the effect dependency-correct.

The fallback handles the case where MRU points to a car the
user no longer has access to (owner deleted, sharee removed,
etc.).

### 7.8 Header nav

```text
<Header>
  <Link to="/">flog</Link>  {/* logo / wordmark, goes to log form */}
  <nav>
    <NavLink to="/" end>Log</NavLink>
    <NavLink to="/cars">Cars</NavLink>
  </nav>
  <button onClick={signOut}>Sign out</button>
</Header>
```

`end` prop on the `/` NavLink prevents it matching when on
`/cars/:carId`. Active state styling via NavLink's `className`
function or `style` prop — implementer's call.

---

## 8. Acceptance criteria

Numbered by subsection (WORKING-MODEL §5 prefix-numbering).

### E* — Entries module

- **E1** `src/entries/entries.ts` exports `createEntry`,
  `getLatestEntry`, `listEntriesForCar`, `deleteEntriesForCar`.
  No inline Firestore write/read calls for entries exist
  anywhere else (single write path; AGENTS).
- **E2** `createEntry` writes `{ loggedByUid, odometer, gallons,
  cost, loggedAt: serverTimestamp() }`. PRD §5.3 field-for-field.
  No client clock; no auto-id stored in body (doc-id is the
  source of truth, per M3 C2 precedent).
- **E3** `getLatestEntry` returns the entry with the largest
  `loggedAt`. Returns null when collection empty.
- **E4** `deleteEntriesForCar` batched-deletes all entries.
  Chunks at 500 (Firestore batch limit) defensively.
- **E5** `listEntriesForCar(carId, limit=50)` exists as a stub
  for M5; not invoked from any M4 screen.

### C* — Cars module (modification)

- **C10** `deleteCar` calls `deleteEntriesForCar` before
  `deleteDoc(cars/{carId})`. Entries first, car last (so a
  partial failure leaves the car deletable on retry).

### R* — Routing + structure

- **R5** Routes restructured: `/` → `<LogFillupScreen />`,
  `/cars` → `<CarListScreen />`, `/cars/:carId` unchanged.
  `*` → `<Navigate to="/" replace />` unchanged.
- **R6** `<Header />` renders `<NavLink to="/" end>Log</NavLink>`
  alongside `<NavLink to="/cars">Cars</NavLink>` + sign-out button.
  Active route is visually distinguishable (implementer's
  choice — e.g., bolder text or underline).

### S* — Security rules

- **S1** `firestore.rules` entries delete rule changed from
  `allow delete: if false` to
  `allow delete: if request.auth != null && request.auth.uid ==
   get(/databases/$(database)/documents/cars/$(carId)).data.ownerUid`.
- **S2** `npm run deploy:rules:dev` deploys clean. (Owner step;
  not run from this dispatch.)

### U* — UI surfaces

- **U11** `<LogFillupScreen />` mobile-first (375px viewport
  fits without scroll); car-picker chips + 3 numeric fields +
  Save button; tap targets ≥44pt.
- **U12** `<CarPickerChips />` renders one chip per car;
  selected chip visually distinct (e.g., filled vs outlined);
  on tap, `onChange(carId)` fires.
- **U13** `<NumericField />` uses `inputmode="numeric"` for
  integer fields (odometer) and `inputmode="decimal"` for
  decimal fields (gallons, cost). HTML `type="number"`.
  Pattern: `[0-9]*` for integer, `[0-9]*[.,]?[0-9]*` for decimal
  (or implementer's preferred regex).
- **U14** `<Toast />` shows success / warning / error variants.
  Success on save, warning on odometer-down, error on submit
  failure. Toast auto-dismisses (3-5s); implementer picks
  timing.
- **U15** Save flow per §7.5: validates → reads latest →
  writes → updates MRU localStorage → resets form → leaves car
  selected. Form reset means odometer/gallons/cost cleared but
  selected car unchanged.
- **U16** Empty-cars state on `<LogFillupScreen />` when
  `useCars()` resolves to `state.status === 'ready'` AND
  `state.cars.length === 0`: render "You don't have any cars
  yet." with a link/button to `/cars`. Sign-out still
  accessible via Header.
- **U16a** Loading state on `<LogFillupScreen />` when
  `useCars()` is at `state.status === 'loading'`: render the
  shared `<LoadingScreen />` OR an inline minimal spinner.
  Implementer's choice; flag in handoff. Don't render the
  empty-cars state during the loading window.
- **U16b** Error state on `<LogFillupScreen />` when `useCars()`
  is at `state.status === 'error'`: render "Couldn't load
  cars — try again" with a Retry button that calls
  `useCars().refresh()`. Don't render the empty-cars state on
  error. (Mirrors the M3 `CarListScreen.tsx:42-61` shape.)
- **U17** `<CarDetailScreen />` Fill-ups placeholder copy
  updated from "Entries and MPG will land in a future update."
  to "Entries and MPG land in the next update." (or
  equivalent; minor wording, just acknowledge M4 didn't fill
  this region — M5 will).
- **U17b** `<CarDetailScreen />` navigation updates — **three
  sites**, all `/` → `/cars`:
  1. The "← Back to cars" `<Link to="/">` in the **happy-path**
     render (`src/screens/CarDetailScreen.tsx` ~line 60-65).
  2. The "← Back to cars" `<Link to="/">` in the **error /
     not-found render** (`src/screens/CarDetailScreen.tsx` ~line
     38-43, fires when `state.status === 'error'` or
     `state.car === null`). Pre-read 2026-05-28 caught the
     first-pass omission of this site — both Link instances
     need updating, not just the happy-path one.
  3. The post-delete `navigate('/')` in the delete handler
     (`src/screens/CarDetailScreen.tsx` ~line 54).

  Labels stay "Back to cars" (intent unchanged; M3 shipped
  these as `/` because `/` *was* the cars list pre-M4
  restructure). The new targets re-align target with label
  intent.
- **U18** All new screens / components mobile-first; tap
  targets ≥44pt; accent stays `blue-600` (destructive uses red);
  no new accent tokens.

### D* — Data validation helpers

(Renamed from `V*` to avoid clashing with the `V*` verification
section below — both would have shared a single-letter prefix.
WORKING-MODEL §5 allows per-dispatch prefix choice; `D*` is the
clean separation.)

- **D1** `validateOdometer(raw)` returns `{ok: true, value: int}`
  for non-empty digit-string-parseable-to-non-negative-integer;
  `{ok: false, reason}` otherwise. Handles whitespace. Decimals
  rejected (odometers are integer miles).
- **D2** `validateGallons(raw)` returns `{ok: true, value: number}`
  for non-empty parseable-to-strictly-positive number (`> 0`,
  zero rejected — a fill-up of zero gallons is a data error,
  not a free-pump-no-fluid event); `{ok: false, reason}`
  otherwise. Allows decimals.
- **D3** `validateCost(raw)` returns `{ok: true, value: number}`
  for non-empty parseable-to-non-negative number (`>= 0`; zero
  allowed — free fill-ups exist: promo days, employee fuel).
  `{ok: false, reason}` otherwise. Allows decimals.
- **D4** All three validators: pure functions; idempotent;
  unit-tested.

### M* — MRU helpers

- **M1** `src/lib/mru.ts` exports `getMruCarId(): string | null`
  and `setMruCarId(carId: string): void`. Key:
  `flog:mru:carId`.
- **M2** `getMruCarId` returns null when localStorage absent
  (SSR-safety guard) or key missing. Never throws.
- **M3** `setMruCarId` no-ops when localStorage absent. Never
  throws.
- **M4** Unit tests for both, exercising present / missing key
  and the SSR-safety guard (mock `globalThis.localStorage` as
  undefined for the guard test).

### T* — Tests

- **T6** Unit tests for `validateOdometer` (6+ cases including
  edge cases: empty, whitespace, negative, decimal-rejected,
  non-numeric, valid).
- **T7** Unit tests for `validateGallons` (similar surface,
  decimals allowed, zero rejected).
- **T8** Unit tests for `validateCost` (similar; zero allowed).
- **T9** Unit tests for `mru.ts` (present, missing, SSR-safe).
- **T10** Rules tests in `tests/rules/entries.test.ts`. Net
  delta: **+2 tests, 1 inverted, 0 deleted**. Specifically:
  - The existing M2 test at `tests/rules/entries.test.ts:221-239`
    asserts `assertFails(deleteDoc(...))` for the owner —
    **invert** to `assertSucceeds(...)` and rename the `it()`
    description from "owner cannot delete an entry" to "owner
    can delete an entry." This counts as the positive case for
    the new rule.
  - **Add**: parent-car sharee cannot delete an entry
    (negative).
  - **Add**: non-related user cannot delete an entry
    (negative).
  - All existing entries READ and CREATE tests (per M2 R3)
    continue to pass unchanged.
- **T11** Rules / integration test in `tests/rules/cars.test.ts`
  for cascade: seed 3 entries on a car; as owner, invoke
  `deleteCar` (either by calling the helper directly with the
  test firestore context, or by reconstructing its sequence
  inline); assert all entries + the car are gone. Implementer
  picks the test shape; flag in handoff.
- **T12** `npm test` exits 0; `npm run test:rules` exits 0.

### L* — Lint + types

- **L7** `npm run lint` exits 0.
- **L8** `npm run lint:md` exits 0.
- **L9** Strict TS; no `any`; catch clauses use `unknown` +
  type guards (mirror M2/M3 pattern).

### P* — PRD amendments

- **P1** PRD §6.3 entry-delete row updated from "none in v0
  (deferred to Soon)" to "parent car owner only (for cascade)"
  with an inline amendment note dated 2026-05-28 referencing
  M3 Decision #6 + this dispatch.
- **P2** PRD §8 cost table gets two row amendments this
  dispatch:
  1. **"Log a fill-up"** row from "0 reads, 1 write" to "1
     read, 1 write" with an inline amendment note explaining
     the read is the monotonicity check required by PRD §7
     Flow C edge case (which §8 v1 didn't account for).
  2. **"Home (car list)"** row from "1 query (<10 docs)" to
     "2 queries (owner + sharee, parallel; <10 docs each)"
     with an inline amendment note explaining the schema's
     `ownerUid` vs. `shareeEmails` split requires two queries
     (this is what M3 actually ships; v1's "1 query" wording
     was directional, not literal).
- **P3** BACKLOG → Soon gains entry: "Optional `note` field on
  fuel entries" (XS) — per PRD §11.2 + M4 design Q3.

### V* — Build / Verification (continues M3's V-series; M3 ended at V4)

- **V5** `npm run build:dev` and `npm run build:prod` exit 0.
  Bundle delta captured in handoff. Expected: small (~5-10 KB
  raw / ~2-3 KB gz — no new deps; just new code + entries
  module + log form components).
- **V6** Owner V2 manual test (post-deploy to `flog-dev`;
  requires both `npm run deploy:dev` AND `npm run
  deploy:rules:dev`):
  - Sign in as admin → land on `/` (LogFillupScreen).
  - If zero cars (cleared from M3 V2), see empty state +
    "Add a car →" link.
  - Add a car at `/cars`, navigate back to `/`.
  - Car appears in chips, MRU=this car preselected.
  - Enter odometer 50000, gallons 12, cost 40 → Save → toast
    "Saved" → form clears, car still selected.
  - Save another: odometer 50300, gallons 13, cost 42 → toast
    "Saved".
  - Save another with odometer 50100 (lower than 50300) →
    toast "Odometer went down from 50300. Saved anyway." Entry
    written.
  - Firebase Console: `cars/{carId}/entries` has 3 entries with
    correct fields + server timestamps.
  - Switch car via picker chip → MRU updates (verify in
    localStorage devtools).
  - Reload page → MRU car still preselected.
  - Add a second car, log against it → MRU shifts.
  - Sign out → sign in as a shared account (M3 V2 had one) →
    `/` shows the shared car in chips; can log against it.
  - Delete a car with entries (admin only, on detail screen) →
    confirm dialog → confirm → car gone from list AND all its
    entries gone in Firestore Console (cascade verified).
  - Header "Log" / "Cars" navigation works and active route is
    visually distinguishable.
- **V7** No prod deploy. Per Q4: prod cutover is post-M4.

---

## 9. Stop and ask

Pause and surface before:

1. **Adding any new top-level dependency.** AGENTS guardrail.
   None expected for M4.
2. **Schema change** to `Car` / `Entry` / `User` / `Allowlist`
   beyond the two PRD amendments listed in Decision #11 + AC
   P1/P2. Anything else is stop-and-ask.
3. **Additional `firestore.rules` change** beyond the entries
   delete relaxation in S1. Anything else is stop-and-ask.
4. **Adding `loggedAt` to user input** (e.g., a "log a past
   fill-up" feature with a custom timestamp). AGENTS
   `loggedAt` always serverTimestamp() is load-bearing; any
   deviation is PRD-level conversation.
5. **`catch (err: unknown)` without a clean type guard** for a
   Firebase error code. Same posture as M2/M3.
6. **Toast component complexity creep** — start with the
   simplest thing that works (inline render; absolute-positioned
   div; auto-dismiss via `setTimeout`). If you find yourself
   reaching for a portal, an animation library, or a state
   manager, surface — simple-toast vs. proper-toast-system is
   a real choice with cost trade-offs.
7. **MRU edge case**: what if `getMruCarId()` returns a carId
   the user no longer has access to (deleted, unshared)? §7.7
   pseudocode handles by falling back to first car. If you
   find a cleaner pattern (e.g., validate in `getMruCarId`
   itself), flag in handoff.
8. **Cascade-delete test shape** (T11): two reasonable
   approaches — call the helper directly under test firestore
   context, OR reconstruct the sequence inline. Pick one;
   surface if the chosen one hits a rules-unit-testing rake.
9. **`set-state-in-effect` rule** on any new fetch hook. M4 may
   not need a new hook at all (the monotonicity read can be
   one-shot inside the submit handler). If you DO introduce a
   hook with the suppression pattern, that's the third
   instance — promote the M3 BACKLOG cleanup item from
   "wait for signal" to "earned."
10. **PRD amendment wording** — both §6.3 and §8 amendments
    should match the §6.4 precedent set in M3 V2 (inline
    "amended on DATE because…" notes; clean current-state body).
    If wording feels awkward, propose 2-3 alternatives in the
    handoff rather than committing one.
11. **Multi-toast behavior** unspecified — what happens when
    two saves complete in rapid succession (stacking? replacing
    the prior toast? queuing?). §7.5 single-flow case is well-
    defined; multi-toast emergent behavior is not. Default to
    "newest replaces oldest" if you must pick; flag if the
    behavior surprises during V2.
12. **MRU pattern**: §7.7 uses `setSelectedCarId(prev => ...)`
    functional form to keep the effect deps tight. If you find a
    cleaner pattern (e.g., `useMemo`-derived selection or a
    ref-based latch), surface it rather than rewrite silently —
    the brief committed to a specific pseudocode for race-
    correctness reasons and a different pattern needs equivalent
    correctness analysis.

---

## 10. Dependencies expected

No new runtime or dev dependencies. M4 uses only:

- `firebase` (M1, v11.10.0) — `firestore` subpath imports.
- `react`, `react-dom`, `react-router` — all already installed.
- `vitest`, `@firebase/rules-unit-testing`, `eslint` and
  plugins — all already installed.

If the implementer reaches for a toast library (e.g.,
`react-hot-toast`), that's stop-and-ask (§9 #6).

---

## 11. Handoff guidance

Implementer writes `dispatch/M4-entries-handoff.md` per
`HANDOFF-TEMPLATE.md`. Required sections (template): Status,
Versions chosen (will be empty / "no changes"), Assumptions
made, Deviations from dispatch, Files created, Files NOT
touched (confirmed), Items deferred (to next dispatch / to
BACKLOG), Expected cost impact, Manual steps for the human
owner, Notes for the next dispatch brief.

Specific things to capture:

- The Toast component shape chosen (inline render vs. portal vs.
  library); rationale.
- The cascade-delete test shape (T11) chosen; rationale.
- Whether any new hook introduced `react-hooks/set-state-in-
  effect` suppressions (third instance → promotes the BACKLOG
  cleanup item).
- Bundle delta from M3 baseline (668 KB JS / 175 KB gz).
- Anything M5's implementer (per-car entries list + MPG view)
  will want to know about the Entries module — especially
  `listEntriesForCar`'s shape, ordering, and limit semantics.
- The MRU edge-case handling pattern in `LogFillupScreen.tsx`'s
  initialization — M5's per-car nav may want similar.

---

## 12. Pre-read checklist

The reviewer cuttlefish reads this brief + the supporting
artifacts and reports against:

- **Brief-internal consistency**: §4 decisions ↔ §8 ACs ↔ §5
  files. Every AC has a file; every file has an AC.
- **PRD alignment**: §7.2's `createEntry` payload matches PRD
  §5.3 field-for-field. PRD §7 Flow C steps 1-5 are honored by
  §7.5's save flow. §8 amendment (1 read + 1 write) matches the
  actual code (`getLatestEntry` then `createEntry`).
- **AGENTS alignment**: `loggedAt` always `serverTimestamp()` is
  enforced at the `entries.ts` boundary; single write path; no
  `any`; no real-time listeners; rules-tests as a gate.
- **M2/M3 inheritance**: does the brief assume anything from M3
  the handoff doesn't confirm? Specifically the
  `<CarDetailScreen />` "Fill-ups" placeholder copy (M3 handoff
  AC U4 says it exists; what's the exact current copy?), the
  `<Header />` shape (does it currently have nav slots or just
  app name + sign-out?), the `useCars()` return contract
  (does M4 use it correctly?), and react-router v7 NavLink API
  surface.
- **Routing change risk**: `/` was `CarListScreen` in M3, now
  `LogFillupScreen`. Any deep links from M3 era that would 404?
  No, since `/cars` is the new path and the catch-all
  `<Navigate to="/" replace />` handles unknowns.
- **Firestore API surface**: verify `addDoc`, `orderBy`, `limit`,
  `query`, `getDocs`, `writeBatch`, `serverTimestamp` all
  available in `firebase@11.10.0`'s `firestore` subpath.
- **Rule pattern**: the new entries delete rule uses
  `get(/databases/.../cars/$(carId))` from inside the entries
  scope. Verify `$(carId)` interpolates correctly here (same
  pattern as M2 R3 reads).
- **The "ink not stone" PRD amendments**: §6.3 and §8 changes
  match the §6.4 precedent shape from M3 V2; inline notes
  present.
- **Test scope reality check**: T11 cascade test — does
  `@firebase/rules-unit-testing@4` support invoking a helper
  function that issues a multi-step (getDocs + writeBatch +
  deleteDoc) sequence? If not, the alternative inline
  reconstruction works.
- **`Timestamp` type import**: `entries.ts` `Entry` interface
  uses `Timestamp` — needs import from `firebase/firestore`.
- **Missing edge cases**:
  - What if `getLatestEntry` itself fails (network)? Brief says
    save throws → toast.error. Is that the right UX? (Likely
    yes — fail-loud beats silent-skip-monotonicity.)
  - What if MRU localStorage value is non-string (corrupt)?
    `getMruCarId` should return null safely.
  - What if two tabs are open and both have stale `cars` lists?
    No conflict; createEntry doesn't depend on car list freshness.
- **Scope discipline**: nothing M5 (entries list rendering, MPG
  calculation) snuck in. Brief says explicit "stub for M5" on
  `listEntriesForCar`.

Report format: BLOCKING / SHOULD-FIX / NITS / CONFIRMED-OK.
Reviewer modifies no files.

---

## 13. Forward feedback channel

If the implementer hits rakes during execution that future
flog dispatches (or paralarva-kit consumers) should know about,
add them here as numbered items. Examples of what belongs here:

- Mobile numeric keypad behavior surprises across Chrome
  Android vs. iOS Safari.
- `@firebase/rules-unit-testing@4` cross-document cascade test
  patterns.
- Tailwind v4 / NavLink active-state styling gotchas.

Rakes captured during execution + V6. See the handoff Post-
ship findings for the full narrative on V6 rakes.

1. **Placeholder copy in v0 user-facing surfaces is bad UX.**
   M4 brief AC U17 asked the implementer to update the
   `<CarDetailScreen />` Fill-ups placeholder text from
   "Entries and MPG will land in a future update." to "Entries
   and MPG land in the next update." Owner caught during V6
   that the whole placeholder is wrong — leaks implementation
   jargon ("the next update") to users and frames the section
   by what's *missing* rather than what's there. Fix:
   removed the entire placeholder section; M5 adds it back
   with real content. **Recommendation for future briefs**:
   when a milestone leaves a UI region empty in v0, the
   default should be "don't render anything" — not "render a
   placeholder explaining the absence." Placeholder copy is
   appropriate for first-load loading states or zero-data
   cases (where the user has a context-specific expectation
   that something *should* be there), not for milestone-gap
   regions (where the user has no expectation at all).

2. **`NumericField` deliberately uses `type="text"` plus an
   `inputmode` attribute** (`"numeric"` for odometer,
   `"decimal"` for gallons/cost) rather than literal
   `type="number"` (which AC U13 originally specified).
   Implementer's rationale captured in handoff Assumptions:
   `type="number"` strips leading zeros in some browsers,
   refuses certain decimal patterns, and exposes spinner
   controls that are pointless on mobile. The `inputmode`
   attribute alone gets the mobile numeric keypad without the
   value-mangling. Owner accepted at M4 closure; flagging
   here so future briefs default to `type="text"` +
   `inputmode` for numeric input rather than `type="number"`.

3. **`react-hooks/set-state-in-effect` suppression hit a
   third+fourth instance** in M4 (`useCars`/`useCar` from M3
   were instances 1 and 2; M4's `useEntries` was poised to be
   #3 but the brief's `getLatestEntry` was used inline in the
   submit handler rather than via a hook, avoiding the
   suppression). The BACKLOG → Later "Replace suppressions
   with a cleaner pattern" item is now promoted to Soon
   per M4 closure decision. M5's `useEntries(carId)` will be
   the actual third instance — implementer there should add
   the same narrow suppression, then the cleanup dispatch
   refactors all three to a subscribe-style abstraction.

---

End of brief.
