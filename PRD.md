# flog — Product Requirements Document (v1)

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

---

## 1. Overview

**Purpose**: flog is a fuel log for small groups managing small groups
of cars. It replaces the lightweight Google Forms that families and
similar small groups commonly use to track fill-ups across shared
vehicles — improving capture-and-review without disrupting the
existing ritual.

The canonical v0 user is the project owner's family: 4 people sharing
4–5 cars, ~99% fuel fill-up entries, ~1% incidental maintenance notes
in the legacy Google Form. The current form captures car / odometer /
gallons / cost / free-text-notes and produces no derived view. flog
v0 ships that same capture loop with a small step up in usefulness
(per-car MPG view) and a real step up in ergonomics (mobile-first,
persistent UI, one-tap car switch).

### 1.1 Goals (v0)

- Replace the Google Form. Capture car + odometer + gallons + cost
  in fewer clicks at the gas pump than the form takes.
- Surface basic MPG insight: per-car last-fill MPG and lifetime
  average.
- Multi-user from day 1: car ownership, share-by-email, allowlist-
  gated access.
- Mobile-first; works one-handed at the pump.
- Run free on the Firebase free tier at family scale.

### 1.2 Non-goals

Each item below is a deliberate "no" for v0. Future BACKLOG items
that would violate one get a ⚠️ flag pointing back here.

- **Not a fleet management tool.** No commercial-vehicle features,
  no driver assignment workflows.
- **Not a social product.** No comments, no following, no public car
  pages, no anonymous read-only share links.
- **No real-time collaboration.** One human fills a car at a time;
  no concurrent-write synchronization needed. One-shot Firestore
  reads only; no `onSnapshot` listeners.
- **No multi-currency.** USD-only in display. The schema does not
  encode currency (single numeric `cost` field); revisiting later
  doesn't require data migration, only UI.
- **Not a price-comparison tool.** No fetching of external gas
  prices.
- **No third-party integrations** (Carfax, OBD-II, fuel cards, etc.)
  in v0.
- **No maintenance entries or service reminders** in v0. Reserved
  for the maintenance phase.
- **No CI/CD gating.** Manual `npm run deploy:dev` and `npm run
  deploy:prod` is the v0 promotion model. Matches the sibling
  project's posture; revisit when complexity earns it.
- **No analytics, no behavioral tracking, no third-party scripts**
  beyond Google Identity for OAuth.
- **No custom branding, no logo, no privacy page** in v0. v0
  competes with a Google Form, which has none of these either.
  Revisit when scope/user-base graduates past family.
- **No custom domain** in v0. `flog-dev.web.app` and
  `flog-prod.web.app` are the Hosting URLs.

### 1.3 Future-phase / deferred

The working list is `BACKLOG.md` once v0 ships. Notable deferrals
already known at PRD time:

- Edit/delete entries (Soon)
- Maintenance entries + service reminders (later phase; opens up
  oil-change-due, tire-rotation-due, etc.)
- Reports beyond per-car MPG (max-ever-fuel, best-MPG, trends)
- CSV export of your data; account deletion (committed-to in §1.4,
  not v0)
- Admin allowlist UI (separate from the share-with-user side effect)
- Custom domain, logo, privacy page (when product graduates past
  family scope)
- Dark mode

### 1.4 Philosophical commitments

- **Your data is yours.** Export (CSV) and account-delete (purge
  your User doc + Entries you authored + un-share you from others'
  cars) are committed-to. They don't ship in v0, but the data model
  is built so they drop in cleanly later.
- **No behavioral telemetry, ever.** No GA, no Posthog, no Segment,
  no third-party scripts beyond Google Identity for OAuth. If we
  ever need product insight, we build server-side aggregates from
  Firestore or accept that we don't have the data.
- **Free-tier-by-default.** If Firebase usage approaches a paid
  threshold, that's a signal to revisit assumptions, not to upgrade
  reflexively.
- **Capture > insight.** v0's primary value is lower-friction
  capture than a Google Form. Reports earn their place by being
  cheap to compute and never slowing capture.

---

