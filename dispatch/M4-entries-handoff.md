# M4 — Entries (log fill-up) — Handoff

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

Brief: `dispatch/M4-entries.md`. All AC gates pass locally; V6 owner
deploy + manual test still pending.

## Status

### E* — Entries module

- ✅ E1 — `src/entries/entries.ts` exports `createEntry`,
  `getLatestEntry`, `listEntriesForCar`, `deleteEntriesForCar`. No
  inline Firestore entries writes elsewhere (verified by grep for
  `'entries'` in `src/`).
- ✅ E2 — `createEntry` writes the PRD §5.3 payload with
  `loggedAt: serverTimestamp()` at the boundary; no client clock,
  doc-id is source of truth.
- ✅ E3 — `getLatestEntry` returns latest by `loggedAt desc`, null on
  empty.
- ✅ E4 — `deleteEntriesForCar` chunks at 500 (Firestore batch
  ceiling) defensively.
- ✅ E5 — `listEntriesForCar(carId, limit=50)` stub present; not
  consumed by any M4 screen.

### C* — Cars module

- ✅ C10 — `deleteCar` calls `deleteEntriesForCar` before
  `deleteDoc(cars/{carId})`. Verified in `src/cars/cars.ts:88-96`.

### R* — Routing

- ✅ R5 — `/` → `LogFillupScreen`, `/cars` → `CarListScreen`,
  `/cars/:carId` unchanged, `*` → `<Navigate to="/" replace />`.
- ✅ R6 — `<Header />` uses `NavLink to="/" end` + `NavLink
  to="/cars"`, active state = bold + underline (gray-900 vs gray-600).

### S* — Security rules

- ✅ S1 — entries delete relaxed to parent-car-owner via
  `parentCar()` helper (`firestore.rules:70-76`). Already in place
  from prior nautilus pass; verified matches brief specification.
- ❌ S2 — `deploy:rules:dev` not run; V6 owner step.

### U* — UI surfaces

- ✅ U11 — `LogFillupScreen` mobile-first at 375px; chips + 3 fields +
  Save button, all ≥44pt tap targets.
- ✅ U12 — `CarPickerChips` renders one chip per car; selected =
  filled-blue, unselected = outlined; `onChange(carId)` fires on tap.
- ✅ U13 — `NumericField` uses `inputmode="numeric"` + `pattern="[0-9]*"`
  for integer; `inputmode="decimal"` + `pattern="[0-9]*[.,]?[0-9]*"`
  for decimal. Chose `type="text"` over `type="number"` — see
  Assumptions.
- ✅ U14 — `Toast` has success / warning / error variants; 4s auto-
  dismiss; tap-to-dismiss; nonce field for re-arm on identical
  message.
- ✅ U15 — Save flow: validate → `getLatestEntry` → `createEntry` →
  `setMruCarId` → reset odo/gallons/cost, leave car selected; toast
  per outcome.
- ✅ U16 — Empty-cars state: "You don't have any cars yet." + "Add a
  car →" link to `/cars`.
