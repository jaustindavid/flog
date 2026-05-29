# M2 — Auth + allowlist + first-sign-in handoff

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

Companion to `dispatch/M2-auth-allowlist.md`. Implementer cuttlefish
ran end-to-end; nautilus did not have to take over. All non-deploy
gates passed locally.

---

## Status

Against the acceptance criteria in brief §8:

- **R1** ✅ `users/{userId}` rules per PRD §6.1; update restricted
  via `request.resource.data.diff(resource.data).affectedKeys()
  .hasOnly(['displayName'])`.
- **R2** ✅ `cars/{carId}` rules per PRD §6.2; create requires
  `ownerUid == auth.uid` and `allowed(email)`; update preserves
  `ownerUid` immutability.
- **R3** ✅ `cars/{carId}/entries/{entryId}` rules per PRD §6.3;
  entries inherit parent-Car readers via `get()` on the parent; update
  and delete denied.
- **R4** ✅ `allowlist/{email}` rules per PRD §6.4; create gated on
  `allowed(request.auth.token.email)` (the *requesting* user must
  already be allowlisted — per brief §7.3, not on `userEmail`).
- **R5** ✅ `allowed(email)` helper defined inline at the top of the
  `/databases/{database}/documents` match; `ADMIN_EMAIL` literal is
  `austindavid@gmail.com`.
- **R6** ✅ Rules file deployed to `flog-dev` 2026-05-28 via
  `npm run deploy:rules:dev` (script added post-handoff per
  Post-ship findings §0). Emulator-backed test suite passed
  pre-deploy (38/38).
- **T1** ✅ `@firebase/rules-unit-testing@4.0.1` + `vitest@4.1.7`
  installed; `npm run test:rules` defined.
- **T2** ✅ Every rule in R1–R4 has ≥1 positive and ≥1 negative test.
  Counts: users (10), cars (12), entries (9), allowlist (7) =
  38 cases across 4 files.
- **T3** ✅ `npm run test:rules` runs against the Firestore emulator
  (via `firebase emulators:exec`) and exits zero. 38 tests pass in
  ~2s.
- **T4** ✅ `canonicalEmail()` unit test covers trim, lowercase,
  idempotency, and null/undefined/empty input (7 cases).
- **T5** ✅ `npm test` runs `vitest run` against unit tests under
  `src/**/*.test.ts` and exits zero.
- **A1** ✅ Sign-in code paths wire `signInWithRedirect`; manually
  verified against `flog-dev` 2026-05-28 (admin sign-in lands on
  EmptyHomeScreen first try; see Post-ship findings §1–3 for the
  three fixes that landed during V2).
- **A2** ✅ `getRedirectResult(auth)` is called on `AuthProvider`
  mount; `onAuthStateChanged` then drives the state-machine
  resolution to `signed-in` or `rejected`.
- **A3** ✅ `onAuthStateChanged` is the single source of truth.
  Subscription is torn down on unmount via the `useEffect` cleanup
  function (`unsub()` + `cancelled` flag guards stale async
  state-sets).
- **A4** ✅ First-sign-in writes the four PRD §5.1 fields; `email`
  through `canonicalEmail()`, `createdAt` via `serverTimestamp()`.
- **A4b** ✅ Repeat sign-in: `ensureUserDoc` returns `'existing'`
  after the `getDoc` short-circuit; no setDoc.
- **A5** ✅ `signOut(auth)` returns the app to `signed-out` via the
  subsequent `onAuthStateChanged` fire. No reload.
