# M1 — Infrastructure (ops dispatch)

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

**Status**: ready for execution. Route7 nautilus review folded in
2026-05-24 (see §1 for the review request and §15 for the
forward-feedback channel populated during execution).

---

## 1. Review request for the Route7 nautilus

This is flog's first ops dispatch. Per the paralarva kit's
cross-nautilus consultation pattern, the Route7 nautilus has
rake-stepped Firebase + GCP setup before. Specific items where
Route7's experience should sanity-check this draft:

1. **OAuth consent screen mode for v0.** Plan is **External + Test
   user list** (≤100 users), not Published. Rationale: ≤100 is way
   more than family-of-4 needs, and Testing mode sidesteps brand
   verification, logo requirements, the "Google-managed-only
   support email" rule, and the rest of the publish-flow friction.
   Confirm this avoids the rakes Route7 stepped — or flag if there's
   a reason flog should publish from day 1.

   **Tripwire for revisiting**: if flog ever grows past 100 users
   OR needs strangers to sign up cleanly (no "unverified app"
   warning), the path to Published is well-documented in Route7's
   `dispatch/oauth-publish-ops.md` runbook. Individual steps
   (logo upload triggers verification, custom domain DNS, three
   authorized-domains lists, etc.) are individually light given
   the documented happy path. Captured here so future-flog can
   make the deliberate decision instead of stumbling into it.
2. **The three authorized-domains lists.** Brief enumerates them
   explicitly (Firebase Auth Authorized Domains, GCP OAuth Consent
   Authorized Domains, GCP OAuth Client Authorized JS Origins +
   Redirect URIs). Confirm the list is complete for our default
   `*.web.app` URLs + `localhost` for dev.
3. **`firebase use --add` for multi-project switching** vs.
   separate `.firebaserc` strategies. Currently brief proposes the
   former. Flag if Route7 hit gotchas.
4. **Firestore in production mode with deny-all initial rules**
   (vs. test mode with 30-day open access). Plan is production-mode
   from day 1 so M2 doesn't inherit an "everything open" baseline.
   Confirm this doesn't break any setup steps.
5. **OAuth client email constraints** — the brief instructs the
   developer-contact email be a Google-managed mailbox per
   Route7's known rake. Confirm this is the right interpretation.

If anything else is missing that Route7 has learned the hard way,
add it. The brief revs after this review; only then does Austin
execute.

---

## 2. Context

M1 is the first milestone of v0 (PRD §10). Nothing else can ship
without it. This dispatch establishes:

- Two GCP/Firebase projects (`flog-dev`, `flog-prod`)
- OAuth + Auth wiring on both
- Firestore (locked down; real rules ship in M2)
- Hosting on both (placeholder pages so deploy is provably working)
- Local repo scaffold (Vite + React + TS + Tailwind, Firebase SDK,
  env-switched config)
