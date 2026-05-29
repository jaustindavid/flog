# M2 — Auth + allowlist + first-sign-in

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

**Status**: draft — pending pre-read by reviewer cuttlefish (per
WORKING-MODEL §3) before owner sign-off and implementer dispatch.

---

## 1. Context

M2 is v0's second milestone (PRD §10). It builds atop M1's
scaffold:

- M1 shipped the GCP/Firebase projects, env-switched config,
  placeholder SPA, deploy scripts, and markdownlint. See
  `dispatch/M1-infrastructure-handoff.md` for the full state.
- The `firestore.rules` file currently denies everything. M1's
  handoff §"Notes for the next dispatch brief" flags that the
  deny-all should be replaced as M2's first commit — otherwise
  the signed-in surface fails silently.

M2's job:

- Replace deny-all rules with the real PRD §6 ruleset.
- Add the rules-tests harness with full +/− coverage.
- Wire Google sign-in / sign-out / session-restore on the SPA.
- On successful sign-in, create `users/{uid}` with the rules
  carve-out for the bootstrap admin and the allowlist gate for
  everyone else.
- Show a graceful rejection screen + sign-out for unallowlisted
  users.
- Land the signed-in empty-state home ("no cars yet" — Add Car
  itself is M3).
- Land ESLint config (AGENTS Linting flagged this for M2).

M3 (Cars CRUD + share) builds on the signed-in shell M2 produces.

---

## 2. Required reading

In order:

1. [`../PRD.md`](../PRD.md) — §1.4 (philosophical commitments),
   §4 (architecture elevator), §5.1 + §5.4 (User + Allowlist data
   shapes), §6 (all of access control — load-bearing), §7 Flows
   A and B (first-sign-in flows), §9 (UI requirements), §10 (M2
   row).
2. [`../AGENTS.md`](../AGENTS.md) — all of it. The flog-specific
   guardrails about ADMIN_EMAIL, share-write atomicity, email
   canonicalization, and the test gates are load-bearing for this
   dispatch.
3. [`../WORKING-MODEL.md`](../WORKING-MODEL.md) — §3 (pre-read
   pattern; this brief expects to be pre-read), §5 (operational
   conventions), §6 (antipatterns).
4. [`../HANDOFF-TEMPLATE.md`](../HANDOFF-TEMPLATE.md) — for the
   handoff doc shape at the end.
5. [`M1-infrastructure-handoff.md`](M1-infrastructure-handoff.md)
   — §"Status", §"Versions chosen", §"Assumptions made",
   §"Notes for the next dispatch brief". M2 inherits all of M1's
   decisions; don't relitigate.

---

## 3. Scope

### In scope

- Real Firestore security rules for `users`, `cars`,
  `cars/{carId}/entries`, `allowlist` — full translation of PRD §6.
- Rules-tests harness using `@firebase/rules-unit-testing` against
  the Firestore emulator. Every rule has ≥1 positive and ≥1
  negative test (AGENTS testing gate).
- Email canonicalization helper (pure function + unit test).
- Google sign-in via `signInWithRedirect`; sign-out; session
  restore on app load.
- AuthProvider (React Context) exposing `{ status, user, signIn,
  signOut }`.
- First-sign-in logic: on auth state resolved + `users/{uid}` not
  present, attempt to create it. On `permission-denied`, route
  to rejection screen.
- Rejection screen (per §7 below) + sign-out wired.
- Signed-in empty-state home ("no cars yet" + sign-out link).
  No Add Car affordance — that ships in M3.
- ESLint config (flat config, ESLint 9) with TypeScript +
  react-hooks plugins. `npm run lint` and `npm run lint:fix`.
- Accent color: Tailwind `blue-600` as primary, set via Tailwind
  v4 `@theme {}` block in `src/index.css`.
- Both `.env.development` and `.env.production` gain
  `VITE_ADMIN_EMAIL=austindavid@gmail.com` (owner-side step;
  files are gitignored).

### Out of scope (defer)

- **Add Car flow** — M3.
- **Car list rendering** — M3 (empty state is the surface here).
- **Log form** — M4.
- **Per-car detail / MPG view** — M5.
- **Allowlist UI / admin tools** — BACKLOG → Later.
- **Multi-provider OAuth** — BACKLOG → Later.
- **Routing library** — not yet earned (M2 has ≤4 surfaces,
  conditional render off auth state suffices). Adding when M3
  introduces a second authenticated surface.
