# flog — Product Requirements Document (v1)

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

**Status (updated 2026-05-31):** v0 has shipped; flog is in continuous
post-v0 development. This is a living document — §1 describes current
reality, §10 is the frozen v0 build log, and `BACKLOG.md` is the live
working list.

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
delivers that same capture loop with a small step up in usefulness
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

Each item below is a current product boundary — a deliberate "no"
that still holds post-v0 (not a v0-only snapshot). Future BACKLOG
items that would violate one get a ⚠️ flag pointing back here.

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
- **No third-party integrations** (Carfax, OBD-II, fuel cards, etc.).
- **No CI/CD gating.** Manual `npm run deploy:dev` and `npm run
  deploy:prod` is the promotion model. Matches the sibling
  project's posture; revisit when complexity earns it.
- **No analytics, no behavioral tracking, no third-party scripts**
  beyond Google Identity for OAuth.

### 1.3 Future-phase / deferred

The live working list is `BACKLOG.md`. Notable deferrals identified
at PRD time that remain open:

- CSV export of your data; account deletion (committed-to in §1.4)
- Admin allowlist UI (separate from the share-with-user side effect)
- Dark mode

### 1.4 Philosophical commitments

- **Your data is yours.** Export (CSV) and account-delete (purge
  your User doc + Entries you authored + un-share you from others'
  cars) are committed-to. They haven't shipped yet, but the data model
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
- **Database**: Cloud Firestore. One-shot reads (`getDocs`); no
  `onSnapshot` listeners (only one person fills a car at a time, so the
  schema needs no synchronization — see §1.2). Offline persistence is
  on (`persistentLocalCache` + multi-tab manager): reads serve from
  IndexedDB and writes queue + sync when connectivity returns.
- **No backend code**: no Cloud Functions, no Cloud Run, no API
  layer. All logic is client-side; security rules enforce access.
- **Two environments**: separate GCP projects `flog-dev` and
  `flog-prod`. Each has its own Firestore, OAuth client, Hosting
  site, and authorized-domains list. Runtime config switches by
  build-time env (`.env.development` / `.env.production`).
- **Hosting URLs**: prod is the custom domain
  **`flog.austindavid.com`** (Firebase Hosting + Cloudflare DNS); dev is
  `flog-dev.web.app`. (The old `flog-prod.web.app` still resolves, but
  the custom domain is canonical — sign-in is pinned to its authDomain.)

ARCHITECTURE.md is not yet drafted; this section plus `AGENTS.md` are
the working architecture reference.

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
| `maintenanceReminder` | map or null | no | reminder config; `null` when unset, else `{ label, intervalMiles, intervalMonths }` with ≥1 interval non-null. The "last done" baseline is DERIVED (§14.3), not stored here. Full maintenance model: §5.5 |

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

### 5.5 Maintenance (`cars/{carId}/maintenance/{maintId}`)

A subcollection sibling to Entry (§5.3), kept **separate** so fuel
`entries` stay a pure MPG stream (rationale: §14 intro). One doc per
logged service.

| field | type | required | notes |
|---|---|---|---|
| `id` | string | yes | auto doc id |
| `loggedByUid` | string | yes | who created it |
| `date` | timestamp | yes | when the service happened; **user-set and editable** (unlike fuel `loggedAt` — backdating a real service date is expected). The reminder time-baseline (§14.3) and spend bucketing (§14.4) use this. |
| `odometer` | integer | yes | miles at service; required (powers the mileage reminder). Future nicety: auto-fill from a recent fuel fill-up. |
| `cost` | number | yes | float; unitless (USD assumed, as elsewhere) |
| `note` | string | yes | freeform "what happened" — replaces any category taxonomy; carries the entry's meaning |
| `resetsReminder` | boolean | yes | did this service reset the car's reminder (the input-screen checkbox; default `false`). The latest `resetsReminder == true` entry is the DERIVED reminder baseline (§14.3). |
| `loggedAt` | timestamp | yes | server-set on submit; not user-editable (audit) |

Lifecycle: full CRUD by the parent car's owner-or-current-sharee
(§6.5). `date` is backdatable; `loggedByUid` / `loggedAt` are
immutable. The car-delete cascade (§6.2 note) also removes this
subcollection. Reminder config lives on the Car doc
(`maintenanceReminder`, §5.2), never here.

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
protects `name`, `shareeEmails`, and `maintenanceReminder` (the
reminder config, §6.5) — those are the mutable fields. Editing a fuel
record is a different operation entirely and lives under Entry (§6.3).

