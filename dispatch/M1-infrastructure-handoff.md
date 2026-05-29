# M1 — Infrastructure handoff

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

Companion to `dispatch/M1-infrastructure.md`. Phase `G*` was
owner-executed against GCP/Firebase Console; phases `S*`/`D*`/`L*` + the
agent-runnable parts of `V*` were executed inline by the nautilus
(see Deviations).

---

## Status

Against the ACs in brief §9:

- **G1-G8 (Console, flog-dev)** ✅ — owner-executed. flog-dev's
  GCP Project ID landed as `flog-dev-497401` (GCP auto-suffix
  accepted; documented in brief §15).
- **G1-G8 (Console, flog-prod)** ✅ — owner-executed 2026-05-25.
  prod Project ID landed as `flog-prod-497401` (auto-suffix
  recurred despite explicit warning at G1; documented in brief
  §15). Multiple GCP/Firebase UI drifts encountered mid-execution
  and filed in §15 (OAuth Consent screen condensed, Firebase nav
  reorganized to Security/Databases/Hosting & Serverless, OAuth
  Consent Authorized Domains tightened to reject apex domains,
  OAuth Client moved to Clients tab).
- **S1 Vite scaffold** ⚠️ — hand-authored package.json, tsconfig,
  vite.config rather than running `npm create vite@latest .` (see
  Deviations). Resulting structure is the same.
- **S2 Tailwind v4** ✅ — `@tailwindcss/vite` plugin in
  vite.config; `@import "tailwindcss";` in `src/index.css`. No
  tailwind.config.js or postcss.config.js (Tailwind v4 doesn't
  need either by default).
- **S3 Firebase SDK** ✅ — full `firebase` modular SDK, not lite.
- **S4 env-switched config** ✅ — `src/firebase/config.ts` reads
  `import.meta.env.VITE_FIREBASE_*`; both `.env.development` and
  `.env.production` populated from `dispatch/M1-g-outputs.md`
  (prod values added 2026-05-25 post-G* for prod).
- **S5 initializeApp** ✅ — `src/firebase/app.ts`.
- **S6 placeholder App.tsx** ✅ — displays heading, env mode
  (from `import.meta.env.MODE`), and project ID (from
  `firebaseConfig.projectId`).
- **S7 .firebaserc** ✅ — aliases `dev=flog-dev-497401`,
  `prod=flog-prod-497401` (prod alias updated 2026-05-25 from the
  initial placeholder once the prod GCP project ID was known).
- **S8 firebase.json** ✅ — Hosting + Firestore rules/indexes +
  emulator suite (Auth 9099, Firestore 8080, UI 4000,
  singleProjectMode).
- **S9 .gitignore** ✅ — covers node_modules, dist, env files,
  `dispatch/M1-g-outputs.md`, `.firebase/`, logs, tsbuildinfo,
  .DS_Store.
- **D1 `npm run dev`** ⚠️ — script defined; not started/tested
  during this dispatch. Will start a Vite dev server on port 5173
  against dev config when run.
- **D2 `npm run build:dev` / `build:prod`** ✅ — both run clean
  (dev: 179.80 KB JS / 54.82 KB gz; prod: same modules, different
  hash since the env-mode-dependent values differ). Confirmed by
  successful deploy:prod 2026-05-25.
- **D3 `npm run deploy:dev`** ✅ — chains `build:dev && firebase
  use dev && firebase deploy --only hosting`. Verified working.
- **D4 `npm run emulators`** ⚠️ — script defined; not started/
  tested during this dispatch.
- **L1 `.markdownlint.jsonc`** ✅ — 80-col on prose; tables, code
  blocks, headings exempt. MD033, MD036, MD049, MD050 disabled
  with rationale comments inline.
- **L2 `npm run lint:md` exits clean** ✅ — across all 8
  project markdown files.