- **CI / GitHub Actions** — PRD §1.2 non-goal for v0.
- **Component / integration test harness** — AGENTS defers this
  to "when a real regression slips through manual review."
- **Editing `displayName`** — rule allows it (PRD §6.1) but no
  UI exercises it in M2.

---

## 4. Decisions locked in (from design conversation 2026-05-28)

These were settled before this brief was drafted. The implementer
treats them as fixed unless flagged stop-and-ask.

1. **Sign-in mechanism**: `signInWithRedirect`. Sign-in is rare
   (mostly testing); the redirect round-trip cost is negligible
   and the iOS Safari popup hostility is avoided. Pair with
   `getRedirectResult()` on `AuthProvider` mount to handle the
   return.
2. **Rejection is rules-driven**: attempt the `users/{uid}` create
   in the app; on `permission-denied`, sign the user out and route
   to the rejection screen. No pre-flight read of `/allowlist/`.
3. **All PRD §6 rules ship in M2**, including Car / Entry / share
   paths that aren't UX-exposed yet. Rules are atomic per deploy;
   churn is cheap once, expensive twice.
4. **`ADMIN_EMAIL` is the same value in dev and prod**
   (`austindavid@gmail.com`). Hardcoded as a string literal in
   `firestore.rules`; read from `import.meta.env.VITE_ADMIN_EMAIL`
   in app code per AGENTS. No build-time substitution machinery.
5. **No router yet.** Conditional render in `App.tsx` off auth
   state. Surfaces: `loading` / `signed-out` / `rejected` /
   `signed-in-empty-home`.
6. **Add Car button is hidden** in M2's empty state. Empty state
   reads "No cars yet" with no affordance. M3 wires both the
   button and the create flow as one coherent unit.
7. **Sign-out is in scope** — needed to test rejection + session
   persistence + manual re-test cycles. Sign-out link on the home
   screen and the rejection screen.
8. **ESLint lands here** per AGENTS Linting. Flat config (ESLint
   9 standard), TypeScript + react-hooks plugins, strict defaults,
   no app-specific custom rules yet.
9. **`users/{uid}.createdAt` = `serverTimestamp()`** per PRD §5.1
   "server-set."
