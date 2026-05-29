# Runbook: create a new GCP + Firebase environment

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

Reusable runbook for spinning up a new flog environment (or any
similar Firebase-backed SPA). Captures the actual current
(2026-05-25) UI paths AND the load-bearing requirements that
survive UI drift. **The UIs will drift again. Follow the
requirements; the breadcrumbs are dated.**

---

## When to use this

- Adding a staging tier between dev and prod
- Replacing a compromised project (security incident, accidental
  deletion, custom-domain migration)
- Onboarding a new contributor with their own personal dev project
- Bootstrapping a sibling project from scratch

For the *first* env (the one flog already has), this overlaps with
M1's brief. After M1 ships, this runbook is the canonical
how-to-do-it-again.

---

## Pre-flight

Confirm before starting:

- `gcloud` CLI installed and authenticated as the right Google
  account
- `firebase` CLI installed (`npm install -g firebase-tools`),
  logged in (`firebase login`)
- Node.js ≥ 20, npm ≥ 10
- You have the project's repo open locally; you've already created
  any required local files (e.g., `M1-g-outputs.md` for capturing
  Firebase config values)

Decide upfront:

- What's the desired Project ID? (e.g., `flog-staging`,
  `myproject-dev-ad`). Include a namespace prefix (your initials,
  org name) — bare generic IDs like `flog-prod` are usually taken
  globally.
- What's the environment label? (`development` / `production` /
  `staging`)
- What URL will it serve at? (Firebase auto-assigns
  `<project-id>.web.app`)

---

## Phase 1 — Console setup (owner-driven)

There's no agent help available for these steps — privileged GCP
Console access is owner-only.

### 1. Create the GCP project

**Requirement**: project exists with a clean, memorable Project ID
on the chosen Google account, no billing attached.

**Current UI** (2026-05-25): <https://console.cloud.google.com/projectcreate>

- **Project name** field: free-text, can be anything (display label)
- **Project ID** field: ⚠️ **MUST manually edit** — click "Edit"
  next to the auto-filled value, **delete the entire auto-filled
  value including any suffix that's already there**, and type your
  desired ID
- Form must say "✓ Available" inline before you click Create. If
  it says "in use" or shows a red error, the ID is globally taken —
  try a more-specific namespace
- Organization: as appropriate for your account (personal = none)
- Billing account: **none** unless you specifically need Blaze tier

**🪤 RAKE — auto-suffix**: if you don't manually edit the
Project ID field, GCP appends a 6-digit suffix to guarantee
global uniqueness. **IDs are immutable; the suffix is permanent
and cascades into every URL and config**. flog hit this twice
(`flog-dev-497401` and `flog-prod-497401`) before learning to
always edit explicitly.

### 2. Add Firebase to the project

**Requirement**: Firebase recognizes the GCP project; no analytics.

**Current UI**: <https://console.firebase.google.com/> → **Add
project** → **Add Firebase to a Google Cloud project** → pick the
new GCP project

- Accept Firebase terms
- **Google Analytics: OFF** (PRD §1.4 no-analytics commitment)
- Click **Add Firebase**

### 3. Configure OAuth consent screen

**Requirements** (load-bearing, survive UI drift):

- User type: **External**
- Publishing status: **Testing** (NOT Published)
- App logo: **none uploaded** (uploading triggers brand
  verification — a separate, slow, fussy process)
- Support email: a Google-managed mailbox (Gmail or Workspace
  identity; **forwarding aliases are rejected here**)
- Developer contact: alias OK (e.g., `flog@yourdomain.com`)
- Scopes: default only (email, profile, openid); add nothing
- Test users: include every Gmail that needs to sign in. Up to
  100 in Testing mode; family-scale fits easily.

**Current UI** (2026-05-25): APIs & Services → **OAuth Consent
Screen** → Overview tab → **Get Started** → wizard (condensed:
name+contact → audience → contact info → policy → finish). **Test
users** are under the **Audience** tab/section (not a separate
wizard step). Old separate "Scopes" screen is gone/collapsed.

**🪤 RAKE — Branding screen**: the OAuth Consent Authorized
Domains list (used at step 5b) is under the **Branding** sub-screen
within OAuth Consent. Not obvious from the wizard flow.

### 4. Enable Google sign-in

**Requirement**: Google is enabled as a sign-in provider; support
email matches the OAuth consent contact.

**Current UI**: Firebase Console → **Security → Authentication →
Get started → Sign-in method tab → Google → Enable**

(Previously: Build → Authentication; reorganized 2026-05-25.)

### 5. Add authorized domains — THREE separate lists

**Requirement**: all three lists below must contain the project's
domains. Missing any one breaks sign-in silently. The
`/__/auth/handler` suffix on redirect URIs is the most-common
silent-killer omission.

#### 5a — Firebase Auth Authorized Domains

**Current UI**: Firebase Console → Security → Authentication →
**Settings tab → Authorized domains**

Required entries (Firebase usually pre-populates; verify all three):

- `localhost`
- `<project-id>.firebaseapp.com`
- `<project-id>.web.app`

