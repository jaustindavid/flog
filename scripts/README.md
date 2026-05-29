# flog — ops scripts

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

One-off operational scripts that live outside the app build. They use
the **Firebase Admin SDK** (service-account credentials), so they
bypass Firestore security rules — handle with care, and always
`--dry-run` first.

---

## `import-history.mjs` — backfill fuel history from a Google-Form CSV

Bulk-imports historical fuel fill-ups from the legacy Google Form's
CSV export into flog's Firestore. Built for the **one-time backfill at
prod cutover** (and rehearsing it on dev) — not a recurring feature.
See `dispatch/runbooks/prod-cutover.md` §5 for the cutover context.

### Prerequisites (all gitignored — never commit)

1. **Service-account key** for the target project. Firebase console →
   Project settings → Service accounts → *Generate new private key*.
   Save as `service-account-dev.json` (or `…-prod.json`) at the repo
   root.
2. **The CSV export** from the Google Form (the raw "Form Responses"
   download).
3. **A car map** — a JSON file mapping each source car name to its
   destination Firestore car **doc ID**. Keep it as a `*.local.json`
   under `scripts/` (gitignored). Example
   (`scripts/car-map.dev.local.json`):

   ```json
   {
     "Seven: 2021 Caterham Seven 360S": "zIuteJQRhmYTEDHeN0jU",
     "Rocket: 1999 MX-5 Miata": "fPfUtIZq0Hbe413bCvUh",
     "Rockette: 2015 MX-5": "zW65GbMfWnO6ORdDwscY"
   }
   ```

   The map keys must match the CSV's `Which Car?` strings **verbatim**.
   Only cars in the map are imported; every other source car is
   skipped. (This is how you carry over some cars and not others — and
   how you disambiguate two cars whose names share a prefix.)

   **Doc IDs are per-environment** — dev car IDs ≠ prod car IDs. Build
   a fresh map for prod from the cars you create during cutover.

### Usage — dry-run first, always

```sh
# 1. DRY RUN — prints what it WOULD write (per-car counts, email→uid
#    resolution + any fallbacks, skip reasons). Writes nothing.
npm run import:history -- --dry-run
#    (equivalently: node scripts/import-history.mjs --dry-run)

# 2. Eyeball the output. Counts match the CSV? Attribution resolved?

# 3. LIVE — commit the writes.
npm run import:history
```

Flags (all optional; defaults shown):

| Flag | Default | Meaning |
|---|---|---|
| `--key` | `service-account-dev.json` | service-account key path (selects the project) |
| `--map` | `scripts/car-map.dev.local.json` | car-name → dest-doc-ID map |
| `--csv` | `Fuel Log - Form Responses 1.csv` | the form export |
| `--admin-email` | `austindavid@gmail.com` | fallback attribution if a logger can't be resolved |
| `--dry-run` | (off) | report only; no writes |

For **prod**, point `--key` and `--map` at the prod key + prod map:

```sh
npm run import:history -- --key service-account-prod.json \
  --map scripts/car-map.prod.local.json --dry-run
```

### What it does (and doesn't)

- **Imports** fuel rows whose car is in the map: `odometer` (int),
  `gallons` (full precision), `cost`, and `loggedAt` = the row's form
  timestamp parsed as **local time** → Firestore `Timestamp`.
- **Attribution**: resolves each row's email → uid via
  `getUserByEmail` (cached). A logger who hasn't signed in to the
  target project yet can't be resolved → falls back to the admin uid
  with a logged ⚠️. For correct attribution, have everyone sign in
  first (see the cutover runbook's ordering).
- **Skips**: maintenance rows (blank gallons — not fuel entries) and
  any row whose car isn't in the map.
- **Idempotent**: deterministic doc IDs (`imp_<loggedAtMillis>_<odometer>`)
  mean a re-run **upserts** the same docs — no duplicates. Safe to
  run twice.
- **No marker field**: imported entries are byte-identical in shape to
  app-created ones (`loggedByUid, odometer, gallons, cost, loggedAt`),
  so the app treats them exactly like any other fill-up.

### Safety

- `--dry-run` first, every time.
- It only *adds* (upserts) entry docs. To undo: delete the car's
  `entries` (Firestore console, or the app's delete), then re-run if
  needed.
- Rehearse on dev before prod — the only differences are the key and
  the map.

### History

First used 2026-05-29 to rehearse on `flog-dev`: 146 fuel entries
across 3 cars (Seven 64, Rocket 56, Rockette 26), two loggers resolved,
zero fallbacks, 157 unmapped rows (both Momzdas) skipped. Verified in
the dev app. Ready for the prod cutover.