- **L3 `markdownlint-cli2` devDependency** ✅ — v0.14.0.
- **V1 `npm run deploy:dev` succeeds + URL serves placeholder**
  ✅ — deploy succeeded; `https://flog-dev-497401.web.app` serves
  the SPA shell (`curl`) and the rendered React placeholder
  (owner browser-confirmed 2026-05-25: "flog" heading,
  `environment: development`, `project: flog-dev-497401`).
- **V2 prod deploy + URL serves placeholder** ✅ — deploy succeeded
  2026-05-25 (`https://flog-prod-497401.web.app`); curl confirms
  the SPA shell with a different JS hash than dev (`CMdMlpp6` vs
  dev's `BS4Juc3b`, proving prod build picked up `.env.production`
  not dev). Owner browser-confirmed the rendered placeholder with
  `environment: production` and `project: flog-prod-497401`.
- **V3 Console health check** ✅ — owner verified both Firebase
  Console projects 2026-05-25: no billing prompts, no Blaze
  upgrade nags, both Hosting dashboards show latest deploys.
- **V4 `npm run lint:md` exits zero** ✅.
- **V5 `build:dev && build:prod` both exit zero** ✅ — both ran
  clean during respective deploys.

---

## Versions chosen

| Dep | Version |
|---|---|
| Vite | 6.4.2 |
| React | 18.3.1 |
| React DOM | 18.3.1 |
| TypeScript | 5.9.3 |
| Tailwind CSS | 4.3.0 |
| `@tailwindcss/vite` | 4.3.0 |
| `@vitejs/plugin-react` | 4.7.0 |
| Firebase JS SDK | 11.10.0 |
| `markdownlint-cli2` | 0.14.0 |
| Node | v26.0.0 (host) |
| npm | 11.12.1 (host) |

Node v26 is well past the brief's ≥20 floor. No version conflicts
encountered.

---

## Assumptions made

- **Hand-authored Vite scaffold over `npm create vite@latest .`**
  — chosen because the interactive non-empty-dir prompt was a
  hangup risk regardless of how the dispatch ran. Manual authoring
  also let the placeholder App.tsx read the Firebase project ID
  directly (S6 acceptance), which the default Vite template
  doesn't do. Owner can override if they specifically want the
  Vite-template-generated artifacts (vite.svg favicon, the demo
  counter, etc.); easiest path is `rm -rf src && npm create
  vite@latest . -- --template react-ts` and re-apply our changes.
- **No `.env.production` file in this dispatch** — flog-prod
  doesn't exist yet. Creating with placeholder strings would
  silently produce a broken prod build (`apiKey="TODO"` etc.).
  Better: file is absent; `npm run build:prod` will fail loudly
  with undefined env vars when invoked, signaling "populate me
  first." Owner creates `.env.production` after running G* for
  prod and capturing config into `M1-g-outputs.md`.
- **No Tailwind config files** — Tailwind v4 uses CSS-first
  configuration (`@theme {}` blocks in CSS) by default. The
  scaffold ships with the empty default, which is sufficient for
  v0. Adding a `tailwind.config.js` only matters when customizing
  the design system; defer to a real-design dispatch.
- **No `measurementId` in `firebaseConfig`** — even though the
  Firebase console emits one. PRD §1.4 commits to no analytics;
  omitting `measurementId` prevents accidental GA initialization
  if a future copy/paste pulls it from Firebase Console into env.
- **`firestore.rules` initial content = deny-all** — per brief
  G6 spec. M2's first task in the rules domain is replacing this
  with the real rules from PRD §6.
- **`firestore.indexes.json` initial content = empty arrays** —
  no queries yet need composite indexes.
- **Bootstrap git commit (empty) was acceptable** — owner created
  it explicitly to unblock harness tooling (worktree isolation
  needs a HEAD). This is harness plumbing, not project content.

---

## Deviations from dispatch