| op | who | rule |
|---|---|---|
| read | owner OR sharee | `resource.data.ownerUid == request.auth.uid \|\| request.auth.token.email in resource.data.shareeEmails` |
| create | any allowlisted user | `allowed(request.auth.token.email) && request.resource.data.ownerUid == request.auth.uid` |
| update (rename, share/unshare, reminder config) | owner only | `resource.data.ownerUid == request.auth.uid && request.resource.data.ownerUid == resource.data.ownerUid`; `hasOnly` allow-set is `name`/`shareeEmails`/`maintenanceReminder` (§6.5) |
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

### 6.5 Maintenance

The maintenance subcollection (§5.5) mirrors Entry (§6.3): read /
create / update / delete gate on the parent car's
owner-or-current-sharee via the shared `canReadParent()` /
`canMutate()` helpers (lifted to `cars/{carId}` scope so entries and
maintenance share them).

| op | who | rule |
|---|---|---|
| read | parent Car readers | inherit from Car read rule (`canReadParent()`) |
| create | parent Car readers | `canReadParent() && request.resource.data.loggedByUid == request.auth.uid` + field validation (below) |
| update | parent Car owner OR original logger | `canMutate() && diff().affectedKeys().hasOnly(['date','odometer','cost','note','resetsReminder'])` — `loggedByUid` / `loggedAt` immutable |
| delete | parent Car owner OR original logger | `canMutate()` |

Field validation (P1 style, on create): `hasOnly` pins the field set;
`odometer` / `cost` numeric + range; `note` a string; `resetsReminder`
a bool; `loggedAt == request.time`; **`date` is any timestamp — NOT
pinned to `request.time`, because backdating a real service date is
allowed** (the one deliberate divergence from the fuel-entry
server-timestamp rule). Numeric ranges use `is number`, never `is int`
(the JS SDK double-encodes whole numbers).

The Car update rule (§6.2) extends its `hasOnly` allow-set to include
`maintenanceReminder` (owner-only), with shape validation on the
reminder map: `label` a string; `intervalMiles` / `intervalMonths`
each `is number` or absent; at least one interval present.

---

## 7. User flows

### Flow A: First sign-in (bootstrap admin)

**Goal**: the project owner gets in for the first time, ready to add
a car.

1. Visit `flog.austindavid.com` (prod) or `flog-dev.web.app` (dev).
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
   defaults to first car in the list. Re-tapping the already-selected
   chip navigates to that car's detail page.
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