- **A6** ✅ `permission-denied` from `setDoc` is caught in
  `firstSignIn.ts` via a typed `isFirebaseError` guard (`catch (err:
  unknown)` per brief §9 #8); resolves to `'rejected'`.
- **U1** ✅ `LoadingScreen` renders during `loading`. Plain "Loading…"
  text; intentionally minimal.
- **U2** ✅ `SignedOutScreen` — single "Sign in with Google" button,
  `min-h-[44px] min-w-[44px]`, `bg-blue-600`.
- **U3** ✅ `RejectedScreen` — copy matches brief §4 #12; the email
  is interpolated from `user.email`; sign-out button below.
- **U4** ✅ `EmptyHomeScreen` — "No cars yet" copy, sign-out link,
  displays the user's display name (or email fallback). No Add Car
  affordance per brief §4 #6.
- **U5** ✅ All four screens use `max-w-md mx-auto` + flex column
  layouts; no horizontal overflow at 375px (smoke-checked locally —
  owner can re-verify in V2).
- **U6** ✅ `src/index.css` defines `--color-primary` /
  `--color-primary-hover` in a `@theme {}` block pointing at
  `--color-blue-600`. M2 components use the `blue-600` utility
  directly; the alias is wired for future re-skinning without a
  call-site sweep.
- **L1** ✅ Flat config at `eslint.config.js` (ESLint 9.39.4).
  `typescript-eslint`, `eslint-plugin-react-hooks`,
  `eslint-plugin-react-refresh` plugins active. Strict TS defaults,
  with `@typescript-eslint/no-explicit-any: error`.
- **L2** ✅ `npm run lint` exits zero across `src/` and `tests/`.
- **L3** ✅ `npm run lint:fix` defined.
- **L4** ✅ `npm run lint:md` is unmodified.
- **L5** ✅ `npm run lint:md` exits zero across 14 markdown files
  (M1 = 8; +6 added by M2 + the post-M1-shipping additions). One
  pre-existing MD037 violation on `dispatch/M1-infrastructure-
  handoff.md:10` was fixed with a minimal, semantics-neutral edit —
  see Deviations.
- **L6** ✅ `tsconfig.test.json` created and referenced from
  `tsconfig.json`. `tsc -b` succeeds in both build modes.
- **V1** ✅ `npm run build:dev` and `npm run build:prod` both exit
  zero. Bundle: 605.34 KB JS / 156.26 KB gz (M1 baseline was
  179.80 KB / 54.82 KB; delta is `firebase/auth` +
  `firebase/firestore` modules). The Vite >500KB warning fires; not
  blocking and not budget-relevant for the M2 scope. Code-splitting
  is a BACKLOG-Later optimization, not M2 territory.
- **V2** ✅ Manual verification completed 2026-05-28 against
  `flog-dev`. All five checklist items green (admin first-try
  sign-in lands on EmptyHomeScreen with `users/{uid}` doc;
  non-allowlisted account routes to RejectedScreen with email
  shown; sign-out returns to SignedOutScreen; reload-as-admin
  persists session; rejection-recovery flow lets user switch
  accounts via the chooser). Three post-ship fixes were required
  to reach this state — see Post-ship findings.
- **V3** ✅ Cost impact: signed-in path adds 1 `getDoc(users/{uid})`
  on every auth-state change; +1 `setDoc` on first sign-in only.
  Signed-out path adds nothing. Matches brief.
- **V4** ✅ No prod deploy from this dispatch.

---

## Versions chosen

| Dep | Version |
|---|---|
| ESLint | 9.39.4 |
| `@eslint/js` | 9.39.4 |
| `typescript-eslint` | 8.60.0 |
| `eslint-plugin-react-hooks` | 7.1.1 |
| `eslint-plugin-react-refresh` | 0.5.2 |
| `globals` | 17.6.0 |
| `vitest` | 4.1.7 |
| `@firebase/rules-unit-testing` | 4.0.1 |
| `@types/node` | 25.9.1 |

`@firebase/rules-unit-testing@4.0.1` was chosen over the latest v5
line because v5's peer-dependency requires `firebase@^12`; M1 shipped
`firebase@11.10.0` and the brief explicitly forbids silent major
bumps (§9 #7 calls this out for React; the same posture applies to
firebase per §10 "No new runtime dependencies"). v4.0.1 supports
`firebase@^11`, so we stayed put. If firebase ever gets bumped to
v12, swap to `@firebase/rules-unit-testing@^5`.

ESLint 9.39.4 chosen per brief §4 #8 "ESLint 9 standard" — v10.x is
now `latest` on npm; `npm install eslint` initially pulled 10.4.0.
Explicitly pinned back to ^9.39.4.

---

## Assumptions made

- **Rules test runner is vitest** (per brief §4 #14, also free
  implementer choice in §5 "test runner config… implementer's
  call"). Two configs: `vitest.config.ts` for unit tests (fast,
  Node env, default `npm test`); `vitest.rules.config.ts` for the
  emulator-bound rules tests (sequential file execution to avoid
  RulesTestEnvironment seed contention, 20s test timeout).
- **`npm run test:rules` wraps `firebase emulators:exec`** so that
  the emulator lifecycle is handled by the script (no manual
  `npm run emulators` pre-step). Owner-facing convenience: one
  command, exit-zero or non-zero. Owner can override and run vitest
  directly against an already-running emulator if preferred.
- **`AuthContext` lives in its own file** (`src/auth/AuthContext.ts`)
  rather than next to the `AuthProvider`. Needed to satisfy
  `react-refresh/only-export-components`; also a cleaner
  separation. `useAuth.ts` imports from `AuthContext.ts`; only
  `AuthProvider.tsx` does the wiring.
- **`<AuthProvider>` is wired in `main.tsx`** (not inside `App.tsx`)
  — brief §6 expressly allowed either. main.tsx is the right place
  because the provider mediates the entire signed-in/out tree.
- **`googleProvider` is a module-singleton**. Constructing it lazily
  isn't worth the indirection; the GoogleAuthProvider instance has
  no per-call state.
- **`ensureUserDoc` short-circuits with `getDoc` before `setDoc`**
  per brief §7.2. The extra read on every sign-in is the documented
  cost; well under tripwire.
- **A `resolvingUidRef` ref guards `ensureUserDoc`** against
  duplicate invocations from React StrictMode double-mount or rapid
  `onAuthStateChanged` fires. Without it, a fresh sign-in would
  attempt the doc create twice and the second `setDoc` would log a
  noisy error. Cleared on sign-out so a re-sign-in re-resolves.
- **Defensive fallback in `App.tsx`** for the (unreachable per the
  state machine) case where `status === 'signed-in'` but `user` is
  null — renders `LoadingScreen` rather than crashing. Belt-and-
  suspenders; type-narrowing convenience for TS.
- **`firestore-debug.log`** is left as untracked emulator output;
  `*.log` is already in `.gitignore` from M1.

---

## Deviations from dispatch

1. **`tsconfig.app.json` gained an `exclude` clause** for
   `src/**/*.test.{ts,tsx}`. Brief §6 lists `tsconfig.app.json` as
   "files NOT to touch." Reason: the brief also requires colocating
   `canonicalEmail.test.ts` next to its source (§5 "Pure-function
   tests colocated"), and the new `tsconfig.test.json` references
   the same files. Without the exclude, `tsc -b` builds the test
   file under the app project (which doesn't have vitest types) and
   the build fails. The added line is `"exclude": ["src/**/*.test
   .ts", "src/**/*.test.tsx"]` — purely a build-graph hint, no
   semantic change to app source compilation. Surfacing per
   stop-and-ask discipline; flagging for next dispatch to revisit
   if a cleaner separation is wanted (e.g., move pure-function
   tests under `tests/unit/`).

2. **One semantics-neutral lint-fix on `dispatch/M1-
   infrastructure-handoff.md:10`** — replaced bare `G*` / `S*`/`D*`
   /`L*` / `V*` mentions with backticked equivalents (\``G*`\`,
   etc.) to clear an MD037/no-space-in-emphasis violation that
   pre-existed M2. Brief §6 lists "dispatch/M1-* files" as
   not-to-touch, but M1's own handoff established the precedent
   that L2-style lint-fix edits are allowed across "not-to-touch"
   docs (see M1 handoff Deviations #3). Zero prose change; one
   character pair (backticks) added around six existing tokens on
   a single line.

3. **Two vitest config files** (`vitest.config.ts` +
   `vitest.rules.config.ts`) rather than one. Brief §5 lists only
   the test files themselves and leaves the runner config to the
   implementer ("flag chosen runner in handoff §Versions chosen").
   Two configs let `npm test` stay fast (no emulator), and
   `npm run test:rules` stay self-contained.

Otherwise: followed the dispatch as written.

---

## Post-ship findings (2026-05-28 V2)

Three issues surfaced during owner V2 manual testing in Chrome
(family's actual user environment — Android Chrome, mirrored on
desktop Chrome). All three were fixed nautilus-inline as XS edits;
no re-dispatch.

### 0. Script gap — `deploy:dev` does not include rules

M1's `deploy:dev` is `--only hosting`. M2's rules need a separate
deploy. Nautilus added two scripts (XS edit, pre-V2):

- `deploy:rules:dev` = `firebase use dev && firebase deploy --only firestore:rules`
- `deploy:rules:prod` = `firebase use prod && firebase deploy --only firestore:rules`

V2 now uses two commands (`deploy:dev` + `deploy:rules:dev`). The
alternative — extending `deploy:dev` to `--only hosting,firestore:rules`
— is deferrable; current shape keeps the granular controls. If a
combined script ever feels worth it, add `deploy:all:dev` rather
than overloading `deploy:dev`.

### 1. `authDomain` had to move off the Firebase default

**Symptom**: sign-in completed Google OAuth round-trip successfully
but landed back at SignedOutScreen with no console errors and no
session in IndexedDB. Every attempt looped.

**Root cause**: Firebase's default `authDomain` =
`<project-id>.firebaseapp.com`, which is a different origin from
the SPA (`<project-id>.web.app`). Firebase Auth's redirect flow
stores OAuth tokens in `firebaseapp.com`'s IndexedDB and then
opens a hidden iframe from `firebaseapp.com/__/auth/iframe`
embedded in the SPA at `web.app` to relay them via postMessage.
Chrome's storage partitioning (rolling out across 2024–2025) treats
the iframe as third-party-inside-`web.app` and gives it a separate,
empty partitioned IndexedDB. The iframe sees no tokens, reports
no session, `getRedirectResult` resolves null, user appears
signed-out.

**Fix**: change `authDomain` to the SPA's own hosting domain.
Both `<project-id>.web.app` and `<project-id>.firebaseapp.com`
serve Firebase Hosting's reserved `/__/auth/handler` and
`/__/auth/iframe` paths, so the auth handler still works — but
now from the SPA's own origin. Eliminates the cross-origin step.

Edits:

- `.env.development`:
  `VITE_FIREBASE_AUTH_DOMAIN=flog-dev-497401.web.app`
  (was `flog-dev-497401.firebaseapp.com`).
- `.env.production`:
  `VITE_FIREBASE_AUTH_DOMAIN=flog-prod-497401.web.app`
  (was `flog-prod-497401.firebaseapp.com`).

The GCP OAuth Client's Authorized Redirect URIs already included
`https://<project-id>.web.app/__/auth/handler` from M1's setup
(runbook §5c). No GCP Console change needed for dev; **prod
cutover still needs the same flip verified on its OAuth Client**.

### 2. `getRedirectResult` errors were being swallowed

**Symptom**: silent failure with zero diagnostic output, which
masked finding #1's root cause for several round-trips.

**Root cause**: `AuthProvider.tsx` originally had:

```ts
getRedirectResult(auth).catch(() => {
  // Swallow: any redirect error surfaces via subsequent auth state.
});
```

The premise that "the error surfaces via subsequent auth state"
is false when the error itself prevents auth state from
establishing.

**Fix**: log via `console.error('getRedirectResult failed', err)`.
Diagnostic stays in the production bundle as the new norm — it's
cheap (only fires on actual failures) and the next time a sign-in
breaks for a user, the failure mode is visible without redeploying.

### 3. `GoogleAuthProvider` missing `prompt: 'select_account'`

**Symptom (a)**: after the authDomain fix, sign-in worked but the
first attempt after a sign-out still failed; the second attempt
succeeded. "Every-other" pattern.

**Symptom (b)**: rejected user clicking "Sign out / Try a different
account" got no account chooser on the next sign-in — Google
silently re-authenticated the same account, dumping them right back
on RejectedScreen. No way to switch accounts from inside the app.

**Root cause**: bare `new GoogleAuthProvider()` doesn't set the
OAuth `prompt` parameter. Google's default is `prompt=none` when
the user has exactly one active Google session, meaning silent
re-auth without a chooser. This breaks the rejection-recovery flow
(symptom b) and — incidentally — pushes Firebase Auth onto a
silent-auth code path that triggered the "first try fails" pattern
in Chrome (symptom a). The chooser code path doesn't have the same
bug.

**Fix**: `googleProvider.setCustomParameters({ prompt: 'select_account' })`.
Forces the chooser on every sign-in (small UX tax: one click to
re-select your account); fixes both symptoms.

### Prod cutover — deferred to M4 close

Originally telegraphed as "pending at M2 close" while flagging
the auth/M2 closure conversation. Reframed 2026-05-28: M2's
acceptance criteria were dev-only by design (brief §8 V4). Prod
has no useful surface until M4 (log fill-up) lands; onboarding
family to a "sign in → No cars yet" experience would spend their
attention without giving them anything in return. M3 and M4 run
dev-only (same posture as M2). Prod cutover at **M4 close** does
double duty: first usable surface ships AND family onboards in
one motion. `.env.production` already has the new authDomain on
disk for whenever that happens.

### Closure status

After all three fixes deployed to `flog-dev`:

- Admin signs in first try → EmptyHomeScreen → `users/{uid}` doc
  appears in Firestore.
- Rejected user (any non-allowlisted Google account) lands on
  RejectedScreen first try with email shown.
- Sign-out → sign-in cycles work cleanly with account chooser.
- Reload-as-admin preserves session.

Brief §4 #1's premise (popup hostile to iOS Safari → must use
redirect) is wrong for flog. Family is on Android Chrome, where
redirect *does* work after the three fixes above. The decision
stands, but the rationale in the brief should be read as historic.
If a future M-series dispatch needs to reconsider popup vs redirect
(e.g., a multi-provider OAuth expansion), don't inherit §4 #1's
reasoning uncritically.

### Documents updated as part of closure

- `dispatch/M2-auth-allowlist.md` §13 (Forward feedback) — three
  numbered entries for the rakes captured here.
- `dispatch/runbooks/gcp-firebase-env-setup.md` — Phase 2 env file
  template + the rakes catalogue updated so future env spinups set
  `authDomain` to the hosting domain from the start, and the
  `prompt: 'select_account'` guidance lands at auth-wiring time.
- `dispatch/paralarva-feedback-003-firebase-auth-defaults.md` —
  new kit-level forward-feedback doc.
- Auto-memory (`project_flog_bootstrap.md`) — M2 shipped status,
  V2 rakes summary, M3 next.

---

## Files created

```text
flog/
├── eslint.config.js                  (new — flat config, ESLint 9)
├── firestore.rules                   (rewritten — PRD §6 ruleset)
├── package.json                      (modified — deps + scripts)
├── tsconfig.json                     (modified — adds test ref)
├── tsconfig.test.json                (new)
├── vitest.config.ts                  (new — unit test runner)
├── vitest.rules.config.ts            (new — rules test runner)
├── .env.development                  (modified — VITE_ADMIN_EMAIL)
├── .env.production                   (modified — VITE_ADMIN_EMAIL)
├── src/
│   ├── App.tsx                       (rewritten — status switch)
│   ├── env.d.ts                      (modified — admin env type)
│   ├── index.css                     (modified — @theme block)
│   ├── main.tsx                      (modified — AuthProvider wrap)
│   ├── auth/
│   │   ├── AuthContext.ts            (new — Context object)
│   │   ├── AuthProvider.tsx          (new — state machine)
│   │   ├── canonicalEmail.test.ts    (new — unit test)
│   │   ├── canonicalEmail.ts         (new — boundary normalize)
│   │   ├── firstSignIn.ts            (new — users/{uid} create)
│   │   ├── googleProvider.ts         (new)
│   │   └── useAuth.ts                (new — hook)
│   ├── firebase/
│   │   ├── auth.ts                   (new — getAuth(app))
│   │   └── firestore.ts              (new — getFirestore(app))
│   └── screens/
│       ├── EmptyHomeScreen.tsx       (new)
│       ├── LoadingScreen.tsx         (new)
│       ├── RejectedScreen.tsx        (new)
│       └── SignedOutScreen.tsx       (new)
└── tests/
    └── rules/
        ├── allowlist.test.ts         (new)
        ├── cars.test.ts              (new)
        ├── entries.test.ts           (new)
        ├── helpers.ts                (new — env factory + fixtures)
        └── users.test.ts             (new)
```

Plus this handoff at `dispatch/M2-auth-allowlist-handoff.md` and the
single-line lint fix on the M1 handoff (per Deviation #2).

---

## Files NOT touched (confirmed)

- `PRD.md`
- `AGENTS.md`
- `BACKLOG.md`
- `CUTTLEFISH-NAUTILUS.md`
- `WORKING-MODEL.md`
- `HANDOFF-TEMPLATE.md`
- `README.md`
- The brief itself (`dispatch/M2-auth-allowlist.md`) — §13 forward
  feedback channel is empty (no rakes severe enough to warrant a
  formal entry; minor notes captured below).
- `.firebaserc`, `firebase.json`, `vite.config.ts`,
  `tsconfig.node.json`, `src/firebase/config.ts`,
  `src/firebase/app.ts`.

Two intentional exceptions, both documented in Deviations:

- `tsconfig.app.json` — added a 1-line `exclude` clause.
- `dispatch/M1-infrastructure-handoff.md` — added backticks around
  six existing tokens on line 10 to clear a pre-existing lint error.

---

## Items deferred

### To the next dispatch (M3 — Cars CRUD + share)

- **Atomic share-write**: `cars/{carId}.shareeEmails += email` and
  `allowlist/{email}` doc create must land in one batched write per
  AGENTS "Share-with-user must be atomic." The rule for
  `allowlist/{email}` create is already in place and tested; M3
  wires the client side.
- **Email-input canonicalization at the share form**:
  `canonicalEmail()` is in place; the share form must apply it
  before any allowlist read/write.
- **Add Car affordance**: hidden in M2 per brief §4 #6;
  EmptyHomeScreen reserves space for it but renders the "Adding a
  car will land in a future update." placeholder.
- **`components/` directory**: not created in M2 (screens-only). M3
  introduces it if and when a sub-page widget emerges.
- **Pin `entries` to a `loggedAt` server timestamp** in the M4
  create path — the rule allows but doesn't require; AGENTS
  "loggedAt is always a server timestamp" needs enforcement at the
  app boundary.

### To BACKLOG

- `[ ]` **Code-splitting / `firebase/auth` + `firestore` dynamic
  imports** — XS-S. Bundle climbed from 179 KB to 605 KB (gz 54 →
  156 KB) on adding Auth + Firestore. Acceptable for v0 (first-load
  on 4G under 3s per PRD §9 is still in budget at 156 KB gz over
  4G), but BACKLOG-Later candidate if mobile first-load ever feels
  slow.
- `[ ]` **Verify rules `get()` caching semantics for entries
  queries** — XS. Brief §9 #1 + §7.3 note. The question: does a
  query of N entries issue 1 or N `get(/cars/{carId})` reads? Best
  to verify with a counted-reads integration before M5 ships per-
  car detail. If N, the mitigation is denormalizing `readableBy`
  onto Entries (or rule restructure). Worst case is still well
  under tripwire.
- `[ ]` **Address the 4 moderate-severity npm audit findings**
  inherited from M1 — XS. M2 added more deps; need a refreshed
  scan. Not blocking.

---

## Expected cost impact

Signed-in path adds:

- **1 Firestore `getDoc(users/{uid})` per auth-state resolution**
  (mount + every reload while a session is active). Roughly 1 read
  per app open — family-of-4 scale this is ~10–30 reads/day.
- **0 or 1 `setDoc(users/{uid})`** — exactly 1 per user lifetime
  (first sign-in only). Once `users/{uid}` exists, the `getDoc`
  short-circuit prevents further writes.
- **0 ongoing reads/writes** for signed-out users.

Total: trivially within Spark free tier (PRD §8 budget). M2 does
not touch the per-page read budgets called out by §8 (Home, Per-car
detail, Log fill-up) — those land in M3+.

---

## Manual steps for the human owner

Before reviewing:

1. `npm install` (12 new devDeps — eslint, vitest, etc.).
2. `npm run lint && npm test && npm run test:rules && npm run
   build:dev && npm run build:prod && npm run lint:md` — all five
   gates should exit zero. The `test:rules` step starts the
   Firestore emulator under the hood (requires
   `firebase-tools@^14`, already present at v15.18.0 on this host).

V2 verification (post-deploy):

1. `npm run deploy:dev` — pushes hosting + rules to `flog-dev-
   497401`. (Note: M1's `deploy:dev` script only deploys hosting.
   Rules need a separate `firebase use dev && firebase deploy
   --only firestore:rules`, OR extend the deploy script to include
   both — flagging as a minor next-dispatch decision; doing so
   touches `package.json` not in this dispatch's scope.)
2. Sign in as `austindavid@gmail.com` (admin carve-out) cold from a
   fresh browser session — should land on `EmptyHomeScreen` after
   the redirect handshake. Firebase Console → Firestore Data should
   show `users/{your-uid}` with the four PRD §5.1 fields populated.
3. Sign out from `EmptyHomeScreen`; should return to
   `SignedOutScreen` without reload.
4. Sign in as any other Google account → should land on
   `RejectedScreen` displaying that email. Clicking "Sign out /
   Try a different account" should clear the Firebase Auth session
   and return to `SignedOutScreen`.
5. Reload while signed in as admin — session should persist (no
   re-sign required); `EmptyHomeScreen` should render after the
   brief Loading flash.

If V2 reveals an issue, the rules can be re-deployed independently:
`firebase use dev && firebase deploy --only firestore:rules`.

---

## Notes for the next dispatch brief

- **`@firebase/rules-unit-testing@4` works against
  `firebase@11.10.0`; v5+ needs `firebase@12+`.** When the project
  eventually bumps firebase, also bump rules-unit-testing.
- **Firestore emulator startup chatter** includes lsof warnings
  from a smbfs Time Machine mount; cosmetic, ignored. Could file as
  paralarva feedback if it ever obscures a real signal.
- **Rules deploy scripts added during V2.** `deploy:rules:dev` and
  `deploy:rules:prod` now exist alongside the M1 hosting-only
  scripts. Two-command pattern (`deploy:dev` + `deploy:rules:dev`)
  is the M3+ default. See Post-ship findings §0.
- **AuthProvider state machine has a `resolvingUidRef` guard** that
  is easy to miss when reading cold. Without it, React StrictMode's
  double-effect in dev causes `ensureUserDoc` to fire twice with
  the same uid; the second `setDoc` produces a benign-but-noisy
  `permission-denied` because the rule's `request.resource.data
  .diff(...)` check on update doesn't apply to create (so the
  re-create attempt with `createdAt` re-set is treated as a create
  and… actually succeeds the second time too, but the doubled
  network calls are wasteful and the `'created'` vs `'existing'`
  return value is wrong). The ref makes the state machine
  idempotent per uid. Document this for M3 if a future
  authenticated-side-effect helper needs the same pattern.
- **`fbc.t` file at the repo root** is the raw Firebase config
  Austin pasted from the Firebase Console during M1 (captured here
  during the discovery period before `M1-g-outputs.md` was
  established as the canonical capture file). Contains the dev
  `apiKey`, `measurementId`, etc. — none of which are secrets
  (Firebase config is public-by-design per AGENTS) but the file
  is duplicate state with `.env.development`. Recommend owner
  delete during housekeeping; gitignored either way (`*.t`-style
  files aren't excluded by current `.gitignore` though, so a
  more targeted entry or outright delete is cleaner).
- **`NEXT-SESSION-PICKUP.md` at root** is the prompt the previous
  nautilus left for me to bootstrap into this session. It served
  its purpose at M2 kickoff. Safe to delete during housekeeping
  (its content is duplicate of auto-memory's "How to apply" section
  in `project_flog_bootstrap.md`); not blocking anything if kept.
- **The brief §13 "Forward feedback" channel** is left empty — no
  rakes severe enough to warrant a formal numbered entry. The
  rules-unit-testing peer-version pin (above) is the closest, but
  it was already implicit in the brief's "no major bumps" posture.

---

End of M2 handoff.