10. **Email canonicalization at the boundary**: a single helper
    `canonicalEmail(raw)` applies `trim()` + `toLowerCase()`, used
    by app code everywhere an email enters the system. Rules
    rely on the OAuth-supplied `request.auth.token.email` being
    already canonical (Google's behavior); the app's defensive
    normalization guards user-typed inputs (M3 share-by-email).
11. **Accent color**: Tailwind `blue-600`. Matches Google Sign-in
    button conventions; honest default. Set via `@theme {}` block
    in `src/index.css`.
12. **Rejection screen copy**:

    > **{their.email}** isn't authorized to use flog yet.
    >
    > Ask whoever invited you to share a car with your email,
    > then sign in again.
    >
    > [Sign out / Try a different account]

    Tone: factual, blameless, points at resolution. No support
    process referenced (there isn't one).
13. **One dispatch, one cuttlefish.** M-sized work, pre-read
    required (per WORKING-MODEL §3).
14. **Test runner is vitest.** Pinned (not implementer's choice)
    so M3+ can rely on the same runner without re-deciding.
15. **Tests live at `tests/` at repo root**, type-checked via a
    new `tsconfig.test.json` referenced from `tsconfig.json`.
    Project-references pattern matches M1's `tsconfig.app.json`
    setup.
16. **Firebase Auth emulator is NOT wired in M2.** Rules tests
    use the Firestore emulator with `withAuth` fakes from
    `@firebase/rules-unit-testing` (auth tokens are stubbed at
    the rules level — no real Auth emulator needed). The auth
    wiring (sign-in / redirect / first-sign-in) is exercised
    against the real `flog-dev` project via `deploy:dev`.

---

## 5. Files in play

New / modified files this dispatch produces:

```text
flog/
├── .env.development            (modified — owner adds VITE_ADMIN_EMAIL)
├── .env.production             (modified — owner adds VITE_ADMIN_EMAIL)
├── eslint.config.js            (new)
├── firestore.rules             (modified — replaces deny-all)
├── package.json                (modified — new scripts + deps)
├── tsconfig.json               (modified — adds test project ref)
├── tsconfig.test.json          (new — typecheck scope for tests/)
├── src/
│   ├── App.tsx                 (modified — replaces M1 placeholder)
│   ├── index.css               (modified — adds @theme accent block)
│   ├── env.d.ts                (modified — adds VITE_ADMIN_EMAIL type)
│   ├── auth/
│   │   ├── AuthProvider.tsx    (new — Context + state machine)
│   │   ├── useAuth.ts          (new — hook)
│   │   ├── googleProvider.ts   (new — GoogleAuthProvider instance)
│   │   ├── firstSignIn.ts      (new — users/{uid} create logic)
│   │   └── canonicalEmail.ts   (new — boundary normalization)
│   ├── firebase/
│   │   ├── auth.ts             (new — getAuth(app) export)
│   │   └── firestore.ts        (new — getFirestore(app) export)
│   └── screens/
│       ├── LoadingScreen.tsx   (new)
│       ├── SignedOutScreen.tsx (new — "sign in with Google" CTA)
│       ├── RejectedScreen.tsx  (new — per §4 #12 copy)
│       └── EmptyHomeScreen.tsx (new — "no cars yet" + sign-out)
└── tests/
    └── rules/
        ├── helpers.ts          (new — withAuth, etc.)
        ├── users.test.ts       (new)
        ├── cars.test.ts        (new)
        ├── entries.test.ts     (new)
        └── allowlist.test.ts   (new)
└── src/auth/canonicalEmail.test.ts  (new — pure function unit test)
```

Plus `dispatch/M2-auth-allowlist-handoff.md` written at the end.

**Folder convention**: `screens/` for full-page surfaces vs.
`components/` for sub-page widgets. M2 only has screens; M3+
introduces `components/` if and when shared widgets emerge.

**Test layout**: rules tests under `tests/rules/` (emulator-bound,
slow). Pure-function tests colocated with the source they exercise
(`canonicalEmail.test.ts` sits next to `canonicalEmail.ts`). The
test runner config (vitest or similar) is the implementer's call —
flag chosen runner in handoff §"Versions chosen."

---

## 6. Files NOT to touch

- `PRD.md`
- `AGENTS.md`
- `BACKLOG.md`
- `CUTTLEFISH-NAUTILUS.md`
- `WORKING-MODEL.md`
- `HANDOFF-TEMPLATE.md`
- `README.md`
- This brief (`dispatch/M2-auth-allowlist.md`) — except a §13
  forward-feedback section if the implementer hits a rake worth
  capturing.
- `dispatch/M1-*` files — the M1 record is closed.
- `.firebaserc`, `firebase.json`, `vite.config.ts`,
  `tsconfig.app.json`, `tsconfig.node.json` — M1 set these; no
  changes needed for M2.
- `tsconfig.json` — only modification permitted is adding a
  `references` entry for the new `tsconfig.test.json`. No other
  changes; surface anything else as stop-and-ask.
- `src/firebase/config.ts`, `src/firebase/app.ts` — M1 set these;
  M2 adds new files alongside.
- `src/main.tsx` — only changes if the implementer chooses to wrap
  `<App>` with `<AuthProvider>` here vs. inside `App.tsx`; either
  is fine, flag in handoff.

---

## 7. Architecture sketch

### 7.1 AuthProvider state machine

```text
states:
  - 'loading'        → auth state hasn't resolved yet, or
                       provisioning users/{uid} on first sign-in
  - 'signed-out'     → no user
  - 'rejected'       → users/{uid} create failed permission-denied;
                       Firebase Auth session still active until
                       user clicks "Sign out" (so we can display
                       the rejected email in the UI)
  - 'signed-in'      → user + users/{uid} both exist

transitions:
  loading
    └─ onAuthStateChanged fires:
        ├─ user=null → signed-out
        └─ user=present → check users/{uid}:
            ├─ exists → signed-in
            └─ not exists → attempt setDoc:
                ├─ succeeds → signed-in
                └─ permission-denied → rejected
                    (Firebase Auth session intentionally retained;
                    cleared only on user-initiated Sign out click)
  signed-out
    └─ user clicks "Sign in" → call signInWithRedirect (page leaves)
  signed-in / rejected
    └─ user clicks "Sign out" → call signOut → signed-out

on AuthProvider mount:
  - call getRedirectResult() (completes the redirect handshake;
    its return value is redundant with the subsequent
    onAuthStateChanged fire)
  - subscribe to onAuthStateChanged (the single source of truth)
```

Why retain the Firebase Auth session in `rejected`: the
`RejectedScreen` interpolates the user's email so they can see
which account was rejected (U3). If we auto-signed-out on
entering `rejected`, `user?.email` would be undefined at render
time. Sign-out is button-driven instead.

The `getRedirectResult()` call is required by Firebase to complete
the redirect handshake but its return value is redundant with the
subsequent `onAuthStateChanged` fire — treat the latter as the
single source of truth for "is there a user."

### 7.2 First-sign-in logic (`firstSignIn.ts`)

```text
async function ensureUserDoc(user):
  const ref = doc(firestore, 'users', user.uid)
  const snap = await getDoc(ref)
  if (snap.exists()) return 'existing'
  try:
    await setDoc(ref, {
      uid: user.uid,
      email: canonicalEmail(user.email),
      displayName: user.displayName ?? '',
      createdAt: serverTimestamp(),
    })
    return 'created'
  catch (err):
    if (err.code === 'permission-denied') return 'rejected'
    throw  // unexpected — let it propagate
```

The `getDoc` before `setDoc` adds one read on every sign-in but
makes the state machine cleaner (no try/catch-create-on-exists
juggling). Acceptable cost: sign-in is rare; per PRD §8 this is
well below the tripwire.

### 7.3 Firestore rules — translation of PRD §6

Key construct:

```text
function allowed(email) {
  return email == 'austindavid@gmail.com'
      || exists(/databases/$(database)/documents/allowlist/$(email));
}
```

The literal `austindavid@gmail.com` is the bootstrap-admin
carve-out (PRD §5.4 + §6). Same literal in both dev and prod
deployments of `firestore.rules`.

**Note on `exists()` privilege**: Firestore rules' `exists()` and
`get()` operations are internal privileged reads that **bypass
the read rules on the target path**. So `allowed(email)` can
check the existence of any user's allowlist doc even though the
`allowlist/{email}` read rule only permits self-read. This is
correct and intentional — it's how allowlist-gating works at all.
Don't write a rules test that expects this to fail; the
allowlist read rule and the `allowed()` helper coexist by design.

**Critical: `allowed()` argument semantics on `allowlist` create.**
PRD §6.4 means *the requesting user must be allowlisted* (so a
share-write can add a new email). The rule reads:

```text
match /allowlist/{userEmail} {
  allow read: if request.auth.token.email == userEmail;
  allow create: if allowed(request.auth.token.email);
  allow delete: if request.auth.token.email == 'austindavid@gmail.com';
}
```

Do **not** write `allowed(userEmail)` — that would let any
already-allowlisted email cause its own re-creation but block
new-sharee additions, translating PRD §6.4 backwards.

**User update — restrict to `displayName` only.** PRD §6.1 says
"update=self limited to `displayName`." The canonical idiom:

```text
match /users/{userId} {
  allow update: if request.auth.uid == userId
                && request.resource.data.diff(resource.data)
                     .affectedKeys()
                     .hasOnly(['displayName']);
}
```

`hasOnly([...])` rejects any update that touches *any* field
outside the allowlist — including `email` (which would otherwise
let a user rewrite their identity and gain unintended allowlist
power), `uid`, `createdAt`, or unknown new fields. Don't weaken
this to per-field equality checks.

For `cars/{carId}/entries/{entryId}`, the rule needs to look up
the parent Car. Standard pattern:

```text
function parentCar() {
  return get(/databases/$(database)/documents/cars/$(carId)).data;
}
function canReadParent() {
  return request.auth != null && (
    parentCar().ownerUid == request.auth.uid
    || request.auth.token.email in parentCar().shareeEmails
  );
}
```

If the parent Car doesn't exist, `get()` returns null and `.data`
access denies the rule safely. No explicit null guard is needed.

**Open verification** (see §9 Stop-and-ask): a query of N entries
may issue N rules `get()` calls against the parent car. Firestore
caches identical `get()` paths within a single rules-eval pass,
but the docs are not unambiguous about scope. Worst case is N
extra reads per per-car-detail page (PRD §8 budget = 1 + 50 = 51;
worst case = 1 + 50 + 50 = 101). Either way well below free-tier
ceiling — flagging because M5's brief will need the verified
answer.

### 7.4 Allowlist write paths in M2

In M2 specifically, no app code writes the allowlist. The
bootstrap admin signs in via the `email == ADMIN_EMAIL` carve-out
(not via an allowlist doc) and is the only user who can
successfully provision. Every other user hits the rejection path
until M3 ships car-sharing.

The allowlist `create` rule still needs to be correct now (M3
wires the writes; rules-test coverage proves the rule works
before the app code exercises it). Per PRD §6.4 the rule permits
allowlist create by any allowlisted user — including the admin
via carve-out — paired with the atomic share-write batch in M3.

### 7.5 Surface rendering (`App.tsx`)

```text
function App() {
  const { status, user } = useAuth()
  if (status === 'loading') return <LoadingScreen />
  if (status === 'signed-out') return <SignedOutScreen />
  if (status === 'rejected') return <RejectedScreen email={user?.email} />
  if (status === 'signed-in') return <EmptyHomeScreen user={user} />
}
```

No router; status flag drives the render.

### 7.6 ADMIN_EMAIL — two surfaces

- **Rules**: literal string in `firestore.rules`. Hardcoded.
- **App**: `import.meta.env.VITE_ADMIN_EMAIL` (owner adds to both
  `.env.*` files). Used for: nothing in M2 *(stop and ask if a
  use case appears)*. Wired up in env now to avoid a re-touch
  when M3 / admin-UI lands.

Why hardcoded in rules vs env-substituted: rules are deployed
per-project; if dev and prod ever need different admins we'd
build a small substitution step then. v0 scale doesn't justify
it yet (BACKLOG → Later if needed).

---

## 8. Acceptance criteria

Numbered by subsection (per WORKING-MODEL §5 "AC prefix numbering").

### R* — Rules (firestore.rules)

- **R1** `users/{userId}` rules per PRD §6.1: read=self;
  create=self+allowed(email); update=self limited to
  `displayName`; delete=denied.
- **R2** `cars/{carId}` rules per PRD §6.2: read=owner|sharee;
  create=allowed(email) and `ownerUid==auth.uid`;
  update=owner-only with `ownerUid` immutable; delete=owner.
- **R3** `cars/{carId}/entries/{entryId}` rules per PRD §6.3:
  read=parent-car-readers; create=parent-car-readers with
  `loggedByUid==auth.uid`; update + delete = denied.
- **R4** `allowlist/{email}` rules per PRD §6.4: read=self
  (`request.auth.token.email == email`); create=
  `allowed(request.auth.token.email)` (the *requesting* user
  must be allowlisted — see §7.3); delete=admin only; (no
  update, doc is fields-less).
- **R5** `allowed(email)` helper defined exactly as PRD §6
  describes; `ADMIN_EMAIL` literal = `austindavid@gmail.com`.
- **R6** Rules file deploys clean via
  `firebase deploy --only firestore:rules` against dev project.
  (Don't deploy to prod from this dispatch — owner gates the
  prod deploy after manual verification on dev.)

### T* — Tests (rules + unit)

- **T1** Rules-tests harness installed: `@firebase/rules-unit-testing`
  devDependency, vitest (or implementer's chosen runner)
  configured, `npm run test:rules` script defined.
- **T2** Every rule in R1–R4 has ≥1 positive and ≥1 negative test
  (AGENTS testing gate). Includes:
  - Users: admin can create own doc; non-allowlisted user
    cannot; allowlisted user (allowlist doc seeded) can; user
    cannot create someone else's doc; user can read own; user
    cannot read another's; update permitted when
    `affectedKeys().hasOnly(['displayName'])`; update denied
    when any other field is touched (test ≥1 case attempting to
    write `email`, ≥1 attempting to write a novel field); delete
    denied.
  - Cars: allowlisted user can create with `ownerUid=self`;
    cannot create with `ownerUid=other`; owner can read; sharee
    can read; outsider cannot read; owner can update `name` and
    `shareeEmails`; cannot mutate `ownerUid`; sharee cannot
    update; owner can delete; sharee cannot delete.
  - Entries: parent-car owner can read + create; parent-car
    sharee can read + create; outsider cannot; create requires
    `loggedByUid==auth.uid`; update + delete denied even for
    owner.
  - Allowlist: self can read own doc; cannot read another's;
    allowlisted user can create (including admin via carve-out);
    non-allowlisted cannot; admin can delete; non-admin cannot.
- **T3** `npm run test:rules` runs all rules tests against the
  Firestore emulator and exits zero.
- **T4** `canonicalEmail()` unit test covers: trims whitespace,
  lowercases, idempotent on already-canonical input. AGENTS
  testing gate.
- **T5** `npm test` (or equivalent) runs the unit-test set and
  exits zero. (Rules tests may be in the same command or
  separate — implementer's call; flag in handoff.)

### A* — Auth wiring

- **A1** Google sign-in via `signInWithRedirect` works against the
  dev project. (Owner step: manual sign-in test post-deploy.)
- **A2** `getRedirectResult` is called on AuthProvider mount; the
  state machine resolves to `signed-in` or `rejected` without
  user intervention.
- **A3** `onAuthStateChanged` subscription is the single source of
  truth for "is there a user." Subscription is properly torn
  down on AuthProvider unmount.
- **A4** First-sign-in creates `users/{uid}` with the four fields
  in PRD §5.1; `createdAt` uses `serverTimestamp()`; `email` is
  passed through `canonicalEmail()`.
- **A4b** Repeat sign-in by an existing user lands on `signed-in`
  without re-writing `users/{uid}` (the pre-`setDoc` `getDoc`
  short-circuits — see §7.2). `createdAt` is preserved across
  sessions.
- **A5** Sign-out via `signOut(auth)` returns the app to
  `signed-out` state without page reload.
- **A6** Permission-denied on the `users/{uid}` create routes to
  `RejectedScreen`; subsequent sign-out clears the Firebase Auth
  session.

### U* — UI surfaces

- **U1** `LoadingScreen` renders during any non-terminal auth
  state; visually unobtrusive (centered spinner or "Signing
  in…").
- **U2** `SignedOutScreen` renders a single "Sign in with Google"
  button, ≥44pt tap target, blue-600 accent.
- **U3** `RejectedScreen` renders the §4 #12 copy with the
  signed-in email interpolated; provides a "Sign out / Try a
  different account" button.
- **U4** `EmptyHomeScreen` renders "No cars yet" (or similar
  KISS copy), a sign-out link/button, and the signed-in user's
  display name or email. No Add Car affordance.
- **U5** All four screens are mobile-first per PRD §9; rendering
  fits a 375px-wide viewport without horizontal scroll.
- **U6** Tailwind `@theme {}` block in `src/index.css` defines
  the primary accent as `blue-600` (or equivalent); used by
  the sign-in button and any future primary CTAs.

### L* — Lint

- **L1** ESLint flat config at `eslint.config.js`. Plugins:
  `@typescript-eslint`, `eslint-plugin-react-hooks`,
  `eslint-plugin-react-refresh`. Strict TS defaults.
- **L2** New script `npm run lint` (ESLint) exits zero across all
  `src/` and `tests/` files.
- **L3** New script `npm run lint:fix` defined.
- **L4** M1's `npm run lint:md` script is **not renamed and not
  modified** — it continues to gate markdown via
  markdownlint-cli2. The new ESLint `lint` script is independent.
  Both must pass; consider an optional umbrella script (e.g.,
  `lint:all`) that runs both, at implementer's discretion.
- **L5** `npm run lint:md` continues to exit zero (M1's gate
  unchanged; this dispatch adds at least one new markdown
  file — the handoff — that must pass).
- **L6** `tsconfig.test.json` created and referenced from
  `tsconfig.json`'s `references` array. `tsc -b` (via
  `build:dev` / `build:prod`) succeeds; test files in `tests/`
  are included in the test-project scope, not the app scope.

### V* — Verification

- **V1** `npm run build:dev` and `npm run build:prod` both exit
  zero. Bundle size deltas captured in handoff §"Notes for the
  next dispatch brief."
- **V2** `npm run deploy:dev` succeeds; owner manual-tests:
  - admin can sign in cold, lands on `EmptyHomeScreen`,
    `users/{uid}` doc visible in Firebase Console with the four
    fields.
  - non-allowlisted user (any other Google account) can attempt
    sign-in, lands on `RejectedScreen`, Firebase Auth session
    is cleared after they click the button.
  - session persists across page reload for admin.
- **V3** Cost-impact check: per PRD §8, M2 adds 0 per-page reads
  on the signed-out path; ≤2 reads on the signed-in path (1
  `getDoc(users/{uid})` + 0 or 1 setDoc on first sign-in only).
  Confirm in handoff.
- **V4** No deploy to prod from this dispatch. Owner gates the
  prod deploy after dev verification.

---

## 9. Stop and ask

Pause and surface (in chat or as a handoff note) before:

1. **Rules `get()` caching semantics** — if the implementer
   investigates and finds that N-entry queries incur N parent-car
   `get()` reads (not 1), surface in handoff §"Notes for the next
   dispatch brief" with the verified answer + a recommended
   M5 mitigation (e.g., denormalize `readableBy` onto Entries).
   Don't restructure rules in M2 — the cost is well below tripwire
   regardless.
2. **Any field rename or reshape** in the User / Car / Entry /
   Allowlist data model. PRD §5 is the contract; deviation
   requires owner approval, not a fix-forward.
3. **Adding a top-level dependency not listed in §10** — AGENTS
   "If unsure, ask" guardrail.
4. **Any path that would store the bootstrap admin email in TS
   source** (vs. env / rules literal) — AGENTS flog-specific
   guardrail.
5. **If `signInWithRedirect` produces a usability rake** in local
   dev that makes M2 hard to test — flag it; popup is the fallback,
   but the decision was deliberate (§4 #1), so owner makes the
   swap call.
6. **If the test runner emulator-connection setup hits a rake**
   not anticipated — surface and capture in §13. Don't paper
   over flaky tests; a flaky rules test is a non-functional rule.
7. **If `package.json` ends up with React 19** or another major
   bump from what M1 shipped (React 18.3.1) — surface, don't
   silently upgrade.
8. **`catch` clauses must use `catch (err: unknown)`** with a
   type guard before reading `err.code`. AGENTS "no `any`"
   guardrail applies inside catch handlers too. If a Firebase
   error type makes this awkward, surface rather than reach for
   `any` or `@ts-ignore`.

---

## 10. Dependencies expected

New devDependencies:

- `eslint` (v9 line)
- `@typescript-eslint/eslint-plugin`
- `@typescript-eslint/parser`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`
- `@firebase/rules-unit-testing`
- `vitest` (pinned — §4 #14)
- Possibly `@vitest/ui` if the runner UI is wanted (optional)

No new runtime dependencies — all M2 functionality builds on the
`firebase` SDK already installed by M1 (Auth + Firestore modules
of `firebase@11.10.0`). Verify M1's SDK version supports
`signInWithRedirect`, `getRedirectResult`, `onAuthStateChanged`,
`getDoc`, `setDoc`, `serverTimestamp` — all standard since
firebase@9 modular API; flag if any are missing.

---

## 11. Handoff guidance

Implementer writes `dispatch/M2-auth-allowlist-handoff.md`
following HANDOFF-TEMPLATE.md. Required sections (per template):
Status, Versions chosen, Assumptions made, Deviations from
dispatch, Files created, Files NOT touched (confirmed), Items
deferred, Expected cost impact, Manual steps for the human
owner, Notes for the next dispatch brief.

Specific things to capture:

- Whether rules `get()` caching reduces the N-reads cost
  (per §9 #1) — verified yes/no with citation.
- Any rake in the redirect-flow / emulator-test path worth
  filing forward (§13 of this brief or paralarva feedback).
- Bundle-size delta from M1 baseline (M1's prod was 179.80 KB JS
  / 54.82 KB gz per M1 handoff).
- Anything the M3 implementer will want to know about the
  `AuthProvider` shape / state machine that the in-code types
  don't make obvious.

---

## 12. Pre-read checklist

The reviewer cuttlefish reads this brief + the supporting
artifacts and reports against:

- **Brief-internal consistency**: do §4 decisions match §8 ACs?
  Do §5 files map to §8 ACs? Are there assumptions in §7
  architecture that aren't reflected in ACs?
- **PRD alignment**: do the rules in §8 R1–R4 match PRD §6 row
  for row? Does the data written in §7.2 match PRD §5.1?
- **AGENTS alignment**: are the load-bearing guardrails
  (ADMIN_EMAIL handling, email canonicalization, server
  timestamp, no `any`) called out in the brief?
- **M1 inheritance**: does the brief assume anything from M1 that
  the M1 handoff doesn't confirm shipped? Versions, file paths,
  env-var names.
- **Firebase API surface**: do the SDK functions referenced in §7
  exist in `firebase@11.10.0`?
- **Rules syntax**: do the rules patterns in §7.3 / §8 R* compile
  against `firebase-tools`? (No live verification needed — pattern
  inspection is enough.)

Report format: BLOCKING / SHOULD-FIX / NITS / CONFIRMED-OK. The
reviewer modifies no files.

---

## 13. Forward feedback channel

If the implementer hits rakes during execution that future
flog dispatches (or paralarva-kit consumers) should know about,
add them here as numbered items. Examples of what belongs here:

- Surprises in `@firebase/rules-unit-testing` setup against the
  emulator suite M1 configured.
- Firebase SDK behavior differences between docs and reality.
- Tailwind v4 `@theme` quirks that bit during accent-color setup.

Rakes captured during execution + V2. See the handoff
(`dispatch/M2-auth-allowlist-handoff.md`) "Post-ship findings"
section for the full narrative of each.

1. **Firebase scaffold's default `authDomain` =
   `<project-id>.firebaseapp.com`** is broken on Chrome with
   storage partitioning. The cross-origin iframe sync between
   `firebaseapp.com` (where Firebase Auth stores tokens) and
   `web.app` (where the SPA reads them) fails silently in Chrome:
   `getRedirectResult` resolves null and the user appears
   signed-out despite a successful OAuth round-trip. Fix: set
   `authDomain` to the SPA's hosting domain
   (`<project-id>.web.app`) — both Firebase Hosting domains serve
   the auth handler, so this is a config flip with no infra
   change. The GCP OAuth Client's Authorized Redirect URIs must
   include `https://<project-id>.web.app/__/auth/handler` (M1
   runbook §5c already lists this). Runbook updated to set
   `authDomain` to the hosting domain from the start of any new
   env spinup.

2. **`new GoogleAuthProvider()` with no custom parameters**
   triggers two bugs:
   (a) Google silently re-auths with `prompt=none` when exactly
   one Google session is active — no account chooser, no chance
   to switch accounts; the rejection-recovery flow ("Try a
   different account") loops back to the same rejected account.
   (b) The silent-auth code path appears to be the one with
   Chrome's "first sign-in fails, second succeeds" intermittency;
   forcing the chooser path bypasses it.
   Fix:
   `googleProvider.setCustomParameters({ prompt: 'select_account' })`
   on the singleton. Forces the chooser on every sign-in. Small
   UX cost (one extra click after a sign-out); large reliability
   win.

3. **`getRedirectResult` errors silently swallowed** is a
   diagnostic-killing anti-pattern. The original AuthProvider
   `.catch(() => {})` was justified with "the error will surface
   via subsequent auth state" — but if the error itself prevents
   the auth state from establishing, that's false. Replaced with
   `console.error('getRedirectResult failed', err)`. Diagnostic
   stays in production; cheap and reveals the failure mode the
   next time something breaks. Recommendation for any future
   Firebase Auth wiring: log all auth-bootstrap errors, even on
   the "happy path" branch. Silent failure on bootstrap is
   uniquely expensive.

These three are also filed as kit-level paralarva forward
feedback at
`dispatch/paralarva-feedback-003-firebase-auth-defaults.md` —
they're not flog-specific.

---

End of brief.