#### 5b — GCP OAuth Consent Authorized Domains

**Current UI** (2026-05-25): APIs & Services → OAuth Consent Screen
→ **Branding** sub-screen → **Authorized domains**

**🪤 RAKE — tightened validation**: as of 2026-05-25 GCP rejects:

- Apex domains (`web.app`, `firebaseapp.com`) — too broad
- `localhost` — requires TLD

Required entries (the actual project-prefixed FQDNs):

- `<project-id>.web.app`
- `<project-id>.firebaseapp.com`

#### 5c — OAuth Client (Web client) JS Origins + Redirect URIs

**Current UI** (2026-05-25): OAuth Consent Screen → **Clients**
tab → click the auto-created Web client (Firebase made it during
step 4). (Previously surfaced via APIs & Services → Credentials.)

**Authorized JavaScript origins** (three entries):

- `http://localhost:5173` (or whatever your Vite dev port is)
- `https://<project-id>.web.app`
- `https://<project-id>.firebaseapp.com`

**Authorized redirect URIs** (three entries — **include the
`/__/auth/handler` suffix on every one**):

- `http://localhost:5173/__/auth/handler`
- `https://<project-id>.web.app/__/auth/handler`
- `https://<project-id>.firebaseapp.com/__/auth/handler`

### 6. Create Firestore database

**Requirement**: production-mode (not test-mode), deny-all default
rules, multi-region location matching your users.

**Current UI** (2026-05-25): Firebase Console → **Databases →
Firestore → Create database**. (Previously: Build → Firestore.)

- Mode: **production** (not "test mode" — test mode opens reads
  to everyone for 30 days, which inherits as a bad baseline)
- Location: `nam5` (US multi-region) for US-based users; pick
  appropriately for other regions
