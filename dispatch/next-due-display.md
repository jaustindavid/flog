# Next-reminder-due display (car-detail + Cars list)

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

**Status**: draft — pending pre-read (Cars-list fetch approach + the
projection math) before implementer dispatch.

---

## 1. Context

Maintenance Phase 3 shipped a per-car service reminder + a due/overdue
**banner on the log screen** (fires only once already due). This adds a
**forward-looking "next due" projection** on two surfaces:

- **(a) Car-detail Maintenance section** — absolute: "Next oil change:
  9,001 mi or by 2026-08-31".
- **(b) Each car row on the Cars list (`CarListItem`)** — relative
  countdown in the existing whitespace beside the name + share count:
  "next maintenance in 1,200 mi / 45 days" (or "overdue by …" if past).

It's the soft "upcoming" view PRD §14.3 deferred. Owner request
2026-05-31. **No rules / no schema change** — purely compute and
display, plus (on the Cars list) reading data the list doesn't load yet.

The projection reuses Phase-3 machinery: the **derived baseline** (the
latest maintenance entry with `resetsReminder == true`), the reminder
**intervals**, and **`addMonths`** (the clamping date helper).

---

## 2. Required reading

1. `src/maintenance/computeReminder.ts` + `.test.ts` — finds the
   baseline + computes due/overdue. You EXTEND it (or add a tightly-
   related sibling) to also expose the projection (§5.1). Its
   `addMonths` import is the date arithmetic.
2. `src/maintenance/addMonths.ts` — clamping month add (local, tested).
3. `src/screens/CarDetailScreen.tsx` — surface (a). It already loads
   `entriesState` (fuel → current odometer) + the Phase-1 maintenance
   state, and renders the Maintenance section + reminder config.
4. `src/components/CarListItem.tsx` + `src/screens/CarListScreen.tsx` —
   surface (b). Note CarListItem currently shows name + share count and
   does NOT load any per-car maintenance/fuel. Note how `useCars`
   feeds the list (each item has its `Car`, incl. `maintenanceReminder`).
5. `src/maintenance/useMaintenance.ts` + `src/entries/useEntries.ts` —
   the per-car fetch hooks (each a one-shot `getDocs`); the Cars-list
   rows will use these. Note the `carId`-tagged ready state (added in
   the banner-flash fix) — relevant if staleness is a concern (it isn't
   here; see §5.3).
6. `src/maintenance/computeSpend.ts` — the pure-fn + injected-`now`
   template (mirror its discipline: NO `new Date()` inside the pure fn).
7. `AGENTS.md` — no `any`, pure fns unit-tested, no new deps.

---

## 3. Scope

### In scope

- **`computeReminder.ts`** — extend to also return the projection:
  `dueOdometer`, `dueDate`, `milesRemaining`, `daysRemaining` (see
  §5.1). The banner (Phase 3) keeps using the existing fields; the new
  fields are additive. Extend `computeReminder.test.ts`.
- **Car-detail (surface a)** — in the Maintenance section, render the
  absolute next-due when a reminder is configured + has a baseline.
  Reuses the already-loaded maintenance + entries state.
- **`NextDueLine.tsx` (new) for surface b** — a small component that
  takes a `carId` + `reminder`, fetches that car's maintenance + fuel
  (`useMaintenance` + `useEntries`), computes via `computeReminder`,
  and renders the relative countdown. Mounted by `CarListItem` ONLY
  when `car.maintenanceReminder != null` (see §5.3 — this avoids
  conditional hooks AND avoids fetching for no-reminder cars).
- **`CarListItem.tsx`** — render `<NextDueLine>` in the whitespace when
  the car has a reminder; otherwise unchanged.

### Out of scope

- The Phase-3 banner / log screen (unchanged).
- Distance-per-window (separate, shipping in parallel).
- Any rules / schema / write path. Reminder config editing (Phase 3).
- Multi-reminder per car (one only).

---

## 4. Decisions (locked / for pre-read)

1. **Extend `computeReminder`** to also return the projection fields,
   rather than a separate fn — one computation feeds both the banner
   and the projection, no duplicated baseline-finding. *(Pre-read:
   confirm this is cleaner than a sibling `computeNextDue`.)*
2. **Cars-list data via a `NextDueLine` child component** that does its
   own fetch, mounted only for cars with a reminder (§5.3). *(Pre-read:
   vet this vs a batched fetch in `CarListScreen`. Lean: per-row is
   simplest + elegant at family scale; owner: "fetches cheap.")*
