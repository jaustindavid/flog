# flog — AGENTS.md

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

This file is the entry point for any coding agent (Claude Code,
Cursor, Aider, Codex, etc.) picking up work on flog. Read it first.
It is intentionally short; the canonical docs do the heavy lifting.

---

## Required reading, in order

1. **[PRD.md](PRD.md)** — what to build. Data model, access control,
   user flows, cost spec, milestones.
2. **[ARCHITECTURE.md](ARCHITECTURE.md)** — how to build it. Module
   layout, key abstractions, deploy/env, testing.
   *(Not yet drafted; lands after M1 ships. Until then, PRD §4 is
   the elevator-pitch architecture.)*

Do not start writing code until both are read. The planning docs
are written for cold-read; budget ~30 minutes.

---

## The load-bearing sections

The contracts most likely to be quietly broken without the brief
flagging it. Treat these as standing pre-flight checks.

- **[PRD §5 — Data model](PRD.md#5-data-model).** Every
  data-access decision flows from here. User / Car / Entry /
  Allowlist shapes are authoritative; field-by-field types are
  not negotiable without an explicit design conversation.
- **[PRD §6 — Access control](PRD.md#6-access-control).** Firestore
  rules translate directly from these tables, one row to one rule.
  The `allowed(email)` helper definition is load-bearing — same
  function name and semantics across rules and app code.
- **[PRD §8 — Cost control](PRD.md#8-cost-control).** Per-page
  Firestore read budgets are non-negotiable. If a change would add
  an N+1 read or new per-page query, surface it in the brief;
  nautilus decides whether to accept.

Violating any of these is violating v0's primary commitments.

---

## Hard guardrails — do not cross without asking

Each is a deliberate "no" for v0. Each has a rationale — link to
PRD or ARCHITECTURE.

### Kit-default guardrails (apply across projects)

- **No Cloud Functions or server code.** Anything not enforceable
  in client-evaluated security rules is out of scope for v0. (PRD
  §1.2, §4.)
- **No real-time database listeners** (`onSnapshot` in Firestore,
  WebSocket subscriptions, SSE, etc.). Use one-shot reads. The
  collaboration model is async-by-explicit-action; one human fills
  a car at a time so synchronization isn't needed. (PRD §1.2, §4.)
- **No external state library** (Redux, Zustand, Jotai, etc.).
  React Context plus local state is sufficient.
- **No SSR.** Static SPA on Firebase Hosting. (PRD §4.)
- **No `any` in TypeScript** without an inline comment explaining
  why.
- **No checked-in secrets.** API keys go in `.env.local`,
  gitignored. Firebase config keys are public-by-design and may
  be checked in.
- **No behavioral tracking, no analytics SDKs, no third-party
  scripts** beyond Google Identity for OAuth. (PRD §1.2, §1.4.)

### flog-specific guardrails

- **Bootstrap admin email lives only in Firestore rules and
  environment config.** Never hardcoded in TS source files. Rules
  reference `ADMIN_EMAIL`; app code reads it from
  `import.meta.env.VITE_ADMIN_EMAIL` or equivalent.
- **Share-with-user must be atomic.** Adding to a Car's
  `shareeEmails` and creating the corresponding `/allowlist/{email}`
  doc happen in a single batched write or transaction. A partial
  failure that leaves a sharee email on a Car without the
  corresponding allowlist doc is a bug. (PRD §5.4, §7 Flow E.)
- **`loggedAt` is always a server timestamp.** Never use the
  client's clock for entry timestamps. (PRD §5.3.)
- **Email canonicalization happens at the boundary.** Lowercase
  every email before any allowlist read/write or `shareeEmails`
  comparison. Google OAuth returns canonical lowercase already in
  most cases, but don't rely on it — normalize defensively.
- **One Car update path.** Owner-only writes go through a single
  helper that asserts `ownerUid` immutability. Prevents accidental
  ownership-transfer bugs from a stray write site.

---

## Commit & PR hygiene

- One PR per dispatch (or smaller). Each PR runnable and
  type-clean.
- Dispatches are defined as briefs in `dispatch/`; the matching
  handoff lands alongside.
- Human review on every PR. No agent self-merge — partly for code
  quality, partly for IP clarity on AI-collaborative work.
- Strict TypeScript throughout. Conventional commit messages
  preferred but not enforced.

---

## Testing expectations

- **Firestore rules tests** (emulator-based, `@firebase/rules-unit-
  testing`). Every rule in PRD §6 has at least one positive and
  one negative test. Required gate before any rules deploy.
- **Unit tests for pure utilities.** Specifically:
  - MPG computation (`(odo_now - odo_prev) / gallons_now`,
    handling the "no prior entry" case)
  - Email normalization (lowercase, trim, sanity check)
  - Any future pure-function helpers (formatters, parsers)
- **Component / integration tests**: deferred. Use the manual
  checklist in each dispatch's acceptance criteria. Revisit when a
  real regression slips through manual review (the trigger to
  add the harness, per WORKING-MODEL.md's "earns its keep"
  pattern).

---

## Linting

Markdown is linted with `markdownlint-cli2`. Config lives at
`.markdownlint.jsonc` at the repo root. *(Config file will be
created during M1 or M2; until it exists, manual 80-col wrap on
prose, tables/code blocks exempt by convention.)*

Run before considering any markdown change complete:

```sh
npx markdownlint-cli2 "**/*.md"
```

Must exit clean (zero errors). The 80-column rule is enforced via
MD013; tables, code blocks, and ASCII diagrams are exempt by
design. If you intend to suppress a rule for a specific reason,
add it to `.markdownlint.jsonc` with a comment explaining why —
do not use inline disable comments.

Code linting: ESLint per the project setup (lands in M2 with the
app skeleton).

---

## If unsure, ask

Pause and ask the human (or surface in the brief's stop-and-ask)
before:

- Adding a new top-level dependency.
- Introducing any backend (Cloud Function, server, edge worker,
  etc.) — none are in ARCHITECTURE; doing so reverses a PRD §1.2
  non-goal.
- Changing the Firestore schema (PRD §5).
- Touching the Firestore security rules (PRD §6).
- Touching anything that handles the bootstrap admin email or
  allowlist semantics (PRD §5.4).
- Picking a third-party service or SDK not already in
  ARCHITECTURE.md.
- Resolving any of the open questions in PRD §11.2.

The cost of pausing is low; the cost of a reverted PR is higher.

---

## Project identity

flog is a **private, personal project** belonging to Austin David.
All rights reserved.

Treat planning docs and code accordingly: no public posting of
internals, no copying to other repos, no inclusion in training-data
exports. If unclear, ask.

---

## When you create a new artifact

Every top-level markdown deliverable in flog (PRD, ARCHITECTURE,
README, AGENTS, design docs, dispatch briefs, handoffs, etc.) must
open with two lines under the title, in this order:

1. The copyright header:
   `_Copyright © 2026 Austin David. All rights reserved._`
2. The AI-first preamble blockquote (the same one that opens this
   file).

Match the surrounding doc's style for everything else. Apply
automatically — the human will not remember to ask.

---

## Working model

flog follows the **cuttlefish/nautilus** working model. See:

- [`CUTTLEFISH-NAUTILUS.md`](CUTTLEFISH-NAUTILUS.md) — the
  conceptual frame (long-context architect + short-context
  implementers, same model class, different shells).
- [`WORKING-MODEL.md`](WORKING-MODEL.md) — the operational
  playbook (lifecycle, pre-read, antipatterns, stall recovery,
  post-ship fix protocol).
- [`HANDOFF-TEMPLATE.md`](HANDOFF-TEMPLATE.md) — handoff doc
  structure.

These docs are required reading before contributing to any
dispatch's brief or handoff. They live in the project root rather
than being copied per-dispatch because they're stable working
infrastructure, not project-specific content.