## 2. Target user

**Primary user**: a member of a small group (typically a family;
plausibly roommates, coworkers, close friends) who shares one or more
vehicles and wants to log fill-ups across them with shared
visibility. Canonical v0 user: the project owner's 4-person family
sharing 4–5 cars.

**Secondary user (deferred-design)**: a one-person, one-car driver
who wants a personal log without sharing. The schema supports this
(single owner, zero sharees) but the UX isn't optimized for it. If
single-user becomes a real use case, revisit the sharing affordances
so they hide when not needed.

**Non-users**:

- Fleet operators / commercial drivers (different scale, different
  access controls).
- Anyone wanting a maintenance-centric vehicle log without fuel —
  flog is fuel-first in v0.
- Anyone needing offline-first capture — v0 assumes connectivity at
  the pump. Gracefully degrade later if this bites real users.

---

## 3. Glossary

- **Car**: a logical vehicle. Has a name, an owner, and zero or more
  sharees. Lives in the Firestore `cars` collection.
- **Entry**: a single fuel fill-up record against a car. Lives in
  `cars/{carId}/entries`.
- **Owner**: the user who created a car. Controls metadata (rename,
  delete) and sharing (add/remove sharees).
- **Sharee**: a user (by email) granted log-and-view access to
  someone else's car. Cannot share onward, cannot rename or delete
  the car.
- **Allowlist**: the set of email addresses authorized to sign in.
  Auto-populated as a side effect of car-sharing; the bootstrap
  admin (project owner) gets in via a Firestore rules carve-out.
- **MPG**: miles per gallon, computed `(odometer_now -
  odometer_prev) / gallons_now` per car. Assumes complete fill-ups;
  this is a project-level convention, not enforced in the data.
- **Fill-up / entry**: used interchangeably in v0 since entries are
  fuel-only.

---

## 4. Architecture (high-level)

- **SPA** built with React + Vite + TypeScript + Tailwind. Static
  deployment to Firebase Hosting.
- **Auth**: Firebase Auth, Google OAuth provider only.
- **Database**: Cloud Firestore. One-shot reads only; no
  `onSnapshot` listeners. (Justification: only one person fills a
  car at a time, so the schema does not require synchronization. See
  §1.2 non-goals.)
- **No backend code**: no Cloud Functions, no Cloud Run, no API
  layer. All logic is client-side; security rules enforce access.
- **Two environments**: separate GCP projects `flog-dev` and
  `flog-prod`. Each has its own Firestore, OAuth client, Hosting
  site, and authorized-domains list. Runtime config switches by
  build-time env var (`VITE_FIREBASE_PROJECT` or similar).
- **Hosting URLs**: `flog-dev.web.app` and `flog-prod.web.app`. No
  custom domain.

ARCHITECTURE.md is drafted post-M1 once infra concretes; this
section is the elevator pitch.

---

## 5. Data model

### 5.1 User (`users/{uid}`)

| field | type | required | notes |
|---|---|---|---|
| `uid` | string | yes | Firebase Auth UID; doc id |
| `email` | string | yes | canonical lowercase; mirrored from auth token for lookup |
| `displayName` | string | yes | from Google profile |
| `createdAt` | timestamp | yes | server-set on first sign-in |

Lifecycle: created on first successful sign-in (allowlist-gated).
Not destroyed in v0 (account delete deferred).

### 5.2 Car (`cars/{carId}`)

| field | type | required | notes |
|---|---|---|---|
| `id` | string | yes | auto-generated doc id |
| `name` | string | yes | free-text label, e.g. "Minivan" |
| `ownerUid` | string | yes | creator; immutable post-create |
| `shareeEmails` | array&lt;string&gt; | yes (may be empty) | additional authorized loggers; canonical lowercase |
| `createdAt` | timestamp | yes | server-set |

Relationships: 1 User → many Cars (owned); N Users → many Cars
(shared via `shareeEmails`).

Lifecycle: created by any signed-in (allowlisted) user. Renamed and
deleted by owner only. Sharing is denormalized on the Car doc
itself (no separate `permissions` collection); fine at family scale,
revisit if shares-per-car pushes into the tens.

