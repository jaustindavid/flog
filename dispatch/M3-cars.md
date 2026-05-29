# M3 — Cars (CRUD + share)

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

**Status**: draft — pending pre-read by reviewer cuttlefish (per
WORKING-MODEL §3) before implementer dispatch.

---

## 1. Context

M3 is v0's third milestone (PRD §10). Builds atop M2's auth shell:

- M2 shipped Google sign-in, allowlist gate, first-sign-in
  `users/{uid}` creation, `RejectedScreen`, `EmptyHomeScreen`,
  full PRD §6 firestore rules + 38 rules tests, ESLint, accent
  color. See `dispatch/M2-auth-allowlist-handoff.md` — especially
  the "Post-ship findings" section (V2 discoveries: `authDomain`
  → hosting domain, `prompt: 'select_account'`, un-swallowed
  `getRedirectResult`).

M3's job:

- Wire Cars CRUD: create / rename / delete (owner-only) + read
  (owner OR sharee).
- Wire Share / Unshare with atomic batched writes (Car update +
  allowlist doc create per AGENTS).
- Introduce routing — `/` (home) and `/cars/:carId` (detail).
- Replace `EmptyHomeScreen` with `CarListScreen` (handles empty
  state inline).
- Introduce `Header` component with persistent sign-out across
  signed-in routes.
- Introduce `components/` directory for first sub-page widgets.

M4 (Entries / log fill-up) ships next; M5 adds the entries list +
MPG block to the car detail surface (currently scaffolded blank
in M3).

**Prod deploy is NOT in scope.** M3 runs dev-only, same posture
as M2. Prod cutover is anchored to M4 close (first usable
surface).

---

## 2. Required reading

In order:

1. [`../PRD.md`](../PRD.md) — §1.4 (philosophical commitments),
   §4 (architecture), §5 (data model — load-bearing),
   §6 (access control — load-bearing), §7 Flows B / D / E / F
   (first-sign-in-invited / add-car / share / detail), §8 (cost
   spec), §9 (UI), §10 (M3 row), §11.2 (open questions —
   entry-edit is NOT M3 but referenced).
2. [`../AGENTS.md`](../AGENTS.md) — all of it. The flog-specific
   guardrails about share-write atomicity, email canonicalization,
   one Car-update helper, and the test gates are load-bearing.
3. [`../WORKING-MODEL.md`](../WORKING-MODEL.md) — §3 (pre-read
   pattern; this brief expects to be pre-read), §5 (operational
   conventions), §6 (antipatterns).
4. [`../HANDOFF-TEMPLATE.md`](../HANDOFF-TEMPLATE.md) — for the
   handoff doc shape at the end.
