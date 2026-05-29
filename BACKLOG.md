# flog — Working backlog

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

**Single source of truth** for everything deferred. PRD §1.3 points
here for the working list once v0 ships. Each dispatch handoff's
"Items deferred" section feeds this file; items move between
horizons as priorities shift.

While v0 is still in flight, the **v0 roadmap lives in PRD §10**
(milestones M1–M5). This BACKLOG holds only items deferred *out* of
v0. Once v0 ships, the BACKLOG takes over as the canonical working
list and the PRD §10 table becomes historical.

---

## Horizons

- **Next** — actively being considered for the immediate next
  dispatch. Usually 1–3 items, often shaped by recent user feedback.
  Empty is a valid state.
- **Soon** — likely in the near term (weeks). Not committed; can be
  moved out as priorities shift.
- **Later** — captured but no urgency. Gated by triggers, waiting
  for usage feedback, or genuine future-phase structural work.

(No version-number scheduling labels. flog deploys continuously
post-v0; version numbers don't earn their keep as horizons.
Milestone-style boundaries — e.g., "before opening signup beyond
family" — go in an item's note, not as a section header.)

## Size tags

- **XS** — ~10–30 lines. Often skip the dispatch layer; nautilus
  edits directly.
- **S** — ~50–150 lines. Single dispatch; pre-read still cheap.
- **M** — ~200–500 lines. Single dispatch, pre-read recommended.
- **L** — ~500–1500 lines. Single dispatch, pre-read required;
  often warrants a separate design doc first.
- **XL** — >1500 lines OR new architectural pattern. Split into
  multiple dispatches.

## Status conventions

- `[ ]` not started
- `[~]` design captured, implementation not started
- `[›]` in flight (dispatch active)
- `[x]` done (moves to Done section eventually)

**Promotion rule** (per WORKING-MODEL.md §5): items in Next have
their design conversation settled (status `[~]`). Promoting from
Soon → Next without resolving the open questions in the item gets
pushed back by the nautilus. Compressed design conversation at
promotion time is fine; skipping it is not.

---

## Next

(empty — v0 work is tracked via PRD §10. First post-v0 item lands
here when v0 ships.)

---

## Soon

Likely to come up in the first weeks post-v0, in roughly this order
(smallest first, so quick wins land before bigger commitments).

- `[ ]` **Optional `note` field on fuel entries** — XS. Per PRD
  §11.2 + M4 design Q3 (2026-05-28). The legacy Google Form had a
  free-text note column at ~1% usage; we dropped it from the v0
  Entry schema for shape simplicity. If real family usage surfaces
  the need ("I had to write down which pump or trip this was for"),
  add an optional `note: string` field to `cars/{carId}/entries/{eId}`
  and a single-line input under the Cost field on the log form.
  Schema delta is additive; rules unchanged (covered by the existing
  create rule). Trigger: a family member asks for it, OR M5's per-
  car entries view makes us want fill-up context for outliers.

- `[ ]` **CSV export of your data** — S. Committed in PRD §1.4 as
  part of "your data is yours." Per-user: export all entries
  authored by you, plus all entries on cars you own. Open
  questions: format (column order, header naming), scope (owner
  perspective vs sharee perspective), one CSV per car vs combined.
  (Note: the old "implement export first so import consumes its
  shape" coupling is gone — the import need was met by the one-off
  `scripts/import-history.mjs`, not a round-trip feature. Export
  now stands alone, and is low-urgency — no users until well past
  launch.)

- `[~]` **Cars-screen quick-action kebab menu** — S. **Design
  captured 2026-05-29** (UI design memo + owner decisions);
  brief-ready when its turn comes. Came from the post-v0 UI
  pass (A=log-screen restructure shipped, B=PWA polish shipped,
  C=this — deferred behind E per owner). Each `CarListItem`
  gains a ⋯ (kebab) on the right edge; tapping the row body
  still navigates to detail (unchanged); tapping ⋯ opens a
  bottom-sheet with Rename / Share / Delete, reusing the
  existing `RenameCarForm` / `ShareForm` / `ConfirmDialog`.
  Drops the common owner actions from 3 taps to 2. Resolved
  design decisions: (1) **bottom-sheet** menu style (mobile-
  native, reuses existing modal infra) — not a popover;
  (2) ⋯ **hidden for non-owner sharees** (no "leave this car"
  capability exists yet; simplest is hide); (3) **additive** —
  the kebab and the detail screen BOTH retain rename/share/
  delete (detail is not stripped to view-only), so it's a
  shortcut not a move, lower regression risk. Accessibility
  floor: the "Modal focus-trap + ARIA pass" item below applies
  to the new sheet. Low intrinsic value (secondary surface;
  car rename/share/delete happens ~once per car lifetime) —
  hence deferred behind E (edit entries). Likely a Sonnet-
  implementer candidate when briefed (mechanical, reuses
  existing components).

The big backlog. Gated by triggers, waiting on usage feedback to
validate demand, or genuine future-phase structural work.

### Maintenance phase

- `[ ]` **Maintenance entries (type field on Entry)** — M.
  Reintroduce the "fuel vs maintenance" distinction the legacy
  Google Form had, but with first-class data treatment. Adds a
  `type` field to Entry and conditionalises required fields
  accordingly. Opens the door to the next two items. Trigger: enough
  v0 usage to confirm fuel-only is feeling cramped.
- `[ ]` **Maintenance service log fields** — S. What was done, by
  whom, parts cost vs labor cost, notes. Schema design conversation
  needed.
- `[ ]` **Service reminders** — L. "3,000 mi since last oil
  change → flag in the car detail view." Per-car configurable
  intervals; per-make/model defaults a stretch goal. New surface
  area: a reminders/alerts UI. Likely a separate phase, not a
  single dispatch.

### Reports & insights

- `[ ]` **Per-car insight tiles** — S. Max-ever-fuel, best-MPG,
  worst-MPG, longest interval between fills, average cost/mile.
  Computed client-side from the fetched entries. v2-ish.
- `[ ]` **Trends over time** — M. Charts for MPG-over-time,
  cost-over-time, gallons-over-time per car. Needs a charting
  library (chart.js or similar; pick during dispatch).
- `[ ]` **Cross-car aggregates** — M. "Total spent on fuel this
  year across all cars I have access to." Probably gated on the
  user's allowlist of cars; cost shape is one Firestore query per
  car (small for family scale).
- `[ ]` **Show "logged by {name}" per entry — requires nickname
  infrastructure** — S to M. Trigger: a family member asks "who
  logged this fill?" on a shared car. M5 deliberately hid
  `loggedByUid` in the per-row table (Decision #6) because raw
  uids are unreadable and emails are too long for a mobile column.
  Design space to resolve when this item earns priority: (a)
  **per-user nickname** stored on the User doc — one nickname per
  person, shown identically on every car; simpler, but couples
  identity to display name. (b) **per-share nickname** stored on
  the Car doc alongside `shareeEmails` (or a parallel structure) —
  each owner picks a label for each sharee on each car ("Dad,"
  "Mom," "Kid 1"); more flexible, more schema. Pre-condition either
  way: a UI surface for collecting/editing the nickname (settings
  screen vs. inline on the share/unshare flow). Filed during M5
  design discussion 2026-05-28.

### Account / data ownership

- `[ ]` **Account deletion** — M. Committed in PRD §1.4. Purges
  the User doc, all Entries you authored, and removes you from
  every Car's `shareeEmails`. Cars you own become an open question:
  delete cascade vs transfer ownership vs orphan. Resolve in the
  design conversation.
- `[ ]` **User-admin / blacklist UI** — M. Explicit revocation of
  app access — beyond the un-share-leaves-allowlist default
  established in PRD §5.4. Bootstrap admin can remove an email
  from the allowlist outright, denying future sign-in. Pairs with
  an admin-only screen listing all allowlisted emails. Probably the
  same dispatch introduces a proper "admin" role concept beyond
  the single bootstrap email.

### Product surface / ops

- `[ ]` **Logo + favicon + basic branding** — XS to S. Triggers
  Google OAuth brand verification (per Route7 rake), so don't
  ship casually. Probably pairs with custom domain.
- `[ ]` **Privacy page** — XS. Needed before opening signup beyond
  family / trusted invitees. Static markdown page; PRD §13 is most
  of the content.
- `[ ]` **Dark mode** — XS to S. Tailwind makes this cheap. Earn
  it via "I'd actually use this on a phone at night at the pump."

### Auth / identity

- `[ ]` **Multi-provider OAuth (Facebook, Apple, etc.)** — L.
  Currently v0 is Google-only and the allowlist + car-sharing
  model hangs on `email` as canonical identity (PRD §5.1, §6).
  Adding Apple specifically requires reworking identity because
  Apple's "Hide my email" relay produces
  `random@privaterelay.appleid.com` per-app instead of the user's
  real email, breaking the share-by-email flow. Adding Facebook
  requires a Facebook developer app + email-scope handling.
  Both providers have their own brand-verification rakes
  (analogous to Google's). The architectural shift would be:
  invite-by-email captures intent; sign-in produces a Firebase UID
  that gets linked to the invited email via a one-time handshake
  on first sign-in. Non-trivial; gated on "real users start
  asking for non-Google sign-in."

### Infra / DX

- `[ ]` **CI / promotion gating** — M. Right now `npm run
  deploy:{dev,prod}` is manual. GitHub Actions could run gates +
  auto-deploy dev on main + require manual approval for prod. Worth
  it when manual deploys start feeling like risk; not before.
- `[ ]` **Refactor data-fetch hooks to a subscribe-style abstraction**
  — S. **Moved Soon → Later 2026-05-29** after a cost/benefit
  check: with v0 near feature-complete and little future mutation
  expected, the payoff (mostly future-facing — fewer bugs in
  *future* hooks, one shared pattern) is near-negligible, while the
  refactor *adds* risk by touching three working, dev-verified
  hooks (`useCars`, `useCar`, `useEntries`). The
  `eslint-disable-next-line react-hooks/set-state-in-effect`
  suppression each carries is narrow, commented, and correct — a
  fine permanent end-state. The "earned at the third suppression"
  trigger assumed an actively-growing codebase; that premise no
  longer holds. **Revised trigger: only revisit if active feature
  development resumes AND a 4th data-fetch hook appears** — at that
  point a shared `src/lib` query helper (hand-rolled, ~120-180 LOC;
  `useSyncExternalStore` or a tiny custom store; NOT react-query
  per AGENTS) earns its keep. The sharp edge if/when done:
  parameterized per-`carId` store lifecycle (recreate, re-subscribe,
  and refetch on carId change) is the bug-prone spot. Must preserve
  the imperative `refresh()` the screens call after mutations.
- `[ ]` **Aggregate doc for per-car MPG** — S. Cached
  `cars/{carId}/aggregate` updated on entry write, so per-car
  detail view doesn't fetch all entries (M5 shipped without a
  cap) to compute lifetime MPG. Tripwire in PRD §8: per-mount
  read count exceeds ~200 (the M5-amended trigger; current
  expectation ~60 reads-per-mount at family scale).
- `[ ]` **Offline-first capture** — L. PRD §2 non-user posture is
  "assumes connectivity at the pump." If real users hit no-signal
  pumps, revisit with Firestore offline persistence (which is the
  knob to flip; comes with its own gotchas around staleness).
- `[ ]` **Code-split firebase modules / route-level lazy
  imports** — S. Bundle growth path: M1 = 179 KB JS / 54 KB gz;
  M2 = 605 / 156 KB (Firebase Auth + Firestore landed); M3 =
  668 / 176 KB (react-router + cars module). Family scale on
  modern phones probably absorbs this fine, but if mobile
  first-load ever feels slow at the pump there are two
  complementary mitigations: (a) split `firebase/auth` +
  `firestore` behind a route boundary so the sign-in screen
  stays lean; (b) lazy-import `CarDetailScreen` (and M4's log
  form once it lands) so home renders without the detail-screen
  bundle. Surfaced in M2 handoff "Notes for the next dispatch
  brief" and M3 handoff "Items deferred → BACKLOG." Trigger:
  measured first-load > 3s on 4G per PRD §9 perf target.
- `[ ]` **Investigate moderate-severity `npm audit` findings** —
  XS. M1 handoff first flagged 4 moderate findings; M2 added more
  devDeps without a refreshed scan. Run `npm audit`, inspect, fix
  what's safe with `npm audit fix`, surface the rest. Trigger to
  promote: any finding escalates to high/critical, or an exposed
  finding shows up in app code (not just devDeps).
- `[ ]` **Verify rules `get()` caching semantics for entries
  queries** — XS. M2 brief §9 #1 + §7.3 flagged the question:
  does a query of N entries issue 1 or N
  `get(/cars/{carId})` reads from inside the entries rule? If N,
  per-car-detail (M5) costs are higher than PRD §8's budget
  assumes (101 reads vs. 51). Worst case still well under
  free-tier ceiling, but worth confirming before M5 ships. If
  N, mitigation is denormalising a `readableBy` array onto
  Entries OR restructuring the entries-read rule to avoid the
  parent get(). Verify with a counted-reads integration test or
  Firebase Console quota observation while M4 exercises entries.
- `[ ]` **Clearer touch affordance on editable entry rows** — XS.
  The edit-delete-entries dispatch made editable rows in the
  per-car `EntriesTable` tappable, but the affordance leans on
  hover/cursor styling — touch devices (the Pixel family) have no
  hover, so an editable row may not look distinct from a static
  one. Owner hit a transient "can't tap my own row" during V2
  (resolved on reload; chalked up to stale state, not this). If
  discoverability ever confuses a family member, add a visible
  cue on editable rows — a small edit glyph / chevron on the
  right edge. Trigger: a real "I didn't know I could tap that"
  report. Low priority; the owner can tap any row he owns and the
  primary user (owner) sees all rows editable anyway.
- `[ ]` **Modal focus-trap + ARIA pass** — XS to S. M3 modals
  (AddCarModal, ConfirmDialog) ship with the brief §9 #10
  accessibility floor (autofocus + Esc + Cancel) but no focus-
  trap, no ARIA roles, no focus-restore on close. Trigger: a
  real keyboard / screen-reader user reports a trap or
  navigation failure, OR the user base expands past family
  (PRD §9 punts WCAG explicitly for v0). When triggered, sweep
  all modal-style components together; consider a tiny library
  (e.g., `focus-trap-react`) vs. hand-rolled.
- `[ ]` **Revisit colocated unit-test typecheck setup** — XS.
  M2 ended up with `canonicalEmail.test.ts` colocated next to
  its source (per brief §5), which required adding a one-line
  `exclude: ["**/*.test.ts", "**/*.test.tsx"]` to
  `tsconfig.app.json` so `tsc -b` doesn't drag tests into the
  app build. M2 brief had `tsconfig.app.json` as NOT-touch; the
  pre-read missed the conflict. Accepted as Deviation #1 in the
  M2 handoff. Worth a fresh-head look — alternatives include
  moving pure-function tests under `tests/unit/` (loses
  colocation, regains the NOT-touch promise), or formalising the
  exclude as the project convention. Pure DX cleanup; no
  functional impact.

---

## Done

- `[x]` **Custom domain** — done 2026-05-29 as part of the prod
  cutover (pulled forward from Later on the day). `flog-prod` now
  serves at **`https://flog.austindavid.com`** (Firebase Hosting
  custom domain; Cloudflare DNS set grey-cloud / DNS-only so
  Firebase could provision the Let's Encrypt cert). Required the
  authDomain flip (`.env.production` →
  `flog.austindavid.com`) + rebuild, plus OAuth client redirect
  URI / JS origin, OAuth-consent authorized domain `austindavid.com`,
  and Firebase-Auth authorized domain. The full recipe + rakes
  (grey-cloud, authDomain-must-move, redirect_uri_mismatch) are
  folded into `dispatch/runbooks/prod-cutover.md`. The old
  `…web.app` URL still resolves but its sign-in now loops (SPA
  points at the custom-domain authDomain) — custom domain is
  canonical. NOTE: a logo upload would trigger Google OAuth brand
  verification — not done; flog has no uploaded logo on the
  consent screen (the icon is in-app/PWA only). Pairs with the
  still-open "Logo + branding" + "Privacy page" items if you ever
  open signup past trusted invitees.

- `[x]` **CSV import of existing data** — met 2026-05-29, **not as
  the user-facing feature originally imagined.** The real need was a
  one-time backfill of the family's Google-Form history (5 cars in
  the export; 3 carried over), so we built a one-off Admin-SDK
  script (`scripts/import-history.mjs`, docs in `scripts/README.md`)
  instead of an in-app import UI. It dry-run + live-imported 146
  fuel entries to `flog-dev` across Seven/Rocket/Rockette with
  correct per-logger attribution; verified in-app. The script is
  parameterized (key + car-map + CSV) and ready to re-run at prod
  cutover (see `dispatch/runbooks/prod-cutover.md` §5). The
  Admin SDK bypasses rules, so the feared PRD §5.3 `loggedAt`-on-
  create amendment was never needed. No recurring import feature is
  planned — if one's ever wanted, this Done entry + the script are
  the starting point.

- `[x]` **Edit / delete entries** — shipped to `flog-dev`
  2026-05-29 (dispatch `edit-delete-entries`), owner-verified on a
  Pixel. Resolved the PRD §11.2 open questions: owner edits any
  entry on their car, a sharee edits/deletes only entries they
  logged (`canMutate()` in `firestore.rules`); destructive
  overwrite (no audit trail); `loggedAt` NOT editable (only
  odometer/gallons/cost, enforced by `hasOnly` field-immutability
  in the rule). Tap-row-to-edit modal (`EditEntryModal`); delete
  via `ConfirmDialog`. 53 rules tests (all 9 access cases). A V2
  fix-forward corrected gallons precision (was truncating 5.001→
  5.00 on edit). See `dispatch/edit-delete-entries-handoff.md`.

---

## Maintenance

- **When a new dispatch handoff lists "Items deferred"** → also
  append them here (HANDOFF-TEMPLATE §4 reminds the cuttlefish).
- **When a backlog item ships** → move to Done section with a
  short note.
- **When user feedback arrives** → re-rank the Next section;
  promote items from Soon as priorities shift, doing the design
  conversation first.
- **Periodic cleanup** (~quarterly): review Later for items that
  have genuinely aged out and can be dropped.
- **If something obviously XL ends up in Later**, name the
  splitting plan inline ("likely 3 dispatches: A, B, C") so a
  future scope-picking conversation has the breakdown ready.