### 5.3 Entry (`cars/{carId}/entries/{entryId}`)

| field | type | required | notes |
|---|---|---|---|
| `id` | string | yes | auto-generated doc id |
| `loggedByUid` | string | yes | who created this entry |
| `odometer` | integer | yes | miles |
| `gallons` | number | yes | float |
| `cost` | number | yes | float; USD assumed in v0; field is unitless |
| `loggedAt` | timestamp | yes | server-set on submit; not user-editable |

Lifecycle (amended 2026-05-29, edit-delete-entries dispatch): the
three numeric fields (`odometer`, `gallons`, `cost`) are editable and
an entry can be deleted, from the per-car entries table. Edit is a
destructive overwrite — no audit trail / edit history. `loggedAt`
remains server-set and **not** user-editable (preserves MPG-ordering
integrity and the AGENTS "loggedAt always serverTimestamp" guardrail);
date-editing is a deferred follow-up if demand surfaces. The original
v0 stance was append-only (no edit, no delete; deferred to Soon).

### 5.4 Allowlist (`allowlist/{email}`)

| field | type | required | notes |
|---|---|---|---|
| (doc existence is the signal — no fields) | — | — | doc id is canonical lowercase email |

Lifecycle: created as a side effect when a Car's `shareeEmails`
gains a new email. **Not removed on un-share.** Un-sharing strips
the car from the sharee's car list but leaves their allowlist
membership intact — they retain app access on their own data
(cars they own, cars still shared to them). Explicit revocation of
app access is a separate capability (user-admin / blacklist UI),
tracked in BACKLOG → Later. The bootstrap admin gets allowlist
access via a Firestore rules carve-out
(`request.auth.token.email == ADMIN_EMAIL`) rather than via a doc,
so the cold-start case works.

---

## 6. Access control

One row = one rule. The Firestore rules file will be a near-direct
translation.

Helper: `allowed(email)` ≡ `email == ADMIN_EMAIL ||
exists(/databases/$(db)/documents/allowlist/$(email))`.

### 6.1 User

| op | who | rule |
|---|---|---|
| read | self only | `request.auth.uid == userId` |
| create | self on first sign-in | `request.auth.uid == userId && allowed(request.auth.token.email)` |
| update | self | `request.auth.uid == userId` (limited to `displayName`) |
| delete | none in v0 | (deferred) |

### 6.2 Car

"Update" on a Car doc means modifying the car's own metadata
(rename, add/remove sharee). `ownerUid` is immutable post-create
(§5.2); `createdAt` is server-set. So in practice owner-update
protects `name` and `shareeEmails` — those are the only mutable
fields. Editing a fuel record is a different operation entirely
and lives under Entry (§6.3), which is `none in v0`.

| op | who | rule |
|---|---|---|
| read | owner OR sharee | `resource.data.ownerUid == request.auth.uid \|\| request.auth.token.email in resource.data.shareeEmails` |
| create | any allowlisted user | `allowed(request.auth.token.email) && request.resource.data.ownerUid == request.auth.uid` |
| update (rename, share/unshare) | owner only | `resource.data.ownerUid == request.auth.uid && request.resource.data.ownerUid == resource.data.ownerUid` |
| delete | owner only | `resource.data.ownerUid == request.auth.uid` |

Note on delete: Firestore does not cascade deletes. The app code
that owns "delete car" must also delete the `entries` subcollection
(batched if large). Captured as an implementation note for the M3
brief, not a PRD-level concern.

### 6.3 Entry

| op | who | rule |
|---|---|---|
| read | parent Car readers | inherit from Car read rule |
| create | parent Car readers | `canRead(parentCar) && request.resource.data.loggedByUid == request.auth.uid` |
| update | parent Car owner OR original logger (with read access) | `canMutate() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['odometer','gallons','cost'])` — only the three numeric fields mutable; `loggedByUid`/`loggedAt` immutable |
| delete | parent Car owner OR original logger (with read access) | `canMutate()` |