**Stats panel (below the form).** Under the capture form the log
screen renders a read-only per-car panel that cross-fades in as the
car's entries load: last-fill and lifetime-average MPG (the MPG tile),
plus an **expected-range band**, **P95 MPG**, **longest tank** (max
plausible odometer delta, gap-excluded), and **largest fill** (max
gallons). All computed client-side from the fetched entries (§8
budget); the percentile-based range and P95 need 5+ fills (a "need 5+
fills" hint shows until then). Read-only — never blocks capture.

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
   - Maintenance section: "Log maintenance" button, service history,
     the 3×3 spend report (§14.4), reminder config, and the next-due
     projection (§14.3) — logging steps in Flow G

**Acceptance**: page renders within 1 Car read + 1 Entries query.
Latest 50 entries shown; lifetime avg computed client-side from the
fetched set. (Tripwire in §8.)

### Flow G: Log maintenance

**Goal**: record a service (and optionally reset the reminder clock).

1. On the car-detail screen (maintenance's home, §14.5), tap "Log
   maintenance" → a modal opens (consistent with Add-car / Edit-entry).
2. Fill date (backdatable), odometer, cost, note. If the car has a
   reminder configured, an "↺ Reset [label]" checkbox is shown
   (default OFF); checking it writes `resetsReminder = true`, making
   this the new derived baseline (§14.3).
3. Save → writes a `maintenance` doc (§5.5, §6.5). The history list,
   spend report (§14.4), and next-due projection (§14.3) update.

**Acceptance**: a sharee or owner can log; `date` is user-set,
`loggedAt` server-set; reset re-baselines the reminder.

### Flow H: Service-reminder banner

**Goal**: be reminded a service is due while logging fuel.

1. On the fuel screen, if the selected car has a reminder configured
   AND it is due/overdue, a banner appears (the only maintenance
   element on the fuel screen, §14.5).
2. Tap the banner → opens the maintenance modal (Flow G) in create
   mode, so the user logs the service that resets the clock.

**Acceptance**: banner shows only when configured + baseline + due;
mechanics in §14.3. No push (in-app only).

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
- **Minimal visual chrome — no decorative graphics, no custom
  illustrations.** Tailwind defaults with a blue primary accent; a
  favicon set + PWA app icon ship (`public/`).
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

Post-M5: ✅ v0 shipped (2026-05). `BACKLOG.md` is the live working
list; the table above is frozen as the v0 build record.

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

flog is built under the **cuttlefish / nautilus** model: a long-context
**nautilus** (the architect session) coordinates short-context
**cuttlefish** (focused dispatched agents) that do the actual building.
The conceptual frame is [`CUTTLEFISH-NAUTILUS.md`](CUTTLEFISH-NAUTILUS.md)
(the *why*); the day-to-day operational playbook is
[`WORKING-MODEL.md`](WORKING-MODEL.md) (the *how*). Read those for the
full picture — this section is the PRD-side orientation and defers
operational detail to them.

### 12.1 How a change flows

Phases, loosely ordered — loops are normal (a pre-read can re-open
design; the owner can push back and restart):

1. **Research** (anything novel) — survey prior art / the problem space
   before committing to a shape. E.g., the maintenance phase was
   preceded by a consumer-app survey (§14 intro).
2. **Design conversation** — owner ←→ nautilus. Settled decisions are
   captured in the **BACKLOG entry** (not just chat); the entry accretes
   until it is most of the brief.
3. **Brief** — the nautilus writes a self-contained dispatch brief
   (`dispatch/<name>.md`) for a cuttlefish with NO conversation history:
   required reading, ACs, scope in/out, stop-and-ask, gates.
4. **Pre-read** — a reviewer cuttlefish reads the brief + supporting
   code cold and reports blockers / should-fixes BEFORE any code is
   written (every M+ dispatch, usually S too — it has caught a real
   issue on essentially every run). The nautilus folds the findings.
5. **Implementation** — an implementer cuttlefish runs the brief
   end-to-end. Model tier fits the risk: **Sonnet** for mechanical /
   low-risk work, **Opus** for security, Firestore rules, or data-model
   surfaces.
6. **Gates** — all must pass before handoff: `npm run lint`, `lint:md`,
   `test` (under the pinned `TZ`), `test:rules`, `build:dev`,
   `build:prod`.
7. **Handoff** — the cuttlefish writes `dispatch/<name>-handoff.md`
   (shape per [`HANDOFF-TEMPLATE.md`](HANDOFF-TEMPLATE.md)) and moves the
   BACKLOG item to Done.
8. **Owner review (V2) + commit** — the owner validates hands-on and is
   the only actor that commits. **Agents never commit.**

### 12.2 Load-bearing checks (standing pre-flight)

- Read **§5 (data model)** and **§6 (access control)** before writing
  any data-access code or Firestore rules — both are load-bearing for
  flog's primary commitments, and rules translate row-for-row from §6.
- The **cost spec in §8** is non-negotiable. A change that adds an N+1
  read or a new per-page query must be surfaced in the brief; the
  nautilus decides whether to accept.
- **Open questions in §11.2 are NOT to be guessed at** — stop and ask
  (every brief carries an explicit stop-and-ask list).
- See [`AGENTS.md`](AGENTS.md) for codebase-level guardrails (no `any`,
  pure functions unit-tested, `is number` not `is int`, local-date
  discipline, no new deps without sign-off).

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

## 14. Maintenance phase (shipped 2026-05-31 — design locked 2026-05-29)

A post-v0 phase extending flog from fuel-only to fuel **and**
maintenance. Settled in a 2026-05-29 design conversation informed by a
survey of consumer maintenance apps (Drivvo, Simply Auto, AUTOsist,
Fuelio, CarExpenses, CarScope, CARFAX). Three sub-features, shippable
in order: (1) maintenance logging, (2) spend reporting, (3) service
reminders. The ethos holds: it must not slow the 10-second fuel
capture, and reminders are a byproduct of logging — no push, no chore.

**Status: all three phases shipped 2026-05-31**, plus two follow-on
refinements the same day — distance-per-window on the spend report
(§14.4) and a forward-looking next-due display (§14.3, §14.5). The
sections below describe the as-built behavior.

**Load-bearing decision — a SEPARATE collection, not a typed unified
entry.** Maintenance lives in its own subcollection; fuel `entries`
stays the pure MPG stream. Rationale: it protects the MPG/stat
pipeline, the P1 entry-validation rules, and the gap-detection logic
(all of which assume `entries` are full fuel fill-ups); a typed-unified
stream would force `gallons` optional again, conditionalize the rules
by type, and risk a single missed `type` filter silently corrupting
the stats — the exact failure class hardened against on 2026-05-29. The
legacy Google Form's one-row shape was a form constraint, not a
data-model ideal (and the history import already skipped its
blank-gallons maintenance rows). Display MAY still merge both into one
timeline — a UI concern, decoupled from storage.

### 14.1 Data model

**Folded into the core data model (§5).** The Maintenance subcollection
(`cars/{carId}/maintenance/{maintId}`) is §5.5; the Car
`maintenanceReminder` config field is in the §5.2 table. (Earlier
drafts kept the maintenance schema here; it moved to §5 once the
feature shipped, so the canonical data model lives in one place.)

### 14.2 Access control

**Folded into the core access-control model (§6).** Maintenance
subcollection rules (read / create / update / delete + field
validation, including the backdatable-`date` divergence) are §6.5; the
Car `maintenanceReminder` update rule is in §6.2.

### 14.3 Reminders (mechanics)

One reminder per car. The baseline is **derived**, not stored: the
maintenance entry with `resetsReminder == true` and the latest `date`
(tiebreak `odometer`) is the "last done." Next due:

- **mileage**: `lastDone.odometer + intervalMiles`, vs the current
  odometer = the latest fuel entry's `odometer`.
- **time**: `lastDone.date + intervalMonths`, vs today.

Due fires on **whichever comes first**. Worked example: oil changed at
6,001 mi today, interval 3,000 mi / 3 months → due at the first fuel
reading ≥ 9,001 mi OR the first date ≥ +3 months. No reminder
configured, or no `resetsReminder` entry yet → no banner.

**Banner**: the log/fuel screen only, for the selected car. As built it
is **binary — due / overdue** (with the overage, e.g. "Oil change
overdue by 400 mi"); the pre-warning "upcoming" state was deferred. **No
push** — flog has no service worker; the banner is in-app, seen on open.
(Push later = service worker + FCM + a server trigger; out of scope, a
known ceiling.)

**Next-due display** (forward-looking, shipped 2026-05-31): the
"upcoming" view the banner omits is delivered instead as a quiet
projection on two surfaces — the car-detail Maintenance section
(absolute: "Next oil change: 9,001 mi or by Aug 31, 2026") and each
Cars-list row (relative countdown: "next oil change in 1,200 mi / 45
days", "overdue by …" when past). Shown only when a reminder is
configured AND a baseline exists; pre-baseline the car-detail surface
prompts "Log a [label] to start." Pure derived display (the same
`computeReminder` baseline + intervals + `addMonths`, extended with
projection fields) — no rules/schema change. Day math is DST-safe
(local-calendar-day diff). The Cars-list rows fetch per-row (N×2
one-shot reads, fine at family scale) and are advisory; the car-detail
screen is authoritative.

**Reset checkbox**: on the maintenance input screen, "↺ Reset [label]"
(default OFF). Checking it writes `resetsReminder = true`; because the
baseline is derived, that entry immediately becomes the new "last
done." Odometer is required on every maintenance entry, so a reset
always carries a mileage baseline.

### 14.4 Spend reporting

Car-detail screen. A 3×3 of summed `cost` — rows **Maintenance / Fuel
/ Total**, columns **This year / Prior year / Lifetime**. Windows are
**calendar years** by the entry date (fuel by `loggedAt`'s date,
maintenance by `date`): This year = Jan 1 → today; **Prior year = the
full previous calendar year — the tax-relevant headline**; Lifetime =
all. Pure client-side aggregation over the two already-fetched
collections (no backend; trivial at family scale). The
maintenance-vs-fuel split is the one distinction that has a job (tax),
and the collection split provides it structurally.

**Distance per window** (added 2026-05-31): the Fuel row also shows the
**miles driven** in each window beneath its cost (a second line, not a
"/", so the compact "4.6k mi" can't wrap mid-unit) — so fuel spend is
contextualized by distance and $/mi falls out. Distance = the sum of
positive per-fill odometer deltas, bucketed by the **same local
calendar year** as the cost so the two align window-for-window. Unlike
"longest tank," gap deltas are **included** (the odometer span is the
truth — you drove those miles). Maintenance + Total rows unchanged.

### 14.5 Placement & interaction

- **The fuel/home screen stays pure** — no standing maintenance
  affordance; identical to today for anyone who never uses
  maintenance. The only maintenance element that can appear is the
  reminder banner (§14.3), shown only when a reminder is configured
  AND due; the banner is **tappable → opens the maintenance form** for
  that car (so the reset checkbox is right there at the pump).
  **Decided 2026-05-31: the banner is the ONLY maintenance reference on
  the fuel screen — no standing "log maintenance" link.** The pump-side
  capture stays single-purpose; deliberate maintenance logging lives on
  car-detail. (The car-chip re-tap affordance — re-tapping the
  already-selected chip navigates to car-detail — is general car
  navigation, not a maintenance-specific link, and does not contradict
  this lock.)
- **The car-detail screen is maintenance's home** — a **"Log
  maintenance"** button sits **above the fuel/entries record**,
  alongside the maintenance history, the 3×3 spend report (§14.4), the
  reminder config, and the next-due projection (§14.3).
- **The Cars list shows a next-due countdown** — each car row, in the
  whitespace beside the name + share count, carries a quiet "next
  [label] in X mi / Y days" line when that car has a reminder with a
  baseline (§14.3). The list is otherwise unchanged for cars without a
  reminder.
- **Two entry points, one form** — the car-detail button (deliberate
  logging) and the tappable banner (reminder-driven "log it now").
- **Form factor** — the maintenance entry form is a **modal**,
  consistent with Add-car / Edit-entry / Share. **Decided 2026-05-31
  after hands-on click-testing: modal stays (not a dedicated route).**

### 14.6 Decisions locked / out of scope

- **Separate** maintenance collection, NOT a typed unified entry
  (§14 intro).
- **Derived** reminder baseline, NOT a denormalized `lastDone` on the
  car — single source of truth, delete-safe (owner 2026-05-29: "risk
  is expensive; prefer a good data model over saving a fetch").
- **No categories.** The only tax-relevant split is
  maintenance-vs-fuel (structural); per-category reporting is unwanted;
  `note` carries "what happened." Revisit only if "how much on tires?"
  is ever actually asked.
- **No push** (no service worker) — in-app banner only.
- **No factory/VIN service schedules** (no backend/VIN decode) —
  intervals are user-set; a small bundled default suggestion is an
  optional nicety.
- **One reminder per car** — multi-reminder is a clean later extension
  (`resetsReminder` becomes a per-reminder selection).
- Cross-car spend aggregates remain a separate BACKLOG item.

### 14.7 Phasing

**All three phases shipped 2026-05-31** (each owner-V2'd and committed),
followed by the §14.3/§14.4 follow-on refinements. The phase plan below
is retained as the historical build order.

Phases 2 and 3 each depend only on Phase 1, not on each other — so
after Phase 1 they're independent and order is flexible. Default order
is 2-before-3 (reporting is cheaper and lower-risk; reminders touch the
fuel screen). Phase 1 alone is shippable but "log without spend view";
1+2 MAY be merged for a more complete first ship — kept separate here
for tighter dispatches.

1. **Logging** — the maintenance collection + rules + a module + the
   log-maintenance modal (fields: date / odometer / cost / note). The
   `resetsReminder` field is written (default `false`) but its checkbox
   does NOT appear yet — there's no reminder to reset. Delivers value
   alone (a real maintenance log).
2. **Reporting** — the 3×3 on car detail. Pure read/aggregate over
   phase-1 data.
3. **Reminders** — the car reminder config + the derived banner on the
   fuel screen + the reset checkbox **added to the maintenance modal**
   (shown only when the car has a reminder configured).

---

End of PRD v1.