3. **Two formats**: car-detail = absolute thresholds ("at 9,001 mi or
   by Aug 31, 2026"); Cars list = relative countdown ("in 1,200 mi /
   45 days", "overdue by …" if past). Show both dimensions when both
   intervals are set; one when only one. Whichever-comes-first is
   communicated by showing both remaining values (don't try to unify
   miles + days into one "soonest").
4. **`computeReminder` stays pure** — inject `now` + `currentOdometer`
   (max fuel odometer), never read the clock inside.
5. **States**: no reminder → render nothing (line not mounted on the
   list; omitted on car-detail). Reminder but no baseline → car-detail
   shows "Log a [label] to start"; list shows nothing. Baseline → the
   projection.

---

## 5. Architecture sketch

### 5.1 `computeReminder` extension

Add to `ReminderStatus` (additive — the banner ignores the new fields):

```ts
dueOdometer: number | null;    // baseline.odometer + intervalMiles
dueDate: Date | null;          // addMonths(baseline.date, intervalMonths)
milesRemaining: number | null; // dueOdometer - currentOdometer
                               //   (negative = overdue by)
daysRemaining: number | null;  // local-calendar-day diff (S3),
                               //   negative = overdue by
```

- Compute from the SAME baseline already found. `dueOdometer`/`dueDate`
  are null when the corresponding interval is unset (or baseline.date
  is null for dueDate). `milesRemaining` null when `dueOdometer` or
  `currentOdometer` is null; `daysRemaining` null when `dueDate` null.
- The existing `active`/`due`/`overdueMiles`/`overdueDays`/`label` stay.
  (`overdueMiles` ≈ `-milesRemaining` when overdue; keep both — the
  banner reads the existing ones, the projection reads the new ones.)
- Unit-test the projection: both-intervals, miles-only, months-only,
  not-yet-due (positive remaining), overdue (negative remaining),
  null-odometer (miles projection null, date projection still works),
  no-baseline (all null, active false).
- **S3 (DST-safe `daysRemaining`) — pre-read catch.** Do NOT compute it
  as `floor((dueDate - now) / 86_400_000)`: that truncates a day when a
  DST transition falls inside the window (the existing `overdueDays`
  floor escapes this only because it's an always-≥0 sub-day wobble).
  Instead compute the **local-calendar-day difference**: floor BOTH
  `now` and `dueDate` to local midnight (LOCAL getters, never UTC —
  same discipline as `dateField`/`addMonths`), then divide. DST-immune.
  **Require a test spanning a DST boundary** under the pinned
  `TZ=America/New_York`.
- **S4 (the exactly-due =0 boundary).** At due, `milesRemaining == 0` /
  `daysRemaining == 0`. The formatters (both surfaces) must mirror the
  banner (`ReminderBanner` treats 0-overage as "due"): `<= 0` → "due /
  overdue" copy, `> 0` → a countdown — never "in 0 mi". Add an
  exact-zero boundary test.

### 5.2 Surface (a) — car-detail

In the Maintenance section (near the reminder config), when
`status.active`:

- Format absolute: `Next [label]: {dueOdometer} mi or by {dueDate}` —
  show only the dimension(s) that exist (drop "or by …" if no
  `dueDate`; drop the mileage clause if no `dueOdometer`). Format the
  date readably (e.g. `Aug 31, 2026`) via LOCAL getters (consistent
  with `dateField` — never `toISOString`).
- If overdue, read naturally: e.g. `[label] overdue by N mi / N days`
  (or keep the absolute "was due at …" — implementer's tasteful call;
  owner tunes at V2).
- Reminder set but no baseline → "Log a [label] to start the reminder."

### 5.3 Surface (b) — Cars list, the `NextDueLine` pattern

```tsx
// CarListItem.tsx — render only when a reminder exists, so the hooks
// inside NextDueLine are never called for a no-reminder car (the
// component simply isn't mounted) — clean, no conditional hooks, no
// wasted fetch.
{car.maintenanceReminder && (
  <NextDueLine carId={car.id} reminder={car.maintenanceReminder} />
)}
```

`NextDueLine`:

- `const { state: maint } = useMaintenance(carId);`
  `const { state: entries } = useEntries(carId);`
- Render nothing until BOTH are `'ready'` (a per-row loading state —
  don't flash). An error or loading status ALSO renders nothing — a
  failed fetch on a soft countdown line should be invisible, not an
  error message (N3). Each row's `carId` is FIXED (never changes for a
  mounted row), so there is NO stale-data concern like the log screen's
  car-switch banner — a plain `status === 'ready'` gate suffices (the
  `carId` tags are irrelevant here).
- `currentOdometer = entries.length > 0 ? Math.max(...entries.map(
  (e) => e.odometer)) : null` — reuse the exact LogFillupScreen idiom;
  `Math.max()` of an empty array is `-Infinity`, so the guard matters
  (N4).
- `const s = computeReminder(maint.maintenance, reminder,
  currentOdometer, new Date());` — render nothing if `!s.active`.
- Render the relative countdown: "next maintenance in {milesRemaining}
  mi / {daysRemaining} days"; if `s.overdue`, "maintenance overdue by
  {|milesRemaining|} mi / {|daysRemaining|} days". Show only the
  dimension(s) present. Quiet, small text in the row's whitespace.

**Cost + lifecycle (pre-read S1/S2).** N×2 one-shot `getDocs`, only for
cars with a reminder — fine at family scale (owner: "fetches cheap").
Two pins:

- **S1 — no re-fetch churn.** The fetch is one-shot on MOUNT. Render
  `<NextDueLine>` as a direct, stably-positioned child of `CarListItem`
  (which already carries a stable `key={car.id}` in `CarListScreen`);
  do NOT wrap it in a component whose identity varies, and give it no
  unstable `key`. React then preserves the instance across `useCars`
  refreshes (e.g. after add/share/delete) → no re-mount, no re-fetch.
  A careless wrapper would turn "N×2 once" into "N×2 on every list
  mutation."
- **S2 — accepted staleness.** With the persistent cache, a row's
  `getDocs` may resolve from IndexedDB and won't re-read until the row
  re-mounts (the list has no per-row refresh). So a countdown may show
  pre-fill data briefly after you log on the detail screen, until you
  navigate back. ACCEPTED — the list countdown is advisory; the
  detail screen is authoritative. Do NOT build a sync; just note it in
  the handoff.

---

## 6. Files in play

```text
src/maintenance/computeReminder.ts      (extend) + .test.ts
src/components/NextDueLine.tsx           (new)
src/components/CarListItem.tsx           (mount NextDueLine)
src/screens/CarDetailScreen.tsx          (absolute next-due in Maint section)
```

Handoff at `dispatch/next-due-display-handoff.md`.

## 7. Files NOT to touch

- `addMonths.ts` (import only), the Phase-3 banner / `ReminderBanner` /
  `LogFillupScreen`, the maintenance write paths, `computeSpend` /
  `SpendReport`, `firestore.rules`, schema.

---

## 8. Acceptance criteria

- **C (compute)**: `computeReminder` returns correct `dueOdometer` /
  `dueDate` / `milesRemaining` / `daysRemaining` across both-intervals /
  one-interval / not-due / overdue / null-odometer / no-baseline; the
  existing banner fields are unchanged (Phase-3 tests still pass).
- **T (tests)**: projection cases above, incl. a `daysRemaining` value
  under the pinned non-UTC `TZ`. Existing `computeReminder` tests green.
- **U (UI)**: car-detail shows the absolute next-due (or the
  no-baseline hint) for a car with a reminder; the Cars list shows the
  relative countdown per car with a reminder, nothing for cars without;
  a row renders nothing until its data loads (no flash); overdue reads
  "overdue by …".
- **L (gates)**: `lint`, `lint:md`, `test`, `test:rules`, `build:dev`,
  `build:prod` all exit 0.
- **V2 (owner)**: a car with a due-soon reminder shows a sensible
  countdown on both the list and detail; an overdue car reads "overdue
  by …"; a no-reminder car shows nothing extra on the list.

## 9. Stop-and-ask

- If the pre-read prefers a batched Cars-list fetch over per-row
  `NextDueLine`, or a sibling `computeNextDue` over extending
  `computeReminder` — fold that before implementing.
- If extending `computeReminder` risks the Phase-3 banner in any
  non-obvious way (it shouldn't — additive fields), STOP and surface.

## 10. Model note

Likely **Sonnet** once the pre-read blesses the `NextDueLine` fetch
pattern + the projection math: it's a pure-fn extension (reusing the
verified Phase-3 baseline/`addMonths`) + two presentational surfaces,
no security/rules. The only judgment is the Cars-list data approach —
hence the pre-read. Bump to Opus only if the pre-read finds real risk.