1. **Inline execution by nautilus instead of dispatched
   cuttlefish.** The Agent tool failed three times with "Cannot
   create agent worktree" even after `git init` + an empty
   bootstrap commit. The harness appears to have cached "not a git
   repo" at session start and not re-checked. Restarting the
   session would have lost all the context built up through the
   PRD + AGENTS + brief drafting and the in-progress G* execution
   — net cost was higher than executing inline. Per kit
   WORKING-MODEL §7 (stall recovery) the nautilus is allowed to
   take over when the dispatched cuttlefish can't run; documenting
   here per the stall protocol. Rake also filed in brief §15 for
   the kit feedback loop.

2. **Hand-authored Vite scaffold** instead of `npm create
   vite@latest .` (see Assumptions). Same end-state; safer in
   agent context.

3. **Lint-fix edits to two kit docs.** Brief §7 lists
   `WORKING-MODEL.md` and `HANDOFF-TEMPLATE.md` in "Files NOT to
   touch," but brief §9 L2 explicitly authorizes "Fix any wrap
   violations encountered." Two MD040 violations existed in those
   docs (code fences without a language tag, lines
   `WORKING-MODEL.md:64` and `HANDOFF-TEMPLATE.md:38`). Added
   `text` language tags. Zero semantic change.

4. **`tailwind.config.js` and `postcss.config.js` not created.**
   Brief §6 (Files in play) listed both. Tailwind v4 doesn't need
   either by default; the brief's layout was written against the
   v3 mental model. Final layout differs from §6 by these two
   omissions (and gains `tsconfig.app.json` / `.markdownlintignore`
   was removed after testing).

5. **`.markdownlintignore` was created, tested ineffective,
   removed.** markdownlint-cli2 v0.14 didn't honor the file in
   our setup. Replaced with explicit `#node_modules` etc.
   exclusion globs in the `lint:md` script. Documented inline.

---

## Files created

```text
flog/
├── .env.development                  (real values, gitignored)
├── .firebaserc                       (dev/prod aliases)
├── .gitignore
├── .markdownlint.jsonc
├── firebase.json                     (hosting + firestore + emulators)
├── firestore.indexes.json            (empty)
├── firestore.rules                   (deny-all; M2 replaces)
├── index.html
├── package.json
├── package-lock.json                 (npm-generated; not in S9 list)
├── tsconfig.json                     (project references)
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── src/
│   ├── App.tsx
│   ├── env.d.ts
│   ├── index.css
│   ├── main.tsx
│   └── firebase/
│       ├── app.ts
│       └── config.ts
├── dispatch/
│   └── M1-infrastructure-handoff.md  (this file)
└── node_modules/                     (npm install output)
```

Plus minor edits to `WORKING-MODEL.md` and `HANDOFF-TEMPLATE.md`
per Deviation #3, and updates to brief §15 documenting rakes.

### Post-shipping additions (2026-05-25, after dev half landed)

The following landed in the same M1 arc but after the initial
handoff was written. Listed here so a fresh head can find them:

- `.env.production` — prod Firebase config (gitignored)
- `.firebaserc` — prod alias updated from `flog-prod` placeholder
  to `flog-prod-497401` (the actual auto-suffixed GCP ID)