**Note on the delete rule** (amended 2026-05-28 during M4): the
original v1 PRD specified `delete = none in v0 (deferred to Soon)` on
the same posture as edit-entry: per-entry mutation is a post-v0
capability. M3 Decision #6 pinned cascade-delete-on-car-delete to M4
because Firestore does not cascade and §6.2's `delete car` rule must
have a code-level companion that removes the entries subcollection
first. That companion (`src/cars/cars.ts` `deleteCar` →
`deleteEntriesForCar` → `deleteDoc(car)`) needs the entries delete
rule to be open to the *parent car owner*. At M4 time, sharees could
not delete entries, and individual-entry edit/delete by any user was
still a post-v0 BACKLOG → Soon item. The rule reused the
`parentCar()` helper already in scope inside the entries `match`
block so its shape matched the existing read/create gates.

**Follow-on (amended 2026-05-29, edit-delete-entries dispatch):** the
"Edit / delete entries" item shipped. The entries `update` rule moved
from `if false` to owner-or-logger with a
`hasOnly(['odometer','gallons','cost'])` field restriction, and the
`delete` rule broadened from owner-only to owner-or-logger. The
shared `canMutate()` helper — defined alongside `parentCar()` /
`canReadParent()` in the entries `match` block — encodes the access
model: the **parent-car owner may edit/delete any entry**, and the
**original logger may edit/delete their own** entry while they still
have read access (`canReadParent()` closes the unshared-former-sharee
hole). Edit is a destructive overwrite (no audit trail); `loggedByUid`
and `loggedAt` are immutable on update (the `hasOnly` guard). This
supersedes the "remains a post-v0 item" wording above — the prior
paragraph is retained for the M4 cascade history.

### 6.4 Allowlist

| op | who | rule |
|---|---|---|
| read | any allowlisted user | `allowed(request.auth.token.email)` |
| create | any allowlisted user | `allowed(request.auth.token.email)` |
| delete | bootstrap admin only in v0 | manual cleanup; can be expanded to "last-sharing-car owner" later |

**Note on the read rule** (amended 2026-05-28 during M3 V2): the
original v1 PRD specified `read = self only` (`request.auth.token.email
== email`) on the assumption that "is this email allowlisted?" was
sensitive enough to keep private. M3's share flow (Decision #16 in
`dispatch/M3-cars.md`) needs to pre-read the *target* email's
allowlist doc to decide whether to include an allowlist `set` in the
batched share-write — M2's `allow update: if false` on allowlist
means a blind `setDoc` would deny if the doc pre-existed (e.g., the
email was already shared to another car), failing the whole batch.
Loosening read to "any allowlisted user" enables the pre-read; the
privacy cost at family scale is negligible because allowlist docs are
empty `{}` and the only signal is "is this email in the set," which
allowlisted users can also learn out-of-band.

The create rule's `who` column is reworded to match the rule it
always shipped (M2 R4: `allow create: if allowed(request.auth.token.email)`).
The bootstrap admin satisfies `allowed(...)` via the `email ==
ADMIN_EMAIL` carve-out in the helper, so the rule covers both
"admin bootstrap" and "car-share side effect" paths without needing
to enumerate them.

---

## 7. User flows

### Flow A: First sign-in (bootstrap admin)

**Goal**: the project owner gets in for the first time, ready to add
a car.

1. Visit `flog-prod.web.app` (or `flog-dev.web.app`).
2. Sign in with Google.
3. App detects no User doc; creates `users/{uid}` (rules permit
   because email matches `ADMIN_EMAIL` carve-out).
4. Land on empty-state home: "Add your first car."

**Acceptance**: `users/{uid}` doc exists; landing renders empty
cars list with an "Add car" affordance.

### Flow B: First sign-in (invited user)

**Goal**: a family member signs in for the first time after the
owner shared a car with them.

1. Visit the same URL.
2. Sign in with Google.
3. App checks `/allowlist/{their-email}` — exists (the share wrote
   it).
4. App creates `users/{uid}` doc.
5. Landing page renders the shared car in their list.