5. [`M2-auth-allowlist-handoff.md`](M2-auth-allowlist-handoff.md)
   — current code state, especially:
   - "Post-ship findings" (V2 fixes that aren't in the M2 brief)
   - "Items deferred → To the next dispatch (M3)" (the M2 author's
     hand-off notes for you)
   - "Files created" (what exists; what `cars/` module needs to
     create alongside)
6. [`M2-auth-allowlist.md`](M2-auth-allowlist.md) — original M2
   brief, especially §13 (forward feedback) for Chrome rakes
   you'll inherit.

---

## 3. Scope

### In scope

- **Cars Firestore module** (`src/cars/`):
  - `createCar(name)` — creates Car doc; `ownerUid = auth.uid`;
    `shareeEmails = []`; `createdAt = serverTimestamp()`; returns
    the new carId.
  - `renameCar(carId, newName)` — owner-only update of `name`
    field. Single helper used by all rename call sites.
  - `deleteCar(carId)` — owner-only. Deletes the Car doc only.
    Entries cleanup deferred to M4 per Decision #6.
  - `shareCar(carId, email)` — **read-then-atomic-batch**: read
    `allowlist/{email}` first; then a single `writeBatch` with
    `arrayUnion(email)` on `cars/{carId}.shareeEmails` AND (only
    if the allowlist doc didn't exist pre-read) a
    `setDoc(allowlist/{email}, {})`. `arrayUnion` is idempotent
    at the Firestore level; UI layer also blocks duplicates
    pre-write. Per Decision #16.
  - `unshareCar(carId, email)` — `arrayRemove(canonical(email))`
    on `shareeEmails`. **Does NOT touch the allowlist** (PRD
    §5.4: sharee retains app access on own data).
  - `listMyCars(userUid, userEmail)` — two parallel queries
    (`where ownerUid == userUid` + `where shareeEmails
    array-contains userEmail`), deduped client-side, returns
    `Car[]`. Empty array if none.
  - `getCar(carId)` — single-doc fetch.
- **Hooks** (`src/cars/useCars.ts`, `useCar.ts`) — wrap the above
  for use from screens. Loading / error / data state.
- **Routing** — `react-router@^7`, declarative `<Routes>`/`<Route>`
  API (not the framework data router). Routes:
  - `/` → `<CarListScreen />`
  - `/cars/:carId` → `<CarDetailScreen />`
  - `*` → `<Navigate to="/" replace />`
  Routes live inside the `signed-in` branch of the auth state
  machine only. `signed-out` / `loading` / `rejected` continue to
  render as full-screen non-routed states.
- **Header component** (`src/components/Header.tsx`) — wraps
  signed-in routes. Shows app name + sign-out button. Persistent
  across `/` and `/cars/:carId`. Sign-out moves here from
  `EmptyHomeScreen` (which is deleted — see §5).
- **New screens** (`src/screens/`):
  - `CarListScreen.tsx` — replaces `EmptyHomeScreen`. Shows
    cars-list-or-empty-state. "Add car" button always visible.
  - `CarDetailScreen.tsx` — name, sharees list (owner sees
    unshare X-icons), share form (owner only), rename action
    (owner only), delete action (owner only). Reserved blank
    region for the entries list + MPG (M5).
- **New components** (`src/components/`):
  - `Header.tsx`
  - `CarListItem.tsx`
  - `AddCarModal.tsx`
  - `RenameCarForm.tsx` (inline edit or modal — implementer's
    judgment; flag in handoff)
  - `ShareForm.tsx`
  - `SharedWithList.tsx` (owner-only renderable; unshare icons)
  - `ConfirmDialog.tsx` (generic; used by delete)
- **Validation helpers** (pure functions, unit-tested):
  - `validateCarName(raw): {ok, reason?}` — trims, blocks empty,
    soft max length (implementer picks; ~100 char default is
    fine).
  - `isValidEmailFormat(email)` — simple regex (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`),
    not RFC-compliant but catches typos. After canonicalize.
- **UI guardrails on share form** (all before write):
  - Empty email → block, "Enter an email"
  - Invalid format → block, "Enter a valid email"
  - Sharing with self → block, "You already have access to this car"
  - Email already in `shareeEmails` → block, "Already shared with X"
- **Tests**:
  - Unit tests for `validateCarName`, `isValidEmailFormat`, and
    any helper exported from `src/cars/cars.ts` that's pure (e.g.,
    a dedup helper if you write one).
  - Rules tests in `tests/rules/` are mostly unchanged from M2 —
    the rules don't change. Add tests that specifically exercise
    the **batched share-write atomicity** (one positive: both
    writes succeed when authorized; one negative: the batched
    write fails as a unit if the user can't write to `allowlist`).

### Out of scope (defer)

- **Entries / log fill-up form** — M4.
- **Entries cascade-delete on car delete** — M4 (pinned by
  Decision #6; pairs naturally with M4 entries-create since
  the entries-delete rule needs to relax there anyway).
- **Per-car MPG + entries list** — M5. The car detail screen
  scaffolds a placeholder/empty region.
- **`onSnapshot` real-time updates** — PRD §1.2 non-goal. Lists
  refresh on navigation / pull-to-refresh / explicit reload.
- **Sharing onward** — sharees cannot share. Owner-only per
  PRD §5.2.
- **Explicit allowlist revocation / blacklist UI** — BACKLOG →
  Later.
- **Account deletion** — BACKLOG → Later (PRD §1.4 commits;
  not in v0).
- **Editing `displayName`** — rule allows it; no UI in M3.
- **Multi-tenant household concept** — never. Cars are
  individually owned + shared per PRD §1.2.

---

## 4. Decisions locked in (from design conversation 2026-05-28)

These are settled. Implementer treats as fixed unless flagged
stop-and-ask.

1. **Adopt `react-router@^7`.** Declarative API
   (`<BrowserRouter>` / `<Routes>` / `<Route>`), not the data
   router / framework mode. No loaders, no actions, no nested
   data fetching — fetching stays in hooks. Imports from
   `react-router` (v7 merged `react-router-dom` back in).
2. **Routes**: `/` → `<CarListScreen />`, `/cars/:carId` →
   `<CarDetailScreen />`, `*` → `<Navigate to="/" replace />`.
3. **Add Car is a modal/sheet on `/`** (no `/cars/new` route).
   Modal closes back to `/`; on successful create, optionally
   navigate to the new `/cars/:carId` (implementer's choice;
   flag in handoff).
4. **Car list query = two parallel queries** (`where ownerUid ==
   uid` + `where shareeEmails array-contains email`), deduped
   client-side by carId. Schema unchanged. PRD §8's "1 query"
   wording is interpreted as "one combined fetch."
5. **Car detail in M3 is scaffold-only.** Name, sharees, owner
   controls land here. Entries list + MPG region is rendered as
   an empty/reserved block ("Entries and MPG land in a future
   update.") — M5 fills it.
6. **Delete-car deletes only the Car doc in M3** — no entries
   cleanup. M2's `firestore.rules` denies entries delete
   (`allow delete: if false`); shipping cleanup code in M3 would
   no-op in M3 (no entries exist) and silently fail at the rules
   layer post-M4 (when entries do exist). Cleaner: M4 ships both
   entries-create AND the cascade-delete rule (`allow delete: if
   request.auth.uid == ownerUid(parentCar)`) AND extends `deleteCar`
   to batch-delete entries first. M3 stays narrow. Pre-read 2026-
   05-28 caught this; original M3 design conversation Q4 answer
   ("ship in M3") is overridden by this rule reality.

   **This overrides PRD §6.2's note "Captured as an
   implementation note for the M3 brief"** — the cascade-delete
   *requirement* still stands (the data shape doesn't cascade,
   so app code must), but the *milestone assignment* moves to
   M4. The PRD's §6 NOT-touch posture means the note stays; the
   M3/M4 boundary lives in dispatch docs.
7. **Owner-only controls conditionally rendered** on car detail.
   Sharees see name + sharees list; no rename / delete / share
   form.
8. **`components/` directory introduced** for the listed widgets.
9. **No real-time freshness.** PRD §1.2 stands. Lists are stale
   until navigation refresh.
10. **Sharee identity is email** per PRD §5.2. Known v0 trade-off:
    if a sharee changes their Google primary email, they lose
    access. Filed as BACKLOG → Later candidate, not a M3 blocker.
11. **Sign-out moves to `Header`** — persistent button (no
    account menu), one click. Shared across all signed-in routes.
    `EmptyHomeScreen.tsx` is deleted (replaced by
    `CarListScreen`'s inline empty state).
12. **Atomic share-write via `writeBatch`** from
    `firebase/firestore`. Single helper `shareCar(carId, email)`
    in `src/cars/cars.ts`; no inline batched-write sites elsewhere.
13. **Email canonicalization at the form boundary.**
    `canonicalEmail()` (existing) applied in the `ShareForm`
    component before any read/write. All downstream `cars.ts`
    helpers assume canonical input.
14. **One Car-update helper.** Per AGENTS: all car writes go
    through `src/cars/cars.ts` exports; no inline `updateDoc(doc(...),
    {...})` for cars elsewhere. Helper functions assert ownership
    via the rule (which enforces `ownerUid` immutability) — no
    client-side bypass.
15. **`arrayUnion` / `arrayRemove`** from `firebase/firestore`
    for `shareeEmails` mutations. Idempotent at the Firestore
    level; UI dedup is defense-in-depth.
16. **Read allowlist before the batched share write** — matches
    PRD §8 exactly. **The original Decision #16 said "skip the
    read; `setDoc` is idempotent" — that's wrong against M2's
    deployed rules.** M2's allowlist rule is `allow create: if
    allowed(...)` AND `allow update: if false`. So `setDoc` on a
    pre-existing allowlist doc (which happens any time the email
    is already on the allowlist from a prior share to a different
    car) fires the update rule, gets denied, and the whole
    batched share write fails. The correct pattern:
    `getDoc(allowlist/{email})` first; if the doc doesn't exist
    include `batch.set(allowlist)` in the share write, otherwise
    only `batch.update(car)`. PRD §8 cost: 1 read + 1 write (when
    sharee email already allowlisted) OR 1 read + 2 writes (first
    share to this email) — same as §8 specifies. Pre-read 2026-
    05-28 caught this; corrected before dispatch.
17. **Pre-read required** (per WORKING-MODEL §3; M-sized work).

---

## 5. Files in play

```text
flog/
├── package.json                            (modified — react-router dep)
├── src/
│   ├── App.tsx                             (modified — router wrap)
│   ├── cars/
│   │   ├── cars.ts                         (new — Firestore CRUD)
│   │   ├── useCars.ts                      (new — list-my-cars hook)
│   │   ├── useCar.ts                       (new — single-car hook)
│   │   ├── validateCarName.ts              (new — pure helper)
│   │   ├── validateCarName.test.ts         (new)
│   │   ├── isValidEmailFormat.ts           (new — pure helper)
│   │   └── isValidEmailFormat.test.ts      (new)
│   ├── components/                         (new directory)
│   │   ├── Header.tsx                      (new — sign-out + branding)
│   │   ├── CarListItem.tsx                 (new)
│   │   ├── AddCarModal.tsx                 (new)
│   │   ├── RenameCarForm.tsx               (new — inline or modal; pick)
│   │   ├── ShareForm.tsx                   (new — owner-only)
│   │   ├── SharedWithList.tsx              (new — sharees + unshare X)
│   │   └── ConfirmDialog.tsx               (new — generic)
│   └── screens/
│       ├── CarListScreen.tsx               (new — replaces EmptyHome)
│       ├── CarDetailScreen.tsx             (new)
│       └── EmptyHomeScreen.tsx             (DELETED)
└── tests/
    └── rules/
        └── cars.test.ts                    (modified — add batch tests)
```

The auth module (`src/auth/`), Firebase wiring (`src/firebase/`),
and Loading/SignedOut/Rejected screens are unchanged.

---

## 6. Files NOT to touch

- `PRD.md`
- `AGENTS.md`
- `BACKLOG.md`
- `CUTTLEFISH-NAUTILUS.md`
- `WORKING-MODEL.md`
- `HANDOFF-TEMPLATE.md`
- `README.md`
- This brief (`dispatch/M3-cars.md`) — except §13 forward feedback
  if a rake is captured.
- All `dispatch/M1-*` and `dispatch/M2-*` files — closed records.
- `dispatch/paralarva-feedback-*.md` — closed forward-feedback
  artifacts.
- `dispatch/runbooks/gcp-firebase-env-setup.md` — closed.
- `.firebaserc`, `firebase.json`, `vite.config.ts`,
  `tsconfig.app.json`, `tsconfig.node.json`,
  `tsconfig.test.json`, `tsconfig.json`, `eslint.config.js`,
  `vitest.config.ts`, `vitest.rules.config.ts` — M1/M2 set these;
  no changes for M3.
- `src/firebase/config.ts`, `src/firebase/app.ts`,
  `src/firebase/auth.ts`, `src/firebase/firestore.ts` — M2
  set these.
- `src/auth/*` — M2 set these. Sign-out is invoked from `Header`
  via `useAuth().signOut`; no AuthProvider changes needed.
- `src/screens/LoadingScreen.tsx`,
  `src/screens/SignedOutScreen.tsx`,
  `src/screens/RejectedScreen.tsx` — M2 surfaces; unchanged.
- `firestore.rules` and the M2 rules tests for users / entries
  / allowlist — rules are not changing. `tests/rules/cars.test.ts`
  is the only rules-test file that grows (adding batch tests).
- `src/index.css` — accent block stays; no new tokens for M3.
- `.env.development`, `.env.production` — no new vars.

---

## 7. Architecture sketch

### 7.1 App composition

```text
<BrowserRouter>
  <AuthProvider>
    <AuthGated>
      {status === 'loading'  → <LoadingScreen />}
      {status === 'signed-out' → <SignedOutScreen />}
      {status === 'rejected'   → <RejectedScreen email={user?.email} />}
      {status === 'signed-in'  →
        <>
          <Header />
          <Routes>
            <Route path="/"            element={<CarListScreen />} />
            <Route path="/cars/:carId" element={<CarDetailScreen />} />
            <Route path="*"            element={<Navigate to="/" replace />} />
          </Routes>
        </>
      }
    </AuthGated>
  </AuthProvider>
</BrowserRouter>
```

`AuthGated` is just an inline component reading `useAuth()` —
extracted only if it makes `App.tsx` cleaner. `BrowserRouter`
wraps `AuthProvider` so the (rare) future need for navigate-on-
auth-event is available; the router is otherwise inert outside
the signed-in branch.

**Note on the App.tsx refactor**: M2's `App.tsx` switches on
`if (user)` with a defensive fallback for `signed-in && !user`.
M3 should restructure to a status-equality switch (matching the
sketch above) and drop the defensive fallback (or keep it
narrowed to `signed-in && user`, with TS exhaustiveness benefit).
Don't try to minimal-edit by inserting a router under the
existing `if (user) return <EmptyHomeScreen ...>` — replace the
branching shape outright. EmptyHomeScreen is deleted in M3
(AC U9); the new signed-in branch mounts `<Header /> +
<Routes>` instead.

### 7.2 `src/cars/cars.ts` shape

Pure boundary between screens/hooks and Firestore. Every
exported function takes canonical inputs (email = lowercase
canonical; name = pre-validated) — callers normalize first.

```ts
export async function createCar(
  name: string,
  ownerUid: string
): Promise<string> {
  const ref = doc(collection(firestore, 'cars'));
  await setDoc(ref, {
    name,
    ownerUid,
    shareeEmails: [],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function renameCar(carId: string, name: string): Promise<void> {
  await updateDoc(doc(firestore, 'cars', carId), { name });
}

export async function deleteCar(carId: string): Promise<void> {
  // M3 deletes only the Car doc. Entries cleanup deferred to M4
  // (rules currently deny entries delete; M4 ships both the rule
  // relaxation and the cascade). See Decision #6.
  await deleteDoc(doc(firestore, 'cars', carId));
}

export async function shareCar(carId: string, email: string): Promise<void> {
  // Atomic per AGENTS share-write guardrail.
  // Read allowlist first to decide whether to include the set in
  // the batch — M2 rules deny update on allowlist, so setDoc on a
  // pre-existing doc would deny the whole batch. See Decision #16.
  const allowlistRef = doc(firestore, 'allowlist', email);
  const allowlistSnap = await getDoc(allowlistRef);

  const batch = writeBatch(firestore);
  batch.update(doc(firestore, 'cars', carId), {
    shareeEmails: arrayUnion(email),
  });
  if (!allowlistSnap.exists()) {
    batch.set(allowlistRef, {});
  }
  await batch.commit();
  // Invariant after commit: shareeEmails contains email AND
  // allowlist/{email} exists (either from this batch or pre-
  // existing). AGENTS atomicity guardrail upheld either way.
}

export async function unshareCar(carId: string, email: string): Promise<void> {
  await updateDoc(doc(firestore, 'cars', carId), {
    shareeEmails: arrayRemove(email),
  });
  // NB: allowlist doc intentionally retained — PRD §5.4.
}

export async function listMyCars(
  uid: string,
  email: string
): Promise<Car[]> {
  const [ownedSnap, sharedSnap] = await Promise.all([
    getDocs(query(collection(firestore, 'cars'), where('ownerUid', '==', uid))),
    getDocs(query(collection(firestore, 'cars'), where('shareeEmails', 'array-contains', email))),
  ]);
  const map = new Map<string, Car>();
  ownedSnap.forEach(d => map.set(d.id, { id: d.id, ...d.data() } as Car));
  sharedSnap.forEach(d => map.set(d.id, { id: d.id, ...d.data() } as Car));
  return Array.from(map.values());
}

export async function getCar(carId: string): Promise<Car | null> {
  // Return null on either not-found OR permission-denied so the
  // caller can render "Car not found or no access" without
  // distinguishing. Other errors re-throw.
  try {
    const snap = await getDoc(doc(firestore, 'cars', carId));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Car) : null;
  } catch (err: unknown) {
    if (
      typeof err === 'object' && err !== null &&
      'code' in err && (err as { code: unknown }).code === 'permission-denied'
    ) {
      return null;
    }
    throw err;
  }
}
```

(Pseudocode for illustration; implementer writes the real
TypeScript — including the `Car` interface, error handling,
and any type narrowing helpers. `Car` should mirror PRD §5.2
field-for-field.)

### 7.3 Hooks

```ts
// useCars — list view
export function useCars() {
  const { user } = useAuth();
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ready'; cars: Car[] }
    | { status: 'error'; error: unknown }
  >({ status: 'loading' });

  // Epoch counter guards against out-of-order resolution: if
  // refresh() is called twice in quick succession, only the
  // newer fetch's result is committed to state. Without this,
  // an older in-flight fetch can resolve after a newer one and
  // overwrite the fresh data with stale data — common in
  // add-then-delete or rapid-tap scenarios.
  const epochRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    const epoch = ++epochRef.current;
    setState({ status: 'loading' });
    try {
      const cars = await listMyCars(user.uid, canonicalEmail(user.email));
      if (epoch !== epochRef.current) return;  // stale; discard
      setState({ status: 'ready', cars });
    } catch (error) {
      if (epoch !== epochRef.current) return;
      setState({ status: 'error', error });
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  return { ...state, refresh };
}

// useCar(carId) — single-car detail. Same epoch-guarded shape
// as useCars; single-doc fetch via getCar(carId).
export function useCar(carId: string) {
  // (Same pattern; same race-guard. Implementer writes it out.)
}
```

`canonicalEmail()` accepts null/undefined and returns `''`
(M2's contract — see `src/auth/canonicalEmail.ts`). No `!`
non-null assertion needed. If `user.email` is null, the array-
contains query returns zero shared cars, which is the correct
behavior (a user with no email can't be a sharee of anything).

Refresh-after-mutation pattern: after `createCar` / `deleteCar` /
`shareCar` / `unshareCar` succeeds, call the relevant hook's
`refresh()`. No global cache; family scale tolerates the re-fetch
cost (each re-fetch ≤10 reads). The epoch guard ensures rapid
sequences resolve to the latest state.

### 7.4 Atomic share-write — rule interaction

The batched write in `shareCar` issues:

- `update cars/{carId}` with `shareeEmails: arrayUnion(email)`
- `set allowlist/{email}` with `{}`

Both must pass rules independently. The car update rule (M2 R2)
requires `ownerUid == auth.uid` (so only owner can update). The
allowlist create rule (M2 R4) requires
`allowed(request.auth.token.email)` (so the requester must
themselves be allowlisted). Owner trivially is (they're either
admin or already in the allowlist).

If the rules deny *either* write, the entire batch fails. That's
the atomicity guarantee. Add a rules test that:

- Owner with admin email tries `shareCar(carId, sharee@example)` →
  both writes accepted (positive).
- Sharee (not owner) tries `shareCar(carId, other@example)` →
  whole batch fails (negative — car update rule denies).
- Non-allowlisted user tries to write directly to allowlist via
  a non-batched call → denied (existing M2 test; verify it still
  holds).

### 7.5 Car detail screen — M5 scaffold

```text
<CarDetailScreen>
  <Header />  // shared
  <main>
    <h1>{car.name}</h1>
    {isOwner && <RenameCarForm car={car} onRenamed={refresh} />}

    <section>
      <h2>Shared with</h2>
      <SharedWithList
        car={car}
        canUnshare={isOwner}
        onUnshared={refresh}
      />
      {isOwner && <ShareForm car={car} onShared={refresh} />}
    </section>

    <section>
      <h2>Fill-ups</h2>
      <p>Entries and MPG will land in a future update.</p>
    </section>

    {isOwner && <ConfirmDialogTrigger
      label="Delete car"
      message={`Delete ${car.name}? This cannot be undone.`}
      onConfirm={() => deleteCar(car.id).then(() => navigate('/'))}
    />}
  </main>
</CarDetailScreen>
```

`isOwner = car.ownerUid === user.uid`. The reserved Fill-ups
section gives M5 a known insertion point.

### 7.6 Error and edge cases

- **404-style: invalid carId in URL OR you've lost access** —
  `getCar(carId)` returns null OR the get fails with permission-
  denied. CarDetailScreen renders a friendly "Car not found or
  no access" message with a "← Back to cars" link.
- **Add car submit with empty name** — UI blocks before write.
- **Share with self / existing sharee / invalid email** — UI
  blocks before write (per Decision #4 list).
- **Network errors on any write** — surface inline error
  (`"Couldn't save — try again"`); preserve form state so the
  user can retry without re-typing.
- **Concurrent share with two emails from two tabs** — both writes
  use `arrayUnion`; the union resolves to both emails. No
  conflict. (Real-world: doesn't matter at family scale.)
- **Two-tab race on first-share-to-same-new-email** — vanishingly
  rare but worth naming for honesty. Between the `getDoc(allowlist)`
  pre-read and the `batch.commit()`, another session can create
  the allowlist doc. Our batch's `batch.set(allowlist)` then hits
  M2's `allow update: if false` rule and the whole batch fails
  with permission-denied. UI surfaces the standard "Couldn't
  save — try again" message; the retry's pre-read finds the now-
  existing allowlist doc, skips the set, and the Car update
  succeeds in isolation. Acceptable v0 behavior; would be cleaner
  with a `runTransaction`, but transactions on disjoint paths
  add complexity vs. the actual user-visible impact (one retry,
  family scale, ~never happens).

---

## 8. Acceptance criteria

Numbered by subsection (WORKING-MODEL §5 prefix-numbering).

### C* — Cars module

- **C1** `src/cars/cars.ts` exports `createCar`, `renameCar`,
  `deleteCar`, `shareCar`, `unshareCar`, `listMyCars`, `getCar`.
  No inline Firestore write calls for cars exist anywhere else.
- **C2** `createCar` writes a Car doc with `name`, `ownerUid`,
  `shareeEmails: []`, `createdAt: serverTimestamp()`. PRD §5.2
  also lists `id` as a row, but the auto-generated Firestore
  doc ID is the source of truth — do NOT also write `id` into
  the body (the User doc redundantly stores `uid` in body per
  M2 `firstSignIn.ts:34`; for cars we don't repeat that, since
  there's no Auth-vs-Firestore boundary asking for it).
- **C3** `renameCar` updates only `name`; rules enforce
  `ownerUid` immutability (no test required beyond the existing
  M2 rules tests).
- **C4** `deleteCar` deletes the Car doc only. Entries cleanup
  is deferred to M4 per Decision #6 (M2 rules deny entries
  delete; M4 ships both the rule relaxation and the cascade).
- **C5** `shareCar` reads `allowlist/{email}` then issues a
  single `writeBatch` containing the Car update (`arrayUnion`)
  AND — only if the allowlist doc didn't exist pre-read — the
  `allowlist/{email}` set. Atomicity contract: after the call
  resolves, `shareeEmails` contains the email AND
  `allowlist/{email}` exists. Per Decision #16.
- **C6** `unshareCar` removes from `shareeEmails` only; does NOT
  touch `allowlist`.
- **C7** `listMyCars` issues two parallel queries (owned +
  shared), deduplicates client-side by `carId`, returns `Car[]`.
- **C8** `getCar` returns `Car | null`; null on
  `not-found` / `permission-denied`.
- **C9** `useCars` and `useCar` both implement the epoch race
  guard per §7.3 — an in-flight fetch whose epoch is stale at
  resolution time is discarded on **both** success and error
  paths (no `setState` from a stale resolution). Without this,
  rapid sequences (add-then-delete, etc.) can leave the UI
  showing stale data silently. This is a non-obvious correctness
  requirement; the guard is not optional.

### R* — Routing + structure

- **R1** `react-router@^7` installed (declarative API). Imports
  from `react-router` (not `react-router-dom`; v7 merged it).
- **R2** `App.tsx` wraps `<AuthProvider>` with `<BrowserRouter>`.
  Routes are mounted only in the `signed-in` branch.
- **R3** Routes: `/` → `<CarListScreen />`,
  `/cars/:carId` → `<CarDetailScreen />`,
  `*` → `<Navigate to="/" replace />`.
- **R4** Refresh-on-deep-link (`/cars/:carId`) works:
  AuthProvider resolves, then route activates, `useCar(carId)`
  fetches. No flash of "not found" before auth resolves.

### U* — UI surfaces + components

- **U1** `<Header />` shows app name ("flog") and a sign-out
  button (≥44pt tap target, blue-600). Persistent across all
  signed-in routes. If a user identity label is shown, use
  fallback chain `displayName || email || 'Signed in'` (logical-
  OR, not `??` — empty string from `firstSignIn.ts:37` would
  otherwise pass the `??` guard and render blank).
- **U2** `<CarListScreen />` — empty state: "No cars yet" +
  "Add car" button. Non-empty: list of `<CarListItem />` (name,
  tap to detail) + "Add car" button still visible at top or
  bottom.
- **U3** `<AddCarModal />` — text input (autofocused), "Create"
  button (disabled while name empty/whitespace), "Cancel"
  button. Enter key submits; **Esc closes** (accessibility
  floor). On successful create, refresh the list (optionally
  navigate to the new car detail — implementer's call; flag in
  handoff). Accessibility floor for any modal in M3: autofocus
  primary input, Esc-to-close, an explicit Cancel button.
  Focus-trap and full ARIA roles are out of scope for v0;
  defer to a future accessibility pass (BACKLOG → Later if
  it earns its keep).
- **U4** `<CarDetailScreen />` — name (large), "Shared with"
  section with `<SharedWithList />`, owner-only `<ShareForm />`
  and rename action and delete action. Reserved "Fill-ups"
  section with placeholder copy.
- **U5** `<ShareForm />` (owner-only) — email input + Add
  button. Pre-write validation per Decision §3 list (empty,
  invalid format, self, already-sharee). Inline error messages.
  Email canonicalized via `canonicalEmail()` before any write.
- **U6** `<SharedWithList />` — renders `car.shareeEmails`;
  if `canUnshare`, shows an X (or "Remove") next to each email.
  Click triggers `unshareCar(carId, email)` + parent refresh.
- **U7** `<ConfirmDialog />` (generic) — accepts title /
  message / confirm-label / on-confirm. Used by delete-car.
- **U8** All screens mobile-first (375px viewport, no horizontal
  scroll); tap targets ≥44pt; accent stays `blue-600`
  (destructive actions can use red but no new accent tokens
  added to `index.css`).
- **U9** `EmptyHomeScreen.tsx` deleted. Sign-out moves to
  `<Header />`. `main.tsx` / `App.tsx` no longer imports it.
- **U10** Sharees navigating to a car they don't have access to
  (deep-link / stale link) see "Car not found or no access" with
  a back-to-home link.

### T* — Tests

- **T1** Unit tests for `validateCarName` (empty, whitespace-
  only, max-length boundary, normal case) and `isValidEmailFormat`
  (valid / no @ / no domain / spaces / unicode-domain — pick a
  reasonable subset).
- **T2** Rules-test additions in `tests/rules/cars.test.ts`:
  - **Positive — first-time share**: owner (allowlisted) issues
    the shareCar batch where the allowlist doc does NOT pre-exist;
    both writes succeed.
  - **Positive — second share to already-allowlisted email**:
    owner issues the conditional batch (only `update cars/{carId}`,
    no allowlist set since pre-read found existing doc); update
    succeeds.
  - **Negative — atomicity proof**: a *sharee* of car-A (so they
    ARE allowlisted, but NOT owner of car-A) attempts to share
    car-A with a new email. Their hypothetical allowlist set
    would pass standalone (they're allowlisted); their car update
    fails (not owner). Batch fails as a unit → assert the new
    email's allowlist doc was NOT created. This is the test that
    actually exercises batch atomicity, vs. the easy "everything
    denies independently" case which doesn't.
  - Existing M2 cars tests still pass.
- **T3** `npm test` exits zero; `npm run test:rules` exits zero.

### L* — Lint + types

- **L1** `npm run lint` exits zero across `src/` and `tests/`.
- **L2** `npm run lint:md` exits zero.
- **L3** Strict TypeScript: no `any`; catch clauses use
  `unknown` + type guards per M2 precedent.

### V* — Verification

- **V1** `npm run build:dev` and `npm run build:prod` exit zero.
  Bundle delta over M2 baseline (605 KB JS) captured in
  handoff — react-router will add ~20-40 KB.
- **V2** Owner manual test (post-deploy to `flog-dev`):
  - Admin signs in cold → CarListScreen empty state.
  - Click "Add car" → modal → type name → Create →
    CarListScreen with the new car listed.
  - Tap the car → CarDetailScreen.
  - Rename → confirm → name updates on detail and list.
  - Share with a second Google account's email → confirm batched
    write (Firebase Console: car has the new email in
    `shareeEmails`; `allowlist/{email}` exists).
  - Sign out, sign in as the shared account → CarListScreen
    shows the shared car. Open it; rename/delete/share controls
    absent (sharee view).
  - Sign back in as admin, unshare → confirm shareeEmails
    no longer has the email; allowlist doc still exists (PRD
    §5.4).
  - Delete car → confirm dialog → confirm → returns to
    CarListScreen; car gone.
- **V3** Cost-impact check: per-action reads/writes match the
  shape in §7.2's pseudocode + Decision #16 (read allowlist
  first; conditional `batch.set`). Capture in handoff — at-or-
  below PRD §8's worst case (§8's "1 + 2" is the first-share
  path; second-share-to-already-allowlisted-email is 1 + 1).
- **V4** No prod deploy. M3 ships dev-only; prod at M4 close.

---

## 9. Stop and ask

Pause and surface before:

1. **Adding any new top-level dependency** beyond `react-router`.
   AGENTS guardrail.
2. **Schema change** (new field, type change, renaming) to
   `Car` / `User` / `Allowlist`. PRD §5 is the contract.
3. **Rules change** to `firestore.rules`. PRD §6 + M2's tests are
   the contract; M3 doesn't need new rules.
4. **Routing strategy deviation** (data router / loaders /
   different library) — Decision #1 says declarative; surface if
   you find a compelling reason to change.
5. **Storing data in any new collection** beyond what PRD §5
   defines.
6. **Sign-out semantics change** — sign-out stays as M2's
   implementation; only the *placement* changes (to `Header`).
7. **Encountering an `arrayUnion` / `arrayRemove` edge case** —
   e.g., Firestore rules rejecting array writes you didn't expect.
   M2 rules permit array updates on `cars` via the owner-only
   update rule, but if you hit a corner case, flag.
8. **`catch (err: unknown)` with no clean type guard for a
   Firebase error code** — same posture as M2 brief §9 #8. Don't
   reach for `any`.
9. **Component organization questions** — `components/` lives at
   `src/components/` per Decision #8; if you find yourself
   inventing a third tier (e.g., `src/components/forms/`), surface
   rather than nest pre-emptively.
10. **Modal accessibility** — focus trap, focus restore on close,
    aria roles. M3 doesn't require WCAG (PRD §9), but if you hit
    a deeply-broken interaction (e.g., modal that can't be
    dismissed with keyboard), flag rather than silently leave it.

---

## 10. Dependencies expected

New runtime dependency:

- `react-router` — declarative API. No `react-router-dom`
  (merged into `react-router` at v7).
  **Pin to the v7 line with a tight caret** (`^7.x.y` where
  `7.x.y` is the resolved version at install time — match M2's
  posture on `eslint@^9.39.4`, pinning explicitly away from any
  v8+ on `latest` later). Bump deliberately, not silently.

No new devDependencies expected. Vitest, ESLint, rules-unit-
testing all stay at M2's versions.

---

## 11. Handoff guidance

Implementer writes `dispatch/M3-cars-handoff.md` per
`HANDOFF-TEMPLATE.md`. Required sections (template): Status,
Versions chosen, Assumptions made, Deviations from dispatch,
Files created, Files NOT touched (confirmed), Items deferred
(to next dispatch / to BACKLOG), Expected cost impact, Manual
steps for the human owner, Notes for the next dispatch brief.

Specific things to capture:

- The version of `react-router` resolved (e.g., `^7.1.2`).
- The `RenameCarForm` UX choice (inline edit vs. modal) and why.
- The `AddCarModal` post-create navigation choice (stay on `/`
  vs. navigate to `/cars/:carId`) and why.
- Bundle size delta from M2 baseline (605 KB JS / 156 KB gz).
- The exact per-action read/write counts observed during V2
  vs. PRD §8 — including whether the implementer exercised both
  the first-share path (1 read + 2 writes) and the second-share-
  to-already-allowlisted-email path (1 read + 1 write).
- Anything M4's implementer (Entries / log form) will want to
  know about the cars module — especially how `useCars()` /
  `useCar()` expose refresh, the epoch race guard pattern (so
  M4 hooks for entries can mirror it), and the entries-cascade-
  delete work that's now pinned to M4 (Decision #6: rule
  relaxation + `deleteCar` cleanup land together).

---

## 12. Pre-read checklist

The reviewer cuttlefish reads this brief + the supporting
artifacts and reports against:

- **Brief-internal consistency**: §4 decisions ↔ §8 ACs ↔ §5
  files. Every AC has a file; every file has an AC.
- **PRD alignment**: §5.2 (Car shape) ↔ `createCar` payload;
  §5.4 (allowlist semantics on unshare) ↔ `unshareCar` body;
  §7 Flow E ↔ `shareCar` batched-write structure; §8 cost ↔
  the actual reads/writes in §7.2.
- **AGENTS alignment**: share-write atomicity called out;
  email canonicalization at boundary explicit; one Car-update
  helper rule respected (no inline writes outside `src/cars/`);
  no `any`; one-shot reads only (no `onSnapshot`).
- **M2 inheritance**: does the brief assume anything the M2
  handoff doesn't confirm shipped? Especially `useAuth()` shape,
  `canonicalEmail()` location, the Header-replacing-EmptyHome
  story.
- **react-router v7 API surface**: are the imports (`BrowserRouter`,
  `Routes`, `Route`, `Navigate`, `useParams`, `useNavigate`) all
  exported from `react-router` (v7 merged from `react-router-dom`)?
- **Firestore API surface**: `writeBatch`, `arrayUnion`,
  `arrayRemove`, `getDocs`, `query`, `where`, `deleteDoc`,
  `updateDoc`, `setDoc`, `serverTimestamp` all in
  `firebase@11.10.0`? (All v9-modular standard; spot-check.)
- **Internal contradictions** across brief sections.
- **Test scope reality check**: T2's batched-write tests
  actually exercise atomicity (does `@firebase/rules-unit-
  testing@4` even support batched writes via the test
  RulesTestEnvironment? — verify).
- **Missing edge cases**: covered by Decision #16's read-then-
  conditional-set pattern. Share with email already on
  allowlist from a prior share: pre-read finds the doc, batch
  contains only the Car update, no allowlist write attempted,
  so M2's `allow update: if false` on allowlist is not exercised.
  See §7.6 for the rare two-tab race where two first-shares to
  the same new email overlap (one batch fails; UI retry
  succeeds).

Report format: BLOCKING / SHOULD-FIX / NITS / CONFIRMED-OK.
Reviewer modifies no files.

---

## 13. Forward feedback channel

If the implementer hits rakes during execution that future
flog dispatches (or paralarva-kit consumers) should know about,
add them here as numbered items. Examples of what belongs here:

- `react-router@7` import or behavior surprises vs. the v6 docs
  most LLMs have seen most of.
- Firestore batched-write rule-eval quirks under
  `@firebase/rules-unit-testing`.
- Vite / Tailwind interactions with the new components.

1. **`eslint-plugin-react-hooks@7`'s new `set-state-in-effect`
   rule** flags any setState reachable from a useEffect-invoked
   callable — including ones that only setState after an awaited
   microtask. The dispatch §7.3 one-shot-fetch-on-mount hook shape
   trips this structurally; AC C9's race guard cannot be satisfied
   without setState in the awaited path. Two narrow
   `eslint-disable-next-line` suppressions (one each in
   `src/cars/useCars.ts` and `src/cars/useCar.ts`) carry the
   explanation. Future kit consumers should expect the same friction
   when shipping `react@18` + `eslint-plugin-react-hooks@7` data-
   fetch hooks; either accept the narrow suppression or adopt a
   subscribe-style abstraction (which sidesteps the rule because
   setState fires from a subscription callback, not the effect
   body itself).

2. **"Atomic conditional write" patterns require read access to
   their pre-read target.** Decision #16's read-then-conditional-
   batch shape (read `allowlist/{email}` to decide whether to
   include a `batch.set` on it) silently failed in V2 because M2's
   allowlist read rule was self-only — admin couldn't read another
   user's allowlist doc. The pattern is generic: any time a brief
   says "read X before deciding whether to write X (or a sibling)
   atomically," verify the read rule actually permits that read by
   that user. M3's two pre-reads both missed this because they
   verified Decision #16 against the *write* rule (which is what
   the decision text emphasized) and didn't trace the prerequisite
   read against the *read* rule. Fix-forward: loosened
   `firestore.rules` allowlist `read` from
   `request.auth.token.email == userEmail` to
   `allowed(request.auth.token.email)`; amended PRD §6.4
   accordingly. **Recommendation for future pre-reads**: when a
   brief introduces a new conditional-batch shape, the reviewer
   should explicitly trace each read in the pattern against the
   shipped `firestore.rules` text — not against the PRD's intent
   for those rules. The rules file is ground truth; the PRD is
   intent that can drift. M3 handoff "Notes for the next dispatch
   brief" captures this as a more general lesson.

---

End of brief.