- `.claude/settings.local.json` — `worktree.bgIsolation: "none"`
  (decouples agent dispatch from git; see paralarva feedback #1)
- `.gitignore` — added `.claude/settings.local.json` entry
- `dispatch/paralarva-feedback-agent-dispatch.md` — kit feedback
  on the bgIsolation discovery
- `dispatch/paralarva-feedback-002-brief-authoring-and-pickup.md`
  — kit feedback on three additional lessons from M1
- `dispatch/runbooks/gcp-firebase-env-setup.md` — reusable runbook
  for creating new GCP+Firebase environments (captures the actual
  current UI paths + the rakes from §15 + the load-bearing
  requirements that survive UI drift)

---

## Files NOT touched (confirmed)

- `PRD.md`
- `AGENTS.md`
- `BACKLOG.md`
- `CUTTLEFISH-NAUTILUS.md`
- `README.md`
- The brief itself (`dispatch/M1-infrastructure.md`) — except
  §15 (Cross-project feedback channel), which the brief
  explicitly invites the implementer to populate.
- `dispatch/M1-g-outputs.md` — read-only, used as input to S4.

`WORKING-MODEL.md` and `HANDOFF-TEMPLATE.md` got one-character
edits each (adding `text` after triple-backticks on a single line
in each file) per the L2 lint-fix authorization. No prose changes.

---

## Items deferred

### To the next dispatch (M2)

- Replace `firestore.rules` deny-all with real rules per PRD §6.
- Wire actual Google sign-in flow + allowlist gate + first-sign-in
  `users/{uid}` doc creation.
- ESLint setup (TS code lint; not in M1 per brief §4 Out of scope).
- Component scaffolding beyond the placeholder.
- First Firestore rules tests using the emulator suite (already
  configured in `firebase.json`).
- `dev:emulators` workflow if M2's local dev needs the Firestore
  emulator running alongside Vite (currently two separate scripts;
  consider a parallel runner).

### To BACKLOG

- `[ ]` **Investigate 4 moderate-severity npm audit findings** —
  XS. Nothing critical; `npm audit fix` likely safe but didn't run
  it during this dispatch (no gate required, scope creep risk).
  Trigger to revisit: any of them escalate to high/critical, or
  M2's deps expose them in app code.

---

## Expected cost impact

None ongoing. M1 adds:

- Hosting bandwidth for the placeholder page (~6 KB gz; trivial)
- One Firestore database (no docs yet; idle)
- One OAuth client (no auth calls yet)

All well within Spark free tier with multiple orders of magnitude
of headroom. Will sanity-check the Firebase console quota usage
after M2 ships and real reads/writes start.

---

## Manual steps for the human owner

All M1 manual steps are complete as of 2026-05-25. Retained
here for historical reference / future re-execution via the
runbook (`dispatch/runbooks/gcp-firebase-env-setup.md`):

1. ✅ Visited `https://flog-dev-497401.web.app` — placeholder
   renders correctly (V1 visual).
2. ✅ G* completed for flog-prod (despite auto-suffix recurrence
   at G1 — same rake captured in §15).
3. ✅ `dispatch/M1-g-outputs.md` has the prod block;
   `.env.production` created; `.firebaserc` updated to
   `flog-prod-497401`.
4. ✅ `npm run deploy:prod` succeeded.
5. ✅ V3 console health check confirmed across both projects.

---

## Notes for the next dispatch brief

- **Tailwind v4 has different config conventions** than v3. M2's
  brief should note this if it specifies any design tokens; the
  pattern is CSS-first via `@theme {}` blocks, not a JS config
  file.
- **Agent dispatch IS NOW WORKING** — the
  `worktree.bgIsolation: "none"` setting in
  `.claude/settings.local.json` (added post-handoff) decouples
  agent dispatch from git/worktree concerns. Verified by probe
  in a fresh session. M2 should use proper cuttlefish dispatch,
  not the inline-nautilus pattern M1 fell back to. See
  `dispatch/paralarva-feedback-agent-dispatch.md` for the full
  context.
- **`.env.production` exists and is populated.** M2 inherits a
  fully-working dev and prod env; no env-file setup needed.
- **The `firestore.rules` deny-all should be replaced as M2's
  first commit**, before any signed-in surface ships. Otherwise
  the placeholder browser tab will see `users/{uid}` writes fail
  silently when the auth-prov dispatch starts.
- **`measurementId` deliberately omitted** from `firebase/config.ts`
  per PRD §1.4 no-analytics commitment. If M2 (or any future
  dispatch) needs to re-add it, surface that as a PRD-level
  conversation, not a quiet config change.

---

End of M1 handoff.