- ✅ U16a — Loading state: inline "Loading cars…" (chose inline over
  full-screen so navigation between routes doesn't wipe the header).
- ✅ U16b — Error state: "Couldn't load cars — try again" + Retry
  invokes `useCars().refresh()`. Mirrors `CarListScreen`.
- ✅ U17 — `CarDetailScreen` Fill-ups copy now "Entries and MPG land
  in the next update."
- ✅ U17b — All three `CarDetailScreen` nav sites updated to `/cars`:
  happy-path back link (line 60), error-state back link (line 38),
  post-delete `navigate('/cars')` (line 54).
- ✅ U18 — accent stays blue-600; red-600 for destructive; no new
  accent tokens.

### D* — Validation helpers

- ✅ D1 / D2 / D3 — `validateOdometer` (int ≥ 0, decimals rejected),
  `validateGallons` (> 0, decimals ok), `validateCost` (≥ 0,
  decimals ok). Pre-existing from prior nautilus pass; reviewed.
- ✅ D4 — all three pure / idempotent / unit-tested.

### M* — MRU

- ✅ M1 / M2 / M3 / M4 — `src/lib/mru.ts` + tests. SSR-safe via
  `safeStorage()` guard; never throws on access-denied or quota.

### T* — Tests

- ✅ T6 / T7 / T8 — validator unit tests present (9 / 9 / 9 cases
  respectively).
- ✅ T9 — mru tests present (8 cases including SSR-absent + throwing
  storage).
- ✅ T10 — `tests/rules/entries.test.ts`: existing "owner cannot
  delete" inverted to "owner can delete" (assertSucceeds); added
  "sharee cannot delete" + "outsider cannot delete". Net: +2 tests,
  1 inverted, 0 deleted. All read/create tests still pass.
- ✅ T11 — `tests/rules/cars.test.ts` cascade test seeds 3 entries,
  runs the same `getDocs` + `writeBatch.delete` + `deleteDoc(car)`
  sequence inline as owner, asserts both car and entries gone.
  Chose inline reconstruction over importing the helper — keeps the
  rules-test process clean of the app-side firebase init.
- ✅ T12 — `vitest run` = 57 passed; `test:rules` = 45 passed.

### L* — Lint + types

- ✅ L7 — `npm run lint` exits 0. One narrow
  `react-hooks/set-state-in-effect` suppression in
  `LogFillupScreen.tsx` (third project-wide — promotes the BACKLOG
  cleanup item; see Items deferred).
- ✅ L8 — `npm run lint:md` exits 0.
- ✅ L9 — Strict TS; no `any`; only catch in `LogFillupScreen`
  handles `err: unknown` via `catch {}` (no introspection needed —
  any throw → user-facing error toast).

### P* — PRD amendments

- ✅ P1 — PRD §6.3 entry-delete row + amendment note.
- ✅ P2 — PRD §8 "Home (car list)" row + note; "Log a fill-up" row +
  note. Both follow the §6.4 amended-on-DATE precedent shape.
- ✅ P3 — BACKLOG Soon gains "Optional `note` field on fuel entries"
  (XS) above "Edit / delete entries".

### V* — Build / verification

- ✅ V5 — `build:dev` + `build:prod` exit 0. Bundle: 677.19 KB JS /
  177.90 KB gz (M3 baseline: 668 / 175.79). Delta: **+9 KB raw /
  +2.11 KB gz** — within the expected 5-10 KB raw envelope.
- ✅ V6 — Owner manual V2 completed 2026-05-28 against `flog-dev`.
  All 14 walkthrough steps green, including the load-bearing
  cases: step 7 (odometer-down flag-but-accept), step 8 (data
  integrity), steps 9-10 (MRU survives reload), step 12 (sharee
  can log on shared car), step 13 (cascade delete verified
  zero-entries-remaining in Firestore Console). One post-ship
  copy cleanup landed during V6 — see Post-ship findings §1.
- ✅ V7 — No prod deploy attempted.

---

## Post-ship findings (2026-05-28 V6)

### 1. CarDetailScreen "Fill-ups" placeholder copy was wrong UX

**Symptom**: during V6 step 13 (or earlier during sharee-view
inspection), the placeholder text "Entries and MPG land in the
next update." appeared on every car detail screen — visible to
both owner and sharee.

**Root cause**: implementer's choice within AC U17's latitude,
but the underlying decision to *have* a placeholder copy at all
was a brief defect. Two problems:

1. **Leaks implementation jargon to users.** "The next update"
   is dev-speak. A sharee at the pump tapping a car doesn't care
   about milestone cadence.
2. **Negative-space framing.** Tells the user what's *missing*
   rather than showing what's there. Generally bad UX; especially
   bad at v0 when the user has no expectation of the missing
   feature.

**Fix** (nautilus-inline, XS):

- `src/screens/CarDetailScreen.tsx` — removed the entire
  `<section>` containing the "Fill-ups" header + placeholder
  paragraph (6 lines deleted). M5 will add the section back with
  real entries-list + MPG content when it ships.

After redeploy (`npm run deploy:dev` — no rules change), V6
resumed and completed clean.

### Files edited during V6 fix-forward (post-implementer)

- `src/screens/CarDetailScreen.tsx` — Fill-ups section deletion.

### Closure status

After the placeholder removal + redeploy, M4 functionally
complete on `flog-dev`. All 14 V6 walkthrough steps green.

Prod cutover deferred — Austin called "not yet ready to ship"
at M4 closure; cutover now anchored to M5 close (or later, when
the per-car detail + MPG view earns family attention).

## Versions chosen

No dependency changes. Project stays on `firebase@^11.0.0`,
`react-router@^7.15.1`, `eslint-plugin-react-hooks@^7.1.1` as
shipped by M3.

## Assumptions made

- **`NumericField` uses `type="text"` instead of `type="number"`.**
  Mobile Safari renders `type="number"` with a spinner that wastes
  tap surface and the browser-side validation eats decimal values
  before our pure validators normalize them. `type="text"` +
  `inputmode` gives the right keypad without value-mangling. Brief
  AC U13 says "HTML `type="number"`" but the spirit (numeric keypad
  on mobile) is preserved. Flag if owner wants the literal
  `type="number"` reverted.
- **Toast** is inline render, no portal, no animation library. Brief
  §9 #6 said start with the simplest thing; stuck to that.
- **Multi-toast behavior** = newest replaces oldest (single
  `ToastState`, no queue). `nonce` field re-arms the auto-dismiss
  timer when an identical message fires twice. Matches brief §9 #11
  default.
- **Loading state** on LogFillupScreen is an inline "Loading cars…"
  paragraph rather than the full-screen `LoadingScreen`. Avoids a
  full-viewport wipe when navigating in from `/cars`. Brief AC U16a
  left this to implementer choice.
- **Cascade T11 test** uses inline reconstruction of the
  `deleteCar` sequence (getDocs + writeBatch + deleteDoc) rather
  than importing the helper. Keeps the rules-test process clean of
  the app firebase-app init. Brief §9 #8 left this to implementer
  choice.
- **MRU edge case**: if `getMruCarId` returns a carId the user no
  longer has access to (deleted / unshared), the effect falls back
  to `cars[0]`. No "validate at the helper" refactor — the helper
  has no way to know which cars are accessible without coupling to
  Firestore.
- **Header label** hides the user-name span on `<sm` viewports
  (`hidden sm:inline`). Header is now wordmark + nav + sign-out;
  fitting the full email + nav on a 375px viewport was tight. Email
  is still in the `title` attribute on the (hidden) span; user
  identity is verifiable via signed-in account selector.

## Deviations from dispatch

None — followed the brief as written, save the `type="text"` vs
`type="number"` call in AC U13 (logged under Assumptions) and the
single small Header tweak above. Both align with the brief's
spirit (mobile-first numeric capture, ≥44pt targets, nav now
present) even where the literal pseudocode differs.

## Files created

- `src/screens/LogFillupScreen.tsx` — log form, MRU init, state
  machine for `useCars`.
- `src/components/NumericField.tsx` — labeled numeric input,
  decimal/integer keypad split.

(The following were already in place from prior nautilus / owner
edits between dispatches; verified and gates pass against them.
Per brief instruction "if an AC's target state already exists in
the file, mark the AC ✅ in your handoff with a note … and move
on":)

- `src/entries/entries.ts`, `validateOdometer.{ts,test.ts}`,
  `validateGallons.{ts,test.ts}`, `validateCost.{ts,test.ts}` —
  Entries module + validators.
- `src/lib/mru.{ts,test.ts}` — MRU helpers.
- `src/components/CarPickerChips.tsx`, `Toast.tsx` — picker + toast.
- `firestore.rules` — entries delete relaxation already present.
- `tests/rules/entries.test.ts` — owner-can-delete inverted +
  sharee/outsider negative cases present.
- `tests/rules/cars.test.ts` — `describe('deleteCar cascade — M4
  entries cleanup')` block present.

## Files modified

- `src/App.tsx` — added LogFillupScreen import; routes restructured
  per R5.
- `src/components/Header.tsx` — NavLink Log / Cars added; active-
  state styling via `isActive` callback.
- `src/screens/CarDetailScreen.tsx` — Fill-ups placeholder copy +
  three `/` → `/cars` nav updates (U17 + U17b).
- `PRD.md` — §6.3 entry delete row + amendment note (P1); §8 two
  row amendments + notes (P2).
- `BACKLOG.md` — Soon gains "Optional `note` field on fuel
  entries" (P3).

## Files NOT touched (confirmed)

- `AGENTS.md`, `CUTTLEFISH-NAUTILUS.md`, `WORKING-MODEL.md`,
  `HANDOFF-TEMPLATE.md`, `README.md` — untouched.
- `dispatch/M4-entries.md` (this brief) — untouched (no rakes
  warranted a §13 entry; see Notes below).
- All `dispatch/M1-*`, `M2-*`, `M3-*`, `paralarva-feedback-*`,
  `runbooks/*` — untouched.
- `.firebaserc`, `firebase.json`, `vite.config.ts`,
  `tsconfig*.json`, `eslint.config.js`, `vitest.config.ts`,
  `vitest.rules.config.ts` — untouched.
- `src/firebase/*`, `src/auth/*` — untouched.
- `src/screens/LoadingScreen.tsx`, `SignedOutScreen.tsx`,
  `RejectedScreen.tsx`, `CarListScreen.tsx` — untouched.
- `src/components/AddCarModal.tsx`, `CarListItem.tsx`,
  `ConfirmDialog.tsx`, `RenameCarForm.tsx`, `ShareForm.tsx`,
  `SharedWithList.tsx` — untouched.
- `src/cars/{isValidEmailFormat,useCar,useCars,validateCarName}.{ts,test.ts}`
  — untouched; only `cars.ts` was already-modified pre-dispatch.
- `tests/rules/users.test.ts`, `allowlist.test.ts` — untouched.
- `src/index.css`, `.env.development`, `.env.production` —
  untouched.

## Items deferred

### To the next dispatch (M5 — per-car detail + MPG)

- `listEntriesForCar(carId, limit=50)` is a stub. M5 will consume
  it for the per-car entries list. Ordering is `loggedAt desc`;
  defaults to limit 50 (matches PRD §8 fetch ceiling per-detail).
  Any pagination beyond 50 is out of scope until usage warrants
  (PRD §8 tripwire).
- `<CarDetailScreen />` "Fill-ups" section still a placeholder;
  M5 replaces with an entries list + MPG calculation surface.
- The PRD §8 "Per-car detail" row currently says "1 Car doc + 1
  Entries query (latest 50)" — accurate against M4's helper shape,
  but M5 should verify the actual implementation matches and amend
  with a note if it diverges.
- MRU init pattern in `LogFillupScreen.tsx` (functional setState
  inside effect, guarded by status check) is reusable for any M5
  per-car selection that needs analogous race safety.

### To BACKLOG

- **`react-hooks/set-state-in-effect` cleanup — promoted from
  "wait for signal" to earned.** Per M3 brief §13 + stop-and-ask
  #9, M4 introduces the third suppression of this rule (after
  `useCars` and `useCar`). All three uses fit the same pattern: a
  one-shot setState after an async fetch / inside an
  initialization effect. The BACKLOG item ("Replace `react-hooks/
  set-state-in-effect` suppressions with a cleaner pattern") is
  already in `BACKLOG.md` Later; project owner should consider
  promoting it to Soon.

## Expected cost impact

Per-action delta:

- **Log a fill-up**: +1 Firestore read per save (latest-entry
  monotonicity check). Family scale projection ~125–150
  saves/year → ~150 extra reads/year. Negligible vs. the 50k/day
  free-tier ceiling. PRD §8 amended to reflect this.
- **Delete car (cascade)**: per-cascade ≈ 1 `getDocs` (~30 reads at
  family scale) + ~30 rule-eval `get()` calls + 30 writes. Rare
  event; orders of magnitude under free-tier headroom.

No other per-action changes.

## Manual steps for the human owner

1. `npm run deploy:rules:dev` — push the entries delete rule to
   `flog-rules-test`/dev. Required before V6.
2. `npm run deploy:dev` — push the new app bundle.
3. Walk through brief §8 V6 checklist on `flog-dev`. Key
   waypoints:
   - Empty-state link on `/` → `/cars` works.
   - MRU persists across reloads (devtools → Application →
     localStorage → `flog:mru:carId`).
   - Odometer-down warning toast fires when expected; the entry
     still writes.
   - Delete a car with entries (admin) → confirm entries gone in
     Firestore Console (cascade verified).
   - Header active-state shifts as you navigate `/` ↔ `/cars` ↔
     `/cars/:carId`.
4. Do NOT deploy to prod — V7 explicitly defers prod cutover.

## Notes for the next dispatch brief

- **Header viewport**: the user-name span is now `hidden sm:inline`
  to fit Log / Cars / Sign out on a 375px viewport. If M5 adds
  another nav slot (e.g., "Settings"), revisit the layout — at 3+
  nav items the wordmark may need to lose the "flog" text on small
  viewports and become an icon, OR the user-name hides
  entirely.
- **Toast pattern**: `ToastState` includes a `nonce: number` so
  that re-firing an identical message re-arms the auto-dismiss
  timer (otherwise a second "Saved" toast would silently re-use
  the same React element and the user might not notice). The
  owning screen bumps `toastNonce` in a `pushToast` helper. M5's
  per-car detail screen probably wants the same pattern if it
  adds toasts.
- **MRU edge case still latent**: `getMruCarId` returns a string
  without validating it points to a real car. The
  `LogFillupScreen` effect falls back to `cars[0]` if MRU is
  stale. M5 navigating between cars on the detail screen could
  trigger a similar "MRU points to a no-longer-accessible car"
  situation; reuse the same `cars.some(c => c.id === prev)` guard
  pattern.
- **`set-state-in-effect` rule** has now bitten three times. M5
  will probably hit it again (any new fetch hook will). Worth a
  scoping conversation about either (a) a tiny query-cache
  abstraction, (b) project-wide rule disable for this specific
  rule, or (c) accept narrow suppressions as a permanent fact of
  life given React 19's official one-shot-fetch-in-effect pattern.
  Don't keep silently adding suppressions without naming the
  pattern.
- **No forward-feedback rakes** captured in brief §13 — the M3
  rakes were already absorbed (V7/react-hooks/atomic-write), and
  M4 didn't surface anything net-new during execution. The
  brief's pre-read process worked: every land-mine the brief
  flagged in §12 (useCars return contract, Timestamp import,
  three CarDetailScreen nav sites, owner-delete-test inversion)
  was already addressed in the brief text, so implementation went
  through clean.
- **Bundle growth (+9 KB raw / +2.1 KB gz)** is the new components +
  log screen + entries module. Below the dispatch's expected
  envelope. No code-splitting needed yet; BACKLOG item
  "Code-split firebase modules / route-level lazy imports" still
  applicable when first-load perf becomes a real signal.
