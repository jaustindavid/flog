# Runbook: production cutover + family onboarding + history import

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

The one-time sequence that takes flog from "feature-complete on
`flog-dev`" to "the family is using it on `flog-prod`, with their
Google-Form history backfilled." Companion to
`gcp-firebase-env-setup.md` (which covers the GCP/Firebase project
plumbing this assumes is already done for prod).

**Why a runbook**: the ordering is load-bearing and non-obvious —
cars must exist before you can allowlist anyone (you allowlist by
*sharing* a car), and the history import depends on both the car
doc IDs (created here) and the family's sign-ins (for attribution).
Do the steps out of order and you either can't proceed or you
backfill history attributed to the wrong person.

Emails and Firebase doc IDs are intentionally shown as placeholders
(`<…>`) — this runbook lives in the public repo; real family emails
stay out of it.

---

## The load-bearing dependency chain

Two facts drive the entire order:

1. **You allowlist someone by sharing a car with their email.** There
   is no standalone "add user" action. So **cars must exist before you
   can let the family in.**
2. **A person's Firebase uid exists only after their first sign-in.**
   The history import resolves `email → uid` via the Admin SDK
   (`getUserByEmail`), which only works once they've signed in. So
   **the family must sign in before the import runs** — for *correct
   attribution* (it's a quality gate, not a hard blocker; see §6).

Net order: **deploy → you sign in → create cars → share (allowlist)
→ family signs in → import history → verify.**

---

## 0. Pre-flight — confirm before touching prod

- All dev work shipped + verified (M1–M5, plus the post-v0 log-screen
  / PWA / edit-delete dispatches). ✓ as of 2026-05-29.
- **The history-import script exists and has been proven on dev** —
  see §1 (dev rehearsal). Do not first-run it against prod.
- `.env.production` is populated and its
  `VITE_FIREBASE_AUTH_DOMAIN` is `flog-prod-497401.web.app` (NOT
  `…firebaseapp.com` — the M2 V2 rake; Chrome storage partitioning).
- `/public/` carries the icon set + `manifest.webmanifest`.
- You have, locally (all gitignored): the form-export CSV, a **prod**
  service-account key (`service-account-prod.json` or similar), and
  the family email list.
- `npm run lint && npm test && npm run test:rules && npm run build:prod`
  all green.

---

## 1. Dev rehearsal (do this first — it de-risks everything)

The whole sequence is rehearsable on `flog-dev`, including true
attribution. Run it end-to-end on dev before prod:

1. You're already signed into dev. Create (or reuse) the dev cars you
   intend to carry history into.
2. Share each dev car with the family emails → allowlists them on dev.
3. **Have each family member sign into `flog-dev` once** (this is the
   step the owner can arrange) → their dev uids now exist, so
   attribution resolves fully.
4. Build the **dev** car map (`source CSV name → dev car doc ID`).
5. Run the import script against dev (dev service-account key + dev
   map + CSV).
6. Verify on a Pixel: open each car, confirm the historical fill-ups
   and MPG look right; spot-check a handful of rows against the CSV;
   confirm a non-austin row is attributed to the right person (that
   person can edit their own historical fill).

If dev looks right, prod is the same motions with prod values.

---

## 2. Deploy code + rules to prod

```sh
npm run deploy:prod        # hosting + the built SPA
npm run deploy:rules:prod  # Firestore security rules — DO NOT SKIP
```

**`deploy:rules:prod` is essential and easy to forget.** M4 (entries
cascade-delete) and the edit-delete-entries dispatch both changed
`firestore.rules`; prod must get them or edit/delete/cascade fail (or
worse, the old rules allow the wrong thing). The hosting-only
`deploy:prod` does NOT push rules.

Confirm `https://flog-prod-497401.web.app` serves the app.

---

## 2.5 (optional) Custom domain — done at the 2026-05-29 cutover

flog launched on **`flog.austindavid.com`**, not the `web.app`
URL. If you're doing the same, here's the recipe (and the rakes we
hit). It can run in parallel with onboarding/import on `web.app` —
the cert provisioning takes time, so kick it off early and finish
the auth-config flip once the cert is live.

1. **Firebase console → Hosting → flog-prod → Add custom domain** →
   `flog.austindavid.com` → verify ownership (TXT) → add the A
   records Firebase gives you.
2. **Cloudflare: set those records to "DNS only" (grey cloud), NOT
   proxied (orange).** Proxied = Cloudflare serves its own cert and
   Firebase can't provision → stuck on "pending" forever. Grey-cloud
   keeps Cloudflare out of the TLS path so Firebase's Let's Encrypt
   cert provisions directly. (~minutes to ~24h; usually fast.)
3. Once the domain shows **"connected"** (cert live), flip auth:
   - `.env.production` → `VITE_FIREBASE_AUTH_DOMAIN=flog.austindavid.com`
     — **THE load-bearing step.** If the SPA serves from the custom
     domain but authDomain stays `…web.app`, sign-in loops (the M2
     Chrome storage-partition rake, cross-origin auth iframe).
   - **`npm run deploy:prod`** again (authDomain is build-time).
   - **OAuth client**: add JS origin `https://flog.austindavid.com`
     and redirect URI
     `https://flog.austindavid.com/__/auth/handler` (exact — a typo
     here yields Google "Access blocked: this app's request is
     invalid" = `redirect_uri_mismatch`). Allow ~5 min to propagate.
   - **OAuth consent → Authorized domains**: add `austindavid.com`
     (the registrable apex, not the `flog.` subdomain).
   - **Firebase Auth → Authorized domains**: add
     `flog.austindavid.com`.
4. Test sign-in at `https://flog.austindavid.com` (fresh sign-in;
   new origin). **The `…web.app` URL's sign-in now loops** by
   design (its SPA points at the custom-domain authDomain) — the
   custom domain is canonical; have the family use it.

NOTE: a **logo upload** to the OAuth consent screen triggers Google
brand verification — we did NOT do that (flog's icon is in-app/PWA
only). A custom domain alone in Testing mode does not trigger it.

---

## 3. Verify prod auth config (GCP/Firebase console)

These were set during prod's env setup, but verify before onboarding
— a missing entry breaks sign-in silently:

- **OAuth Client → Authorized redirect URIs** includes
  `https://flog-prod-497401.web.app/__/auth/handler`. (Required
  because `authDomain` is the `web.app` host — M2 V2 rake.)
- **OAuth consent screen**: Testing mode, and every family email
  (yours + each member) is on the **Test users** list (≤100 cap).
  A non-test-user is rejected by Google before flog ever sees them.
- **Firebase Auth → Authorized domains** includes
  `flog-prod-497401.web.app`.

(Full details + the UI paths in `gcp-firebase-env-setup.md` §5.)

### Publishing status: Testing vs Production

flog launched in **Testing**, then flipped to **Production**
2026-05-29. Either is fine; the trade:

- flog uses only **basic scopes** (email/profile/openid) and has
  **NO consent-screen logo**, so **publishing to Production is
  instant — no verification cycle.** (Brand verification is
  triggered by uploading a logo, which we deliberately don't.
  **Do not upload a consent-screen logo** unless you want to opt
  into verification.)
- **Production** drops the test-users-list requirement (flog's own
  allowlist is the real gate) and lifts the 100-user cap.
- **Login persistence is NOT a reason to flip.** Firebase Auth
  keeps its own session (IndexedDB), independent of the Google
  OAuth 7-day refresh-token expiry — sessions persist for
  weeks/months in *both* modes (flog only uses Google for the
  initial handshake). If users get logged out, look at storage
  eviction / explicit sign-out, not the OAuth publishing status.

---

## 4. Bootstrap, cars, and onboarding — in this exact order

1. **You sign in** at the prod URL with the admin Google account
   (the `ADMIN_EMAIL` carve-out lets you in cold, before any
   allowlist exists). Confirm you land on the signed-in app, and
   `users/{your-uid}` appears in the prod Firestore.
2. **Create the cars** (Add car) — the set you're carrying history
   into. Name them as you like. Then, in the Firestore console, note
   each car's **doc ID** — these are the destination keys for the
   import map.
3. **Share each car** with the family emails (car detail → Share).
   Each share writes the allowlist entry that lets that person sign
   in. Confirm `allowlist/<email>` docs appear.
4. **Each family member signs in** once at the prod URL. Confirm each
   lands in the app, sees the car(s) shared with them, and that their
   `users/{uid}` doc exists. *This is what unlocks correct
   attribution in the import.*

Do not proceed to §5 until the people whose history you care about
have signed in (or you accept the §6 fallback for any who haven't).

---

## 5. Import the history

1. **Build the prod car map** — `source "Which Car?" string → prod
   car doc ID` (from §4.2), for each car you're carrying over. Keep
   it in a gitignored local file (e.g. `scripts/car-map.prod.local.json`).
   - Remember the two Momzdas are distinct source strings
     (`Momzda: 2013 Mazda5` vs `Momzda: 2025 Mazda CX-5`); map only
     the ones you want. (The 2013 Mazda5 is intentionally not carried
     over.)
2. Place the **prod** service-account key locally (gitignored).
3. **Canary first**: run the script scoped to **one** car, verify it
   in the app, then run the rest. (Cheaper to undo one car than five.)
4. Run the import (prod project + prod key + prod map + CSV). The
   script will report, per the dispatch spec: rows written per car,
   `email → uid` resolutions (and any fallbacks to your uid), and
   rows skipped (the 6 maintenance rows; any unmapped cars).
5. **Verify**: open each imported car → the historical fill-ups +
   per-car MPG tiles populate; spot-check several rows against the
   CSV (odometer, gallons to 3 dp, cost, date); confirm a non-admin
   logger's rows are attributed to them.

Import safety: it only *adds* entry docs. If a run goes wrong, the
entries can be removed (delete the car's `entries` or use the app's
delete) and re-run. Run dev-first (§1) and canary (§5.3) to avoid
needing this.

---

## 6. Attribution fallback (if a family member hasn't signed in)

`getUserByEmail` fails for anyone not yet in Firebase Auth (i.e.,
who hasn't signed in). The script falls back to **your** uid for
those rows, with a logged warning. Consequence: those rows show as
logged-by-you, and that person can't edit their own history (only
you, as car owner, can). It's recoverable — they can still *see* the
history. So a slow-to-onboard member doesn't block the import; you
choose whether to wait for them or import-with-fallback and move on.

---

## 7. Prod smoke test (post-import V2)

On a Pixel against the prod URL:

- Sign in (admin) → log screen with the MPG tiles; log a fresh
  fill-up → it saves and tiles update.
- Open a car → edit an entry, delete an entry → both work; Firestore
  shows `loggedByUid`/`loggedAt` preserved across an edit.
- Install to home screen → blue flog logo, standalone, blue status
  bar.
- A family member signs in → sees their cars + backfilled history,
  can log + edit their own fills.

---

## 8. Post-cutover bookkeeping

- Update auto-memory + the relevant handoffs: prod is live, family
  onboarded, history imported (row counts).
- The general "CSV import feature" BACKLOG item can be closed/dropped
  — the one-time backfill achieved the goal; there's no recurring
  feature to build (per owner 2026-05-29).
- Keep the prod service-account key and CSV out of the repo
  (gitignored already). Consider deleting the local service-account
  key after cutover if you won't re-import.

---

## Known rakes (carried from prior dispatches)

- **`deploy:rules:prod` is separate from `deploy:prod`** — forgetting
  it ships hosting with stale rules. (§2.)
- **`authDomain` must be the `web.app` host, not `firebaseapp.com`**
  — Chrome storage partitioning breaks the cross-origin auth iframe
  otherwise (M2 V2). `.env.production` is already correct; the rake is
  if anyone "fixes" it back to the Firebase default.
- **Cars before allowlisting** — you can't share (allowlist) a car
  that doesn't exist. (§4.)
- **Sign-in before import** — for attribution only; not a hard
  blocker (§6).
- **Prod car doc IDs ≠ dev car doc IDs** — rebuild the car map for
  prod from the cars created in §4.2; don't reuse the dev map.

---

End of runbook.