**Acceptance**: their `users/{uid}` exists; the car appears; they
can tap it and reach the log form.

### Flow C: Log a fill-up

**Goal**: log a fuel fill-up at the pump in the fewest clicks
possible.

1. Open app on phone (Firebase Auth session persists; no re-sign).
2. Landing is the log form. Car picker preselected to most-
   recently-used car **for this user** (cars are sticky to drivers
   in non-fleet use; this isn't a shared-pool model); if none yet,
   defaults to first car in the list.
3. Enter odometer (numeric keypad), gallons (numeric keypad), cost
   (numeric keypad).
4. Tap **Save**.
5. App writes Entry; toast "Saved"; resets form, same car
   preselected.

**Acceptance**: three numeric inputs + zero-or-one car-picker tap +
one save. Form fits one mobile screen without scrolling.

**Edge case**: odometer is less than this car's prior odometer.
Submit succeeds; warning toast: "Odometer went down from {prior}.
Saved anyway."

### Flow D: Add a car

**Goal**: any user adds a car they will own.

1. From home / car list, tap **Add car**.
2. Type the car's name.
3. Tap **Create**.
4. Car appears in user's list; owner = current user; no sharees
   yet.

**Acceptance**: new Car doc; `ownerUid` is the current user;
immediately selectable in the log form.

### Flow E: Share a car

**Goal**: owner shares a car with another user by email.

1. From the car's detail view, tap **Share**.
2. Type the other user's email.
3. Tap **Add**.
4. App writes (batched / transactional):
   - `cars/{carId}.shareeEmails` += new email
   - `allowlist/{email}` (empty doc, created if not exists)
5. Confirmation: "{Email} can now log fill-ups for this car."

**Acceptance**: both writes succeed atomically. The invitee's next
sign-in puts the car in their list (Flow B).

### Flow F: View per-car MPG

**Goal**: see how a car is doing on gas.

1. From home / car list, tap a car.
2. Per-car detail view renders:
   - Car name (and rename / delete / share controls if owner)
   - Sharing list (and add/remove controls if owner)
   - "Last fill-up MPG: 32.4"
   - "Lifetime avg MPG: 31.1"
   - List of entries (date, odometer, gallons, cost, computed MPG
     for that fill)

**Acceptance**: page renders within 1 Car read + 1 Entries query.
Latest 50 entries shown; lifetime avg computed client-side from the
fetched set. (Tripwire in §8.)

---

## 8. Cost control

Free-tier target. Concretely, per-action Firestore activity:

| action | reads | writes |
|---|---|---|
| Home (car list) | 2 queries (owner + sharee, parallel; <10 docs each) | 0 |
| Per-car detail | 1 Car doc + 1 Entries query (all entries on car) | 0 |
| Log a fill-up | 1 (latest-entry for monotonicity check) | 1 (the Entry) |
| Add a car | 0 | 1 (the Car) |
| Share a car | 1 (existence check on allowlist) | 2 (Car update + Allowlist) |

**Note on the "Home (car list)" row** (amended 2026-05-28 during
M4): the v1 PRD said "1 query." The Car schema's split between
`ownerUid` (single scalar) and `shareeEmails` (array) makes a single
combined Firestore query impossible without denormalisation; M3
actually ships two parallel `where()` queries (one on each field),
deduped client-side. The v1 wording was directional ("one
fetch-shaped action") rather than literal. Total read volume is
unchanged at family scale — still <20 docs per home view, well under
the daily free-tier ceiling.

**Note on the "Log a fill-up" row** (amended 2026-05-28 during M4):
the v1 PRD said "0 reads" because §8 was sketched before PRD §7
Flow C's odometer-monotonicity edge case got its design treatment.
The Flow C save sequence requires reading the latest entry on the
selected car to compare odometers (flag-but-accept, never block);
M4's `entries.getLatestEntry` issues that single-doc fetch. Per-
save cost is now 1 read + 1 write; family-scale projection of
~125–150 fill-ups/year still leaves multiple orders of magnitude of
free-tier headroom.

**Note on the "Per-car detail" row** (amended 2026-05-28 during M5):
the original v1 spec capped this at "latest 50" entries. Owner
decision during M5 design: drop the cap. At family scale (~30
entries per car per year), fetching all entries per detail-page view
is well within the free-tier read budget for the foreseeable future.
The aggregate-doc tripwire (BACKLOG → Later) remains the next
defense line if scale forces it. Skipping the arbitrary cap also
keeps the lifetime MPG number honest (avg-over-all-entries, not
avg-over-latest-50 which would silently drift as old entries aged
out of the window). Note that the literal billed-read count is
roughly **2× the entry count** under the current entries-read rule
shape (each entry doc triggers a `get(parentCar)` rule eval which
Firestore bills as a read); the BACKLOG → Later "Verify rules
`get()` caching semantics" item resolves whether Firestore caches
identical `get()` paths within a single query's rule evaluation
pass. Either way, at family scale this stays orders of magnitude
below tripwire.

Family-of-4 scale, ~2–3 fill-ups/week **total across the fleet**
(not per-car) → ~125–150 entries/year. Reads stay well within the
50,000/day free-tier ceiling with several orders of magnitude of
headroom.

Note on scaling shape: fill-ups scale with **active drivers**, not
with cars. A family with 4 cars and 1 active driver generates
roughly the same write volume as a family with 1 car and 1 active
driver, because the limiting factor is "someone goes to the pump."
Useful when reasoning about whether usage growth signals a real
shift (more households) versus more cars in the same household.

**Tripwires** (manual monitoring via Firebase console; no automated
alerting in v0):

- Monthly Firestore reads > 100,000 → investigate; likely an N+1
  read or usage growth past family scope.
- Entries-per-car causes per-Flow-F page-mount read counts to
  exceed ~200 (entries doc reads + entry-rule `parentCar()` get
  evaluations) → switch to a cached `cars/{carId}/aggregate` doc
  updated on entry write. Defer until it matters.

**Note on the "Entries-per-car" tripwire** (amended 2026-05-28
during M5 closure): originally tied to a "approaches 50 ceiling
on Flow F" threshold because Flow F's query was capped at 50
entries. The M5 amendment to the "Per-car detail" row above
dropped that cap (now "all entries on car"), so the trigger
is reframed to a soft per-page-mount read-count budget instead
of an entries-count ceiling. ~200 reads-per-mount is a
generous family-scale headroom (current expectation: ~30
entries × ~2 billed reads = ~60 reads-per-mount; tripwire
fires at >3× that). The mitigation (cached aggregate doc)
is unchanged.

---

## 9. UI requirements

- **Mobile-first**, optimized for one-handed at the pump. Tap
  targets ≥44pt. Numeric keypads on numeric fields (`inputmode` /
  `type="number"`).
- **Desktop works** but is not the design center; mobile layout at
  desktop widths is acceptable for v0.
- **Browser support**: current versions of Safari iOS, Chrome
  Android, plus desktop Chrome / Safari / Firefox. No IE, no legacy
  Edge, no browsers >2 years out of date.
- **Performance**: form interaction should feel instant. First load
  on 4G under 3s to interactive. Vite tree-shake defaults suffice;
  no perf-budget tooling in v0.
- **Accessibility**: no explicit WCAG (Web Content Accessibility
  Guidelines) commitment in v0. Form inputs have labels; buttons
  have accessible names. Revisit when a real accessibility need
  surfaces.
- **No decorative graphics, no custom illustrations, no logo.**
  Tailwind defaults; pick a primary accent color during M2.
- **Dark mode**: deferred. BACKLOG.

---

## 10. v0 Milestones

| # | Milestone | Goal | Acceptance | Depends on |
|---|---|---|---|---|
| M1 | Infrastructure | GCP+Firebase dev & prod projects, OAuth, Hosting, deploy scripts. Ops-only dispatch; sibling-project nautilus reviews before execution. | Both projects exist; OAuth consent configured; both Hosting URLs serve a placeholder; `npm run deploy:{dev,prod}` works. | — |
| M2 | Auth + allowlist + first-sign-in | App skeleton, sign-in-with-Google, allowlist enforcement, empty-state home, bootstrap-admin carve-out working. | Bootstrap admin can sign in cold; non-allowlisted user is rejected gracefully; `users/{uid}` doc auto-creates on first sign-in. | M1 |
| M3 | Cars (CRUD + share) | Create / rename / delete own cars; share-by-email (writes allowlist atomically); un-share; list view. | All car ops work; a freshly-shared user can sign in and see the car. | M2 |
| M4 | Entries (log fill-up) | Mobile-first log form, append-only, server timestamp, odometer-monotonicity flag-but-accept. | Family can switch from Google Form to flog without losing capture function. | M3 |
| M5 | Per-car detail + MPG | Tap a car → entries list + last-fill MPG + lifetime avg MPG. | Per-car view renders in 1+1 Firestore reads; MPG numbers match a hand-computed reference. | M4 |

Post-M5: v0 ships. BACKLOG.md takes over.

---

## 11. Risks & open questions

### 11.1 Risks

- **Firebase free-tier ToS changes** could raise hosting cost at any
  time. Low probability; no contractual protection. Mitigation: be
  prepared to move to a paid Firebase tier (~$25/mo) or migrate
  stacks. Not a v0 problem.
- **Google OAuth consent friction.** Google occasionally requires
  re-verification, brand-verification (logo triggers it), etc. The
  sibling-project nautilus has rake-stepped this; M1 ops dispatch
  leans on that.
- **Family adoption friction.** Switching from a familiar form has
  a non-zero learning cost. Mitigation: M4's UX target is "fewer
  clicks than the form."

### 11.2 Open questions (not blocking v0)

- **Edit semantics — RESOLVED (2026-05-29, edit-delete-entries
  dispatch).** Who can edit: the **parent-car owner** (any entry on
  their car) **or the original logger** (`loggedByUid`), the latter
  only while they retain car read access. Edit is a **destructive
  overwrite — no audit trail / edit history** (YAGNI at family
  scale). Only the three numeric fields (`odometer`, `gallons`,
  `cost`) are editable; **`loggedAt` is not user-editable** in this
  pass (stays server-set; date-editing deferred as a follow-up if
  demand surfaces, since it would need a date picker, MPG re-pairing
  on reorder, and an AGENTS/PRD guardrail amendment). See §5.3
  lifecycle and §6.3 for the shipped rules.
- **Optional note field.** If M4's implementer finds free vertical
  room on the target device, an optional `note` string can sneak in
  without violating the single-screen rule. Otherwise skip; revisit
  in maintenance phase when notes earn their place.

---

## 12. Implementation guidance for coding agents

- Read **§5 (data model)** and **§6 (access control)** before
  writing any data-access code or Firestore rules. Both are
  load-bearing for v0's primary commitments.
- The **cost spec in §8** is non-negotiable. If a change would add
  an N+1 read or new per-page query, surface it in the brief;
  nautilus decides whether to accept.
- **Open questions in §11.2 are NOT to be guessed at** — stop-and-
  ask per WORKING-MODEL.md.
- See `AGENTS.md` for codebase-level guardrails (drafted after this
  PRD).

---

## 13. Sustainability philosophy

### 13.1 Cost posture

Free-forever target. Firebase free tier covers family-of-4 usage
with multiple orders of magnitude of headroom. If usage grows past
family scope, revisit assumptions before adding paid infrastructure
— growth itself is a signal worth thinking about, not just funding.

No behavioral tracking. No analytics. No third-party scripts beyond
Google Identity for OAuth. This rules out certain monetization
paths; that's intentional.

### 13.2 Revenue posture

None in v0. None planned. Free forever is the default unless usage
forces revisit.

### 13.3 Triggers to revisit sustainability

- Monthly Firestore reads exceed 100,000 (approaching free-tier
  ceiling).
- User base grows past Austin's family and starts to include
  external households.
- Google changes free-tier terms or OAuth requirements in a way
  that adds real per-user cost.

---

End of PRD v1.