- Default rules: deny-all (leave as-is; deploy real rules from
  your project's `firestore.rules` later)

### 7. Initialize Hosting

**Requirement**: Hosting dashboard shows the site URLs as live;
NO files created in your local project tree from this step.

**Current UI** (2026-05-25): Firebase Console → **Hosting &
Serverless → Hosting → Get started**. (Previously: Build →
Hosting.)

- Click through the wizard. **Do NOT run any suggested CLI
  commands** (`firebase init`, `firebase deploy`, etc.) — they're
  optional and easy to mis-answer. Hand-author config files
  separately.
- Click **Continue to console** at the end.
- Verify in Firebase Console that the Hosting dashboard now lists
  `<project-id>.web.app` and `<project-id>.firebaseapp.com`.

### 8. Register a Web app and capture config

**Requirement**: you have the Firebase config object + OAuth Web
Client ID saved locally (gitignored) so the code can pick them up.

**Current UI**: Firebase Console → gear icon → **Project settings
→ General tab → Your apps → Web icon (`</>`)**

- App nickname: e.g., `myproject (env)` — display label only
- **Do NOT check** "Also set up Firebase Hosting for this app"
  (it walks you back into the CLI flow you declined at step 7)
- Click **Register app**
- Copy the entire `firebaseConfig` object (note: omit
  `measurementId` when you wire it into the app — see PRD §1.4
  no-analytics)
- Click **Continue to console**

Also capture the **OAuth Web Client ID** from the Clients tab
(step 5c location). Format:
`NNNNNNNNNNNN-XXXXXXX.apps.googleusercontent.com`

**Append both** to your local `dispatch/M1-g-outputs.md` (or
equivalent gitignored capture file):

```text
## <project-id>
- Project ID: <project-id>
- Firebase config object:
const firebaseConfig = { ... pasted ... }
- OAuth Web Client ID: ...
```

---

## Phase 2 — Code-side wiring

### Create env file

Path: `.env.{development|production|staging}` at the project root.

Format (substitute values from the captured config):

```text
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=<project-id>.web.app
VITE_FIREBASE_PROJECT_ID=<project-id>
VITE_FIREBASE_STORAGE_BUCKET=<project-id>.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

**Deliberately omit `measurementId`** — Firebase emits it but we
don't initialize Google Analytics (PRD §1.4, AGENTS.md).

**🪤 RAKE — `authDomain` must be the hosting domain, not
`firebaseapp.com`**: Firebase Console hands you a config with
`authDomain: <project-id>.firebaseapp.com` (its reserved auth-
handler subdomain). On Chrome with storage partitioning (rolled
out 2024–2025), this is broken: the cross-origin iframe handshake
between `firebaseapp.com` (where Firebase Auth stores OAuth
tokens) and `<project-id>.web.app` (where your SPA reads them)
fails silently. `getRedirectResult` resolves null, users appear
signed-out even though the OAuth round-trip succeeded. **Set
`authDomain` to your hosting domain** (`<project-id>.web.app`)
instead — both Firebase Hosting domains serve `/__/auth/handler`
identically, so the auth handler works either way, but using the
hosting domain keeps everything same-origin and dodges Chrome's
partitioning. flog hit this at M2 V2 (full narrative in
`dispatch/M2-auth-allowlist-handoff.md` Post-ship findings §1).

Verify the env file is gitignored (`.gitignore` should have
`.env.*` or explicit entries).

### Update `.firebaserc`

Open `.firebaserc` at project root. Confirm the new env's alias
maps to the actual Project ID (not a placeholder):

```json
{
  "projects": {
    "default": "flog-dev-497401",
    "dev": "flog-dev-497401",
    "prod": "flog-prod-497401",
    "staging": "flog-staging-NNNNNN"
  }
}
```

If you accepted an auto-suffixed Project ID, the alias value
must include the suffix (e.g., `flog-prod-497401`, not
`flog-prod`).

### Deploy

```sh
npm run deploy:<env>   # e.g., :dev, :prod, :staging
```

(The script should chain `build:<env> && firebase use <env> &&
firebase deploy --only hosting`. Verify it does.)

---

## Phase 3 — Verification

### Shell loads

```sh
curl -s https://<project-id>.web.app | head -15
```

Expected: HTML shell with the project's `<title>`, Vite-built JS
asset reference (different hash per build), CSS asset reference.

### Browser renders

Open `https://<project-id>.web.app/` in a browser. Confirm:

- Page renders (not blank, no error in DevTools console)
- Environment label shows correct env (e.g., `production`)
- Project ID shown matches expected value
- No analytics scripts in DevTools network tab (per PRD §1.4)

### Firebase Console health

- No billing prompts / Blaze upgrade nags on the project
- Hosting dashboard shows the latest deploy timestamp
- Authentication panel shows Google enabled
- Firestore panel shows the deny-all default rules

### Sign-in (once auth code lands)

After M2 ships (or whichever dispatch wires up auth), test:

- Visit the env URL
- Click sign-in
- Authenticate with a test-user Gmail
- App lands signed-in (no "unverified app" warning beyond the
  Testing-mode advisory)

---

## Known rakes (catalogue from M1)

All encountered during flog M1 execution; all should appear here
on first read, not be discovered through a second M1 episode.

- **GCP auto-suffix on Project ID** — must manually edit ID field;
  delete auto-fill; type explicitly. IDs are immutable.
- **Three authorized-domains lists** — all required, missing any
  one breaks sign-in silently.
- **`/__/auth/handler` suffix on redirect URIs** — silent killer
  if omitted from the OAuth Client's redirect URI list (5c).
- **OAuth Consent Authorized Domains rejects apex + `localhost`**
  (2026-05-25). Use project-prefixed FQDNs only.
- **Logo upload triggers brand verification** — defer until
  Published mode is needed.
- **Test users live under Audience** in the condensed OAuth Consent
  wizard.
- **Firebase Auth moved to Security** (formerly Build).
- **Firestore moved to Databases** (formerly Build).
- **Hosting moved to Hosting & Serverless** (formerly Build).
- **Spark vs Blaze** — Spark suffices at family scale; never
  accept a billing prompt during initial setup. If Firebase
  demands Blaze for any service you're configuring at M1, you're
  configuring the wrong service.
- **`firebase init` interactive prompts** — easy to mis-answer
  (esp. "use existing project" and "single-page app"). Hand-author
  `.firebaserc` and `firebase.json` directly.
- **`measurementId` is emitted by Firebase config** but must be
  omitted from app code (no-analytics commitment).
- **UI drift is constant** — describe requirements not click
  paths in any new runbook/brief you write.

Auth-wiring rakes (added during flog M2, 2026-05-28):

- **Default `authDomain` is broken on Chrome** — see Phase 2 env
  file section. Set `authDomain` to `<project-id>.web.app`, not
  the Firebase-Console-emitted `<project-id>.firebaseapp.com`.
- **`GoogleAuthProvider` without `prompt: 'select_account'`** —
  Google silently re-auths the active account; users can't switch
  accounts from inside the app, and the rejection-recovery flow
  loops. Always set
  `googleProvider.setCustomParameters({ prompt: 'select_account' })`
  on the provider singleton at construction time.
- **Don't swallow `getRedirectResult` rejections.** The default
  "swallow because onAuthStateChanged will surface it" pattern is
  wrong when the rejection itself prevents auth state from
  establishing. Always `console.error` redirect-result failures
  in production. Cheap; reveals silent bootstrap failures on the
  first reproduction instead of after a diagnostic cycle.

---

## What this runbook does NOT cover (future runbooks)

These are deliberately scoped out; each warrants its own runbook
when triggered:

- **Custom domain migration** — Cloudflare DNS + Firebase Hosting
  domain mapping + OAuth domain-list updates + redirect URI
  reconfiguration. Multiple rakes per the kit's cross-nautilus
  consultation pattern.
- **Promoting from Testing to Published** — logo upload triggers
  brand verification; privacy policy URL required; "External +
  Published" raises the test-user cap to ∞ but adds friction.
- **Adding additional sign-in providers** (Apple, Facebook, etc.)
  — see BACKLOG → Auth / identity. Apple's "Hide my email" relay
  breaks email-as-identity; needs an architectural shift.
- **Decommissioning a project** — GCP soft-delete is 30 days; ID
  remains reserved.

---

End of runbook.