- Deploy scripts (`npm run deploy:{dev,prod}`)
- Markdownlint config (the project's first enforced gate)

M2 lands sign-in + allowlist + first-sign-in atop this foundation.
M1 deliberately doesn't ship app behavior — its job is to make M2
possible.

---

## 3. Required reading

1. [`../PRD.md`](../PRD.md) — especially §4 (architecture), §6 (a
   peek; we won't write rules yet), §10 (M1 row), §13 (cost
   posture).
2. [`../AGENTS.md`](../AGENTS.md) — all of it. The flog-specific
   guardrails about bootstrap admin email handling apply here.
3. [`../WORKING-MODEL.md`](../WORKING-MODEL.md) — §3 (pre-read
   exception for ops dispatches), §5 (operational conventions),
   §7 (stall recovery).
4. [`../HANDOFF-TEMPLATE.md`](../HANDOFF-TEMPLATE.md) — for the
   handoff doc shape at the end.

---

## 4. Scope

### In scope

- Both GCP projects created and wired up identically (mod project
  IDs and OAuth clients)
- Local repo scaffold runnable with `npm run dev`
- Both Hosting URLs return a deployed placeholder page
- Markdownlint configured and clean across all existing `.md` files
- Firebase emulators (Auth + Firestore) configurable for local dev

### Out of scope (defer)

- Real Firestore security rules (M2)
- Any app behavior beyond a placeholder page (M2 starts this)
- Bootstrap admin email actually being enforced (M2 — rules pass
  this in)
- CI / GitHub Actions (PRD §1.2 non-goal for v0)
- Custom domain (BACKLOG → Later)
- Logo / branding (BACKLOG → Later; gated by Route7 brand-verify
  rake)
- ESLint setup (lands in M2 with the app skeleton)

---

## 5. Execution model

This dispatch has a natural owner/cuttlefish split. **Read carefully
before starting** — the steps are not interchangeable.

| Phase | Executor | Why |
|---|---|---|
| §7 Pre-flight | Owner | Local tooling install |
| §8 ACs G* (GCP Console) | Owner | No agent has privileged GCP access |
| §8 ACs S*, D*, L* (code/scaffold) | Cuttlefish | Bounded, automatable; needs the G* config values as inputs |
| §8 ACs V* (verification) | Owner + cuttlefish | Some owner-only (sign-in test), some scriptable |

Recommended sequence: owner does `G*` for `flog-dev` first;
cuttlefish scaffolds locally and verifies against dev; owner then
does `G*` for `flog-prod`; final `V*` across both.

The cuttlefish brief for `S*`/`D*`/`L*` is **this same document**, with
the cuttlefish reading the G* outputs (Firebase config values) from
a hand-off note the owner leaves in `dispatch/M1-g-outputs.md`
(local-only, gitignored).

**Note on `firebase init`**: this dispatch deliberately does NOT
run `firebase init`. The S7 + S8 steps author `.firebaserc` and
`firebase.json` directly. Rationale: `firebase init`'s interactive
prompts are easy to mis-answer (especially the "use existing
project" and "single-page app" prompts), and the resulting config
is the same as hand-authoring. Skipping init avoids a real
failure mode where a misclick generates the wrong `firebase.json`.

---

## 6. Files in play

All new files in this dispatch. Final layout target:

```text
flog/
├── .firebaserc                        (new, M1)
├── .gitignore                         (new, M1)
├── .markdownlint.jsonc                (new, M1)
├── firebase.json                      (new, M1)
├── firestore.rules                    (new, M1 — deny-all)
├── firestore.indexes.json             (new, M1 — empty)
├── package.json                       (new, M1)
├── tsconfig.json                      (new, M1)
├── vite.config.ts                     (new, M1)
├── tailwind.config.js                 (new, M1)
├── postcss.config.js                  (new, M1)
├── index.html                         (new, M1)
├── src/
│   ├── main.tsx                       (new, M1)
│   ├── App.tsx                        (new, M1 — placeholder)
│   ├── index.css                      (new, M1)
│   ├── firebase/
│   │   ├── config.ts                  (new, M1 — env-switched)
│   │   └── app.ts                     (new, M1 — initializeApp)
│   └── env.d.ts                       (new, M1 — Vite env types)
└── dispatch/
    ├── M1-infrastructure.md           (this file)
    ├── M1-g-outputs.md                (new, owner-written, gitignored)
    └── M1-infrastructure-handoff.md   (new, post-execution)
```

---

## 7. Files NOT to touch

- `PRD.md`
- `AGENTS.md`
- `BACKLOG.md`
- `CUTTLEFISH-NAUTILUS.md`
- `WORKING-MODEL.md`
- `HANDOFF-TEMPLATE.md`
- `README.md` (this is still the kit's bootstrap README; will be
  replaced post-v0 per kit guidance)
- This brief itself

---

## 8. Pre-flight (owner)

Before executing G* steps, owner confirms:

- `gcloud` CLI installed, authenticated as Austin's Google
  account, default project unset (we'll switch explicitly).
- `firebase` CLI installed (`npm install -g firebase-tools`),
  logged in (`firebase login`).
- Node.js ≥ 20 installed.
- `npm` ≥ 10 installed.
- Git repo initialized in `/Users/austin/src/claude-sandbox/flog/`
  with a clean working tree at dispatch start.

If any tool is missing or wrong-version, install/upgrade BEFORE
starting G1. Tool version mismatches mid-dispatch are a known stall
source.

---

## 9. Acceptance criteria

Status legend: `[ ]` not done, `[x]` done. Cuttlefish/owner fills
in as steps complete; handoff documents final state.

### G — GCP / Firebase console (owner-executed)

Execute fully for `flog-dev` first. Once `flog-dev` is verified
(V1, V3), repeat for `flog-prod`.

- **G1** `[ ]` Create GCP project. ID: `flog-dev` (and later
  `flog-prod`). Org: Austin's personal (no GSuite org). Billing
  account: **none** (Spark tier; see PRD §13 and the "paid Firebase
  tier" conversation — Spark suffices for v0).

  **Critical — manually edit the Project ID field.** GCP's
  Create-project form auto-fills Project ID from the project name
  and, if not manually edited, appends a 6-digit suffix to
  guarantee global uniqueness. IDs are immutable; the suffix is
  permanent and cascades into every Hosting URL, OAuth domain
  list, and Firebase config object. For `flog-dev` (2026-05-24)
  the auto-suffixed ID `flog-dev-497401` was accepted because
  dev URLs are not user-facing. **For `flog-prod`, click "Edit"
  next to the Project ID field and type a clean value** (try
  `flog-prod`; if globally taken, fall back to `flog-prod-ad` or
  similar). Never accept the auto-suffix for prod — the family
  bookmarks that URL.
- **G2** `[ ]` Add Firebase to the project (Firebase Console →
  Add project → select existing GCP project). Default settings.
- **G3** `[ ]` Configure OAuth consent screen:
  - User Type: **External**
  - Publishing status: **Testing** (not Published)
  - App name: `flog (dev)` / `flog (prod)`
  - User support email: Austin's Google-managed mailbox
    (Route7 confirmed: this field rejects forwarding aliases;
    must be an actual Gmail / Workspace identity)
  - Developer contact: `flog@austindavid.com` (this field DOES
    accept aliases; Route7 confirmed 2026-05-22)
  - Scopes: default (email, profile, openid) — no extra scopes
  - Test users: add Austin's email + the 3 family emails. Stays
    under the 100-user Testing-mode cap with massive headroom.
  - **Do not add a logo** — triggers brand verification (Route7
    rake). Logo lands when we go to Published mode post-v0.
- **G4** `[ ]` Enable Google sign-in provider in Firebase Auth
  (Firebase Console → Authentication → Sign-in method → Google →
  Enable). Project support email = same as G3.
- **G5** `[ ]` Add authorized domains. **All three lists**:
  1. **Firebase Auth Authorized Domains** (Firebase Console →
     Authentication → Settings → Authorized domains): defaults
     plus `localhost` (usually pre-populated; confirm).
  2. **GCP OAuth Consent Authorized Domains** (GCP Console → APIs
     & Services → OAuth consent screen → Authorized domains):
     `web.app`, `firebaseapp.com`. `localhost` is implicit.
  3. **GCP OAuth Client Authorized JS Origins + Redirect URIs**
     (GCP Console → APIs & Services → Credentials → the web
     client Firebase auto-created). Firebase pre-populates the
     `*.firebaseapp.com` redirect URI; the others below are NOT
     auto-added and are silently required for sign-in to work.

     **Authorized JavaScript origins** (3 entries):

     - `http://localhost:5173`
     - `https://flog-dev.web.app`
     - `https://flog-dev.firebaseapp.com`

     **Authorized redirect URIs** (3 entries; note the
     `/__/auth/handler` suffix is what Firebase Auth uses
     internally — easy to miss, breaks sign-in if absent):

     - `http://localhost:5173/__/auth/handler`
     - `https://flog-dev.web.app/__/auth/handler`
     - `https://flog-dev.firebaseapp.com/__/auth/handler`

     Substitute `flog-prod` for `flog-dev` when repeating for
     the prod project's OAuth client.
- **G6** `[ ]` Create Firestore database:
  - Mode: **production** (not test)
  - Location: `nam5` (multi-region US) — cheap and fast for
    family-in-US use case
  - Rules: leave the default deny-all (will be replaced in M2)
- **G7** `[ ]` Initialize Hosting:
  - Firebase Console → Hosting → Get started → accept default
    site (`flog-dev` / `flog-prod`)
  - No custom domain (PRD §1.2)
- **G8** `[ ]` Capture Firebase config object (Firebase Console →
  Project settings → General → Your apps → register a Web app →
  copy the `firebaseConfig` object). Paste into the local-only
  `dispatch/M1-g-outputs.md` file (see §10).

### S — Local repo scaffold (cuttlefish-executed)

- **S1** `[ ]` Vite scaffold: `npm create vite@latest . --
  --template react-ts`. Accept defaults; do not overwrite this
  dispatch's existing files.
- **S2** `[ ]` Install Tailwind v4 per Vite plugin docs. Verify
  utilities work via a sanity-check class on the placeholder page.
- **S3** `[ ]` Install Firebase SDK: `firebase` (modular SDK).
  Use the full `firebase/firestore` import path in M1. A future
  dispatch may swap to `firebase/firestore/lite` for bundle
  savings (~30-50 KB gz) — but that swap is a separate
  optimization, not an M1 constraint. The only meaningful
  incompatibility is that lite drops `getCountFromServer`; if
  flog's query surface ever needs aggregation counts, the swap
  becomes non-viable. Don't pre-commit either direction in M1.
- **S4** `[ ]` Create `src/firebase/config.ts` with **env-switched**
  Firebase config: reads from `import.meta.env.VITE_FIREBASE_*`
  variables. Two `.env` files: `.env.development` and
  `.env.production` (both gitignored). Values come from §8 G8
  outputs.
- **S5** `[ ]` Create `src/firebase/app.ts` that calls
  `initializeApp(config)` and exports the app instance.
- **S6** `[ ]` Placeholder `App.tsx` displays:
  - "flog" as a heading
  - The current environment ("dev" or "prod") read from
    `import.meta.env.MODE`
  - The Firebase project ID it's wired to (for visual confirmation)
- **S7** `[ ]` `.firebaserc` declares both project aliases:
  `{ "projects": { "default": "flog-dev", "dev": "flog-dev",
  "prod": "flog-prod" } }`.
- **S8** `[ ]` `firebase.json` configures Hosting (target `dist`,
  SPA rewrite to `index.html`), Firestore rules + indexes paths,
  and emulator suite (Auth on 9099, Firestore on 8080, UI on
  4000).
- **S9** `[ ]` `.gitignore` excludes `node_modules`, `dist`,
  `.env.development`, `.env.production`, `.env.local`,
  `dispatch/M1-g-outputs.md`, `.firebase/`, `*.log`.

### D — Deploy & scripts (cuttlefish-executed)

- **D1** `[ ]` `npm run dev` starts Vite dev server, app loads
  against `flog-dev` config.
- **D2** `[ ]` `npm run build:dev` and `npm run build:prod`
  produce a `dist/` build with the correct env config baked in.
  (Use Vite's `--mode` flag.)
- **D3** `[ ]` `npm run deploy:dev` runs `npm run build:dev &&
  firebase use dev && firebase deploy --only hosting` (and the
  parallel for `:prod`). The build step is non-optional — Hosting
  deploys whatever's in `dist/`, so a forgotten build either
  ships nothing or ships the previous mode's build with the
  wrong project ID baked in. Chain build + deploy in the npm
  script; never invoke `firebase deploy` directly without first
  building.
- **D4** `[ ]` `npm run emulators` starts the Firebase emulator
  suite per `firebase.json`.

### L — Linting (cuttlefish-executed)

- **L1** `[ ]` `.markdownlint.jsonc` at repo root with MD013
  enabled (80-col wrap), tables (MD013/tables) and code blocks
  (MD013/code_blocks) exempt. Comment header explains rationale.
- **L2** `[ ]` `npm run lint:md` runs `markdownlint-cli2
  "**/*.md"` and exits clean across ALL existing markdown
  (`PRD.md`, `AGENTS.md`, `BACKLOG.md`, `CUTTLEFISH-NAUTILUS.md`,
  `WORKING-MODEL.md`, `HANDOFF-TEMPLATE.md`, `README.md`, this
  brief). Fix any wrap violations encountered.
- **L3** `[ ]` `markdownlint-cli2` added as a devDependency.

### V — Verification (owner + cuttlefish)

- **V1** `[ ]` `npm run deploy:dev` succeeds; `flog-dev.web.app`
  serves the placeholder page; the page shows the correct env
  label and project ID.
- **V2** `[ ]` `npm run deploy:prod` succeeds; `flog-prod.web.app`
  serves the placeholder page identically (mod env label).
- **V3** `[ ]` Owner signs in to Firebase Console for both
  projects; verifies no errors / warnings / billing prompts.
- **V4** `[ ]` `npm run lint:md` exits zero.
- **V5** `[ ]` `npm run build:dev && npm run build:prod` both
  exit zero.

(No `npm test` gate yet — tests land in M2 with rules. No
`npm run lint` for code yet — ESLint lands in M2.)

---

## 10. The `M1-g-outputs.md` handoff note

The owner writes this file mid-dispatch after G8 completes for
each environment. It's gitignored (see S9) because it contains
the Firebase config objects — those are public-by-design but
checking them in mixes "secrets-shaped things" with real code in
a way the AGENTS.md guardrail warns against.

Shape:

```text
# M1 G-step outputs (local-only, gitignored)

## flog-dev
- Project ID: flog-dev
- Firebase config object: { ... pasted ... }
- OAuth Web Client ID: ...

## flog-prod
- Project ID: flog-prod
- Firebase config object: { ... pasted ... }
- OAuth Web Client ID: ...
```

The cuttlefish reads this file at S4 to populate `.env.development`
and `.env.production`.

---

## 11. Stop-and-ask triggers

Pause and surface in chat (don't guess) if any of these happen:

- **OAuth consent setup demands brand verification.** Means we
  triggered a rake — most likely added a logo or changed user-type
  to "External + Published" by accident. Back out, ask. Route7
  nautilus may need re-consult.
- **Firebase prompts for a billing account / Blaze upgrade.** v0
  is Spark-tier-only. If a service we're configuring requires
  Blaze, we shouldn't be configuring it. Stop, ask.
- **`gcloud` or `firebase` CLI versions don't match expectations.**
  Don't silently upgrade. Surface and confirm.
- **Firestore wants composite indexes** for any query. Stop —
  no queries exist yet in M1 that would need them. If something
  trips this, we have a bug.
- **The deny-all initial Firestore rules block the placeholder
  page's load.** They shouldn't (the placeholder doesn't read
  Firestore), but if they do, stop and confirm before relaxing
  rules. M2 owns rules; M1 keeps the default lockdown.
- **Vite + Tailwind v4 setup hits an unexpected version-mismatch
  error.** Tailwind v4 was new-ish at kit-write time; if the
  setup recipe drifted, surface and confirm before pinning a
  workaround.
- **Hosting deploy fails because the site name is taken.** Both
  `flog-dev.web.app` and `flog-prod.web.app` need to be available
  globally. If either is taken, fall back to `flog-dev-{suffix}`
  or similar — but stop and confirm the naming with the owner
  first; it cascades into the OAuth authorized domains.

---

## 12. Gates (run before handoff)

For the L/S/D phases, the cuttlefish runs all of these in order;
all must exit zero before the handoff doc is written:

```sh
npm run lint:md
npm run build:dev
npm run build:prod
```

For the G phase, "gates" are owner-driven manual verification per
V1-V3. Document each result in the handoff.

There is no `npm test` gate in M1 (tests start in M2). There is
no `npm run lint` for code (ESLint starts in M2).

---

## 13. Expected cost impact

**None** ongoing. M1 establishes the projects but adds no per-page
or per-action API/database activity beyond the placeholder page
load (which is static Hosting — well within free tier).

The handoff confirms this and notes "No cost impact" per
HANDOFF-TEMPLATE §4.

---

## 14. Handoff guidance

Cuttlefish writes `dispatch/M1-infrastructure-handoff.md` per
HANDOFF-TEMPLATE.md after all S/D/L/V ACs are checked. Specific
items the handoff must capture beyond the template's defaults:

- **Which ACs the owner executed vs. cuttlefish executed.** This
  is an ops dispatch with a real split; the handoff records who
  did what for future debugging.
- **Final Firebase project IDs** (in case naming fell back from
  `flog-prod` to `flog-prod-{suffix}` etc.).
- **Versions chosen** per HANDOFF §4: Vite, React, TypeScript,
  Tailwind, Firebase SDK, markdownlint-cli2, Node, npm. Top-level
  only.
- **Any rake encountered** that wasn't anticipated by this brief.
  These get filed back to the kit's `paralarva` source folder
  (via Austin, separately) so future projects benefit.
- **BACKLOG additions**: nothing should land here from M1 if the
  scope held. If anything did spill out, list it for nautilus to
  file.

Then move M1 from PRD §10 to "shipped" by noting it in the M1
row's status — or, post-v0, by relocating to BACKLOG → Done.

---

## 15. Cross-project feedback channel

This is the first dispatch executed under the paralarva
bootstrap pattern. Any rakes encountered during M1 — things
this brief didn't anticipate, gotchas that surfaced, defaults
that turned out wrong — should be captured here for the owner
to feed back to the Route7 nautilus (and into the source
paralarva kit) so future projects benefit.

The cuttlefish (during execution) and the nautilus (during
post-execution review) populate this section as findings
emerge. Owner relays to Route7 nautilus separately.

### Rakes encountered during M1

- **GCP auto-suffixes Project ID if not manually edited**
  (2026-05-24, G1 flog-dev). The Create-project form has separate
  Project Name (free-text) and Project ID (auto-derived,
  click-to-edit) fields. If the operator doesn't click "Edit" on
  the ID field before submitting, GCP appends a 6-digit suffix
  (e.g. `flog-dev-497401`) to ensure global uniqueness. IDs are
  immutable; the suffix is permanent and cascades into every URL
  and config. Mitigation captured inline at G1 (instruction to
  manually edit for prod). For flog-dev we accepted the suffix
  because dev URLs are not user-facing.

- **Agent worktree isolation requires git + a HEAD commit, AND
  the harness's git detection appears to cache at session start**
  (2026-05-24, S* dispatch attempt). With no git, the Agent tool
  refuses to spawn write-capable cuttlefish ("Cannot create agent
  worktree"). `git init` alone wasn't enough — needed an empty
  bootstrap commit so worktree had a HEAD to branch from. Even
  after both, the harness continued to error in this session,
  likely because it cached the no-git state at session start.
  Net effect: nautilus executed S/D/L inline as documented
  fallback. Workarounds for future sessions: start the session
  in an already-git-init'd directory, OR configure
  `WorktreeCreate`/`WorktreeRemove` hooks in `settings.json` for
  non-git operation.

- **Tailwind v4 doesn't need `tailwind.config.js` or
  `postcss.config.js` by default.** Brief §6 (Files in play)
  listed both based on a v3 mental model. The v4 setup is
  CSS-first: `@tailwindcss/vite` plugin in `vite.config.ts` plus
  `@import "tailwindcss";` in one CSS file. Config (theme tokens,
  etc.) goes in `@theme {}` blocks in CSS, not in a JS file.
  Adding either config file is only needed when customizing.

- **markdownlint-cli2's `.markdownlintignore` was not honored**
  in our setup (v0.14.0). The file existed at repo root with
  gitignore-style patterns; the CLI scanned `node_modules`
  anyway. Workaround: explicit `#node_modules` etc. ignore globs
  in the `lint:md` script. `.markdownlintignore` deleted to
  avoid confusion.

- **MD049 / MD050 emphasis-style rules can't coexist with the
  kit's underscore-italics-for-copyright convention** alongside
  asterisk emphasis elsewhere. The rules force one style per
  file. Disabled both with rationale comment in
  `.markdownlint.jsonc`.

- **GCP OAuth consent screen UI has drifted** from what the brief's
  G3 step-by-step describes (2026-05-25, G3 flog-prod). Current
  flow: APIs & Services → OAuth Consent Screen → Overview tab →
  Get Started → condensed wizard (name + contact → audience →
  contact info → policy agreement → finish). Test users are now
  under the **Audience** tab/section (no longer a separate wizard
  step). Scopes screen also collapsed/moved. Load-bearing settings
  are unchanged (External user type, Testing mode not Published,
  no logo, family emails as test users); only UI locations
  drifted. Future brief G3 instructions should describe the
  *requirements* not the *click path* so they survive future UI
  drift too.

- **Firebase Auth panel moved** from Build → Authentication to
  Security → Authentication (2026-05-25, G4 flog-prod). Same
  underlying feature; navigation reorganized. Same lesson as the
  G3 drift — describe the panel by name + purpose, not by exact
  navigation path.

- **GCP OAuth Consent "Authorized domains" moved + tightened**
  (2026-05-25, G5b flog-prod). New location: under the
  **Branding** sub-screen within OAuth Consent Screen. New
  validation: only fully-qualified project-prefixed domains
  accepted (e.g., `flog-prod-497401.web.app`), NOT apex domains
  (`web.app`/`firebaseapp.com` rejected), NOT `localhost`
  (requires TLD). Makes sense in retrospect — the field's purpose
  is "domains Google will redirect users to during OAuth" and
  apex was always too broad. Future brief G5b should list the
  fully-qualified domains directly.

- **GCP OAuth Client JS origins / redirect URIs moved to a
  "Clients" tab** within the OAuth Consent area (2026-05-25,
  G5c flog-prod). Previously surfaced via APIs & Services →
  Credentials. Same web client; same fields; just reorganized
  under the OAuth Consent tree.

- **Firebase Console nav reorganized** (2026-05-25, G6+G7
  flog-prod). Firestore moved to **Databases → Firestore**;
  Hosting moved to **Hosting & Serverless → Hosting**. The "Build"
  top-level section that the brief's G6/G7 referenced no longer
  exists as such. Same pattern as the GCP drifts — describe
  features by name + purpose, not by current navigation path.

### Defaults to reconsider in future paralarva-derived projects

(empty — populate as patterns surface)

### Suggested paralarva kit improvements

- **Infra dispatch template should include "manually edit Project
  ID" as an explicit G1 sub-step**, not just an aside. Current
  paralarva kit doesn't have an infra dispatch template per se
  (each new nautilus drafts from scratch with Route7 review), but
  if/when a template lands, the auto-suffix rake is exactly the
  kind of cheap-to-mention, costly-to-discover gotcha that earns
  its place there.

- **Kit's README §step-2 (owner interview) should ask about
  git posture early.** flog started without a git repo because
  the owner wanted to handle git externally; only later did the
  Agent tool surface a worktree dependency on git. A 30-second
  upfront question ("will you be working under git? If so, do
  `git init` now and an empty bootstrap commit") would have
  surfaced this before the M1 attempt.

- **Kit's WORKING-MODEL §3 should note that S* (scaffold)
  phases of ops dispatches still benefit from pre-read** —
  current text emphasizes "pre-read adds no value for ops-only
  dispatches" but conflates console runbook (where pre-read
  truly can't verify) with code scaffold (where pre-read could
  catch e.g. the Tailwind v4 config drift, the
  `.markdownlintignore` non-effectiveness, etc.). Refining the
  guidance: skip pre-read for owner-only runbook steps; keep
  pre-read for any code-authoring step within an ops dispatch.

- **Kit's AGENTS-TEMPLATE markdownlint setup advice should note
  that v4 Tailwind doesn't need its config files**, and that
  `.markdownlintignore` may need explicit-glob fallback in the
  `lint:md` script depending on cli2 version behavior.

---

End of M1 brief.
