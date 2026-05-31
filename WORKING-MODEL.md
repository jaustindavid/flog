# Working model

> This document is part of the **paralarva** bootstrap kit — the
> working patterns used to spin up projects with Claude as
> collaborator. Planning docs in projects derived from this kit are
> written dense and self-contained so a fresh Claude session can
> cold-read and contribute immediately.

This doc is the **operational playbook** for how project work
happens — the patterns evolved across many dispatches on prior
projects, the lessons that produced them, and the boundaries
worth honoring.

It pairs with — but doesn't restate — the conceptual
cuttlefish/nautilus framing (the long-form paper) which
explains *why* this division of labor works. This doc is
about *what we do day-to-day*.

If you're a fresh nautilus or cuttlefish dropped into this
project, read this first. AGENTS.md covers codebase
guardrails; HANDOFF-TEMPLATE.md covers handoff doc shape;
BACKLOG.md is the working list. This doc is the
practitioner's guide that ties them together.

---

## 1. The cast

**Owner** (Austin) — has the product context. Sets
direction, makes design decisions, reviews + commits.
Doesn't write code directly (with rare exceptions);
operates through delegation.

**Nautilus** (long-context Claude session) — the
architect. Holds the conversation history and the design
intent; carries the design conversation with the owner;
**dispatches cuttlefish for research, design, pre-read,
and implementation, and folds their findings back**;
picks the model tier per dispatch (§5); handles
housekeeping (BACKLOG, post-stall recovery, doc
maintenance). One nautilus per session; sessions may span
hours or days. It coordinates but does not predate — it
provides the shell; the cuttlefish do the work.

**Cuttlefish** (short-context agents) — the
dispatched-agent class. Each is spawned for a single
bounded task, reads what it needs cold (no conversation
history), and is disposed when done. They are **not
downstream-only hands** — the nautilus casts them across
the whole lifecycle, in distinct roles (§3 covers how to
run the upstream ones):

- **Research / exploration** — read-only, fan-out. Survey
  prior art, map unfamiliar code, gather evidence. Return
  *conclusions, not file dumps*; their output feeds
  design.
- **Design** — generate and/or stress-test design options
  (sometimes several in parallel for the nautilus to
  judge), so the owner sees a considered space rather than
  a single guess.
- **Reviewer** (pre-read) — read a brief BEFORE the
  implementer runs it; find blockers / ambiguities / stale
  references. Cheap (~2-10 min); catch issues that cost
  far more in implementer time + recovery.
- **Implementer** — execute a single dispatch end-to-end:
  read the brief cold, run gates, write the handoff,
  update BACKLOG. Optimized for focused execution;
  deliberately scope-constrained.

Same agent class throughout — a research cuttlefish is
not a different creature from an implementer, just a
different prompt and a different bounded task. Cuttlefish
never communicate with each other; every one reports to
the nautilus, which mediates and folds.

---

## 2. The lifecycle

```text
   research / exploration    (cuttlefish fan-out, read-only;
            ↓                  optional — for novel problems)
       fold findings         (nautilus)
            ↓
owner ←→ nautilus            (design conversation; may spawn
            ↓                  design cuttlefish to widen options)
       BACKLOG entry         (decisions captured)
            ↓ (promote to Next)
       brief draft           (nautilus writes;
                              BACKLOG entry is most of it)
            ↓
       pre-read              (reviewer cuttlefish)
            ↓
       fold findings         (nautilus revises brief)
            ↓
       spawn implementer     (cuttlefish runs end-to-end;
                              nautilus picks the model tier, §5)
            ↓
       gates pass            (lint / lint:md / test / rules /
                              build:dev / build:prod)
            ↓
       handoff doc           (cuttlefish writes;
                              or nautilus on stall)
            ↓
       BACKLOG move          (Next → Done)
            ↓
       owner review (V2) + commit
```

The arrows are loose. Loops happen — research can reopen a
design question, pre-read findings might trigger a design
re-conversation, the owner might push back on a brief and
we restart, the implementer might flag a stop-and-ask and
kick back to the nautilus.

What's load-bearing:

- **Research and design can be cuttlefish-fed**, not just
  owner+nautilus chat. For a novel problem the nautilus
  spawns research/exploration cuttlefish first and folds
  their conclusions into the design conversation; for a
  wide solution space, design cuttlefish surface options.
  The owner still makes the call — the cuttlefish widen
  and sharpen it (§3).
- **Design conversation lives in the BACKLOG entry**,
  not just in chat. The entry accumulates settled
  decisions and is what the next session (or the brief
  draft) cold-reads.
- **Brief is for the implementer, not the owner**. Owner
  has seen the design conversation; implementer hasn't.
  Brief restates everything the implementer needs from
  cold.
- **Handoff is for the next nautilus + the owner**, not
  for the implementer that wrote it. It's a persistent
  record after the implementer finishes.
- **Owner review (V2) is a real step.** The owner
  validates hands-on after the handoff, at/before commit;
  agents never commit (§5).

---

## 3. Dispatching cuttlefish (research, design, pre-read)

Before — and around — the implementer dispatch, the
nautilus casts cuttlefish in three upstream roles. All
share the same discipline: a purpose-built prompt, a
bounded task, a defined report format, and *read-only*
unless the role is implementation. The nautilus **folds**;
it never forwards one cuttlefish's raw output to another.

### Research & exploration

When a problem is novel or touches unfamiliar code, spawn
a research/exploration cuttlefish BEFORE designing. It
fans out (prior-art survey, codebase archaeology, evidence
gathering) and returns **conclusions, not file dumps** —
the nautilus wants the finding, not the search trail.
Read-only: it locates and concludes; it does not edit.
Example: the maintenance phase opened with a survey of
consumer maintenance apps that shaped the data model and
the no-categories decision before any design was written.

When to skip: if the nautilus genuinely has the context,
reason inline. But "I have full context" is often wrong
(see §6.4) — a cheap research pass de-risks a design built
on assumptions.

### Design

For a wide or contested solution space, spawn design
cuttlefish to generate and/or stress-test options —
sometimes several in parallel, which the nautilus judges
and synthesizes — so the owner sees a considered space,
not the nautilus's first guess. The owner still decides;
the design cuttlefish widen the menu and surface
trade-offs. For a narrow space, the owner ←→ nautilus
conversation is enough; don't manufacture options for
their own sake (see §6.1 on over-engineering).

### Pre-read

The pre-read pattern: before spawning the implementer
cuttlefish, spawn a **reviewer cuttlefish** with a prompt
asking it to read the brief + the relevant supporting
code, and report any blockers, should-fixes, or
confirmed-OK assertions.

**Why it works**: the nautilus is too close to the brief
it just wrote. A fresh reader catches:

- File paths that don't match reality
- Line numbers that drifted between sessions
- Functions the brief assumes exist but don't (or live in
  a different file than referenced)
- API surface assumptions that need verification
- Numeric baselines that have shifted (test counts, bundle
  sizes)
- Internal contradictions across brief sections
- Missing edge cases that the design conversation hadn't
  considered

**When to pre-read**: every dispatch M-sized and up. XS/S
is a judgment call — if the brief touches a file the
nautilus hasn't read recently, pre-read. If the brief is
genuinely pure mechanical work the nautilus has full
context on, can skip — but we've found that "I have full
context" is usually wrong, and pre-read pays off even on
S-sized dispatches.

**When NOT to pre-read**: ops-only dispatches with no
code (e.g., the OAuth publish runbook). The reviewer has
no privileged access to GCP Console; can't verify the
runbook steps against reality. Pre-read adds no value.

**How to spawn**: nautilus uses the Agent tool with a
purpose-built reviewer prompt. The prompt names the
brief, the supporting files to read, the specific checks
to run, and the report format (BLOCKING / SHOULD-FIX /
NITS / CONFIRMED-OK). Reviewer is explicitly told NOT to
modify any files.

**Real evidence**: across the recent dispatch arc,
pre-read has caught at least one real blocker on EVERY
dispatch where it ran. Examples:

- `reduceDraft.ts` didn't exist — reducer is inside
  `draftState.ts`. The brief referenced the wrong file 11
  times. Implementer would have failed cold.
- `getCountFromServer` is not in `firebase/firestore/lite`.
  The nautilus's pre-flight asserted 100% compatibility;
  pre-read found the one exception. Would have caused a
  TypeScript compile failure.
- A `saveRoute.ts` projection silently dropped two new
  fields. TypeScript wouldn't catch (fields were
  optional); pre-read spotted it by tracing data flow.

The cost-to-value ratio of pre-read is heavily favorable.
Skip with caution.

---

## 4. The fresh-head principle

Every markdown deliverable in projects derived from this
kit opens with the same preamble (project-name and
copyright year substituted in):

> [PROJECT_NAME] is built with Claude (Anthropic) as a
> continuous collaborator. The PRD, ARCHITECTURE doc, and
> most code are produced via human-AI pairing — the
> planning docs are written dense and self-contained so a
> fresh Claude session can cold-read and contribute
> immediately.

This is the operating norm, not boilerplate. The test
for any doc — brief, handoff, BACKLOG entry, even this
one — is: *if a fresh Claude session with no prior
context reads this, do they have enough to act?*

Practical consequences:

- **No conversational shorthand** in docs. "As we
  discussed" → name the decision and link the source.
- **Every brief restates context** the implementer needs,
  even if the nautilus thinks it's obvious.
- **Handoffs document what shipped** including the
  reasoning behind judgment calls, not just the diff.
- **BACKLOG entries grow with the conversation** — an
  item promoted from Later to Soon often gains 30-100
  lines of captured decisions before it's promoted to
  Next.

The owner can also be the "fresh head" — coming back
to a project after a week off, the docs should let them
reconstruct what was happening without trawling chat
history.

---

## 5. Operational conventions

Patterns that have emerged across dispatches and now
function as defaults. Deviation requires a reason; the
reason goes in the handoff.

**The BACKLOG entry IS most of the brief.** Items in
Later are sparse. As design conversations happen, the
entry accumulates decisions. By the time something is in
Next, the entry has settled most of the questions; the
brief mostly translates this into dispatch format
(required reading, ACs, gates, handoff guidance).

**AC prefix numbering** (e.g., S1, R2, T3). Each
subsection numbers independently from 1; the handoff
references ACs by prefix. Avoids MD029 ordered-list
warnings and makes status easy to scan
("S1-3 ✅, R1-5 ✅, T1-2 ✅").

**"Files in play" + "Files NOT to touch"** as explicit
lists in every brief. The latter is a guardrail; the
former is a budget. Implementer flags any deviation in
the handoff.

**"Stop and ask" section** in every brief. Explicit list
of situations that warrant pausing rather than guessing.
Examples: "If the rule helper conflicts with an existing
helper of the same name, stop and ask." "If Firestore
demands a composite index during testing, propose the
addition before adding it." Reduces failed-execution
costs by giving the implementer permission to surface
ambiguity.

**"When to swap back" tripwires** for reversible
non-trivial decisions. E.g., the Firebase tree-shaking
dispatch captures the conditions under which the
firestore/lite swap would need reverting (real-time
listener need, offline persistence need, etc.). The
tripwire stays in the BACKLOG entry's Done version
forward — future contributors see when a decision
should be revisited.

**Model tier fits the risk.** The nautilus picks the
cuttlefish's model per dispatch: **Sonnet** for mechanical
/ low-risk work (UI, pure-function refactors, doc edits),
**Opus** for security, Firestore rules, data-model, or
anything where a subtle wrong call is expensive — and for
pre-reads of that same surface. The chosen tier goes in
the brief's model line so it's an explicit decision, not a
default.

**Gates are non-negotiable.** `npm run lint`, `npm run
lint:md`, `npm test` (TZ-pinned), `npm run test:rules`,
`npm run build:dev`, `npm run build:prod`. All pass before
the handoff is written. If a gate fails, fix it; don't
paper over.

**Handoff before polish.** As soon as gates pass,
implementer writes the handoff — before doing any
"while I'm here" cleanup. This survives stalls (see §7).
Then do the BACKLOG move as the final step.

**No git commits by agents.** Nautilus and cuttlefish
never commit. Owner reviews and commits, period. The
git tree is the owner's source of truth.

---

## 6. Antipatterns we've learned to avoid

These are real lessons from real dispatches. Some of
them pull in opposite directions; that's noted
explicitly. The art is in the synthesis.

### 6.1 Over-engineering at brief time

The nautilus's instinct is to "design completely." This
sometimes produces a spec that's 5x what the owner
actually wants.

**Concrete example**: the Stage-then-commit dispatch
was originally designed as per-field staging
(WaypointList + MapEditor + parallel staging state +
~150 lines + 4 design questions). Owner's actual want
was a single session-level Cancel button next to Save
(~30 lines, 1 question). The over-engineered version
got drafted in detail before the owner read it and
said "this is way more complex than what I had in
mind."

**Mitigation**: when drafting a design conversation,
surface the simplest version first and explicitly ask
"is this enough?" before elaborating. The owner is the
backstop against over-spec; nautilus's job is to
present the cheap option, not assume the expensive
one is needed.

### 6.2 Ambiguous wording in briefs

Imperative-sounding language in a brief gets translated
literally by the implementer. Subtlety in the intent
gets lost.

**Concrete example**: the Waypoint notes/labels brief
said "Handler trims whitespace; empty string → null."
Intent was "if the value is effectively empty,
normalize to null." Implementer (correctly) translated
to `.trim()` on every dispatch, which stripped trailing
whitespace on every keystroke, making it impossible to
type spaces. Owner reported within minutes of shipping.

**Mitigation**: when an instruction has subtlety, say so
explicitly. "Trim only for emptiness check, store raw
value" is more precise than "trim whitespace." If a
brief's wording could be read two ways, the implementer
will pick the one the brief literally said.

### 6.3 The intentional tension between 6.1 and 6.2

These two pull in opposite directions:

- **6.1** says don't over-specify; leave latitude.
- **6.2** says don't under-specify; be unambiguous.

This conflict is real and unresolvable in the abstract.
The synthesis is **about WHERE precision matters**:

| Precision matters | Latitude is fine |
|---|---|
| Intent ("what is this trying to achieve") | Implementation details ("which loop construct") |
| Invariants ("X must hold after Y") | Component extraction ("inline vs. helper file") |
| Boundaries ("in scope / out of scope") | Variable naming, Tailwind class choice |
| Numeric thresholds chosen by design | Performance micro-optimizations |
| Naming of contracts (action names, props) | Comment wording |
| Field shape decisions (optional vs. required) | Test framework idiom (`it` vs. `test`) |

When a brief is precise about intent but loose about
implementation, the implementer can use judgment on the
"how" while the "what" is unambiguous. When a brief is
loose about intent, the implementer guesses — and the
guess is often wrong.

**Practical heuristic**: re-read the brief asking "if
the implementer reads each sentence the wrong way, does
the result still work?" If no, tighten that sentence.
If yes, you're done.

### 6.4 Skipping pre-read on "obviously simple" dispatches

Early in the working pattern, we'd skip pre-read on
S-sized work, reasoning that the cost outweighed the
value. We've stopped doing this. Pre-read has caught a
real blocker on every dispatch where it ran. The
cost-to-recovery ratio is much higher than the
cost-to-pre-read.

**Exception**: ops-only dispatches where the reviewer
has no privileged access (OAuth publish runbook,
deployment runbooks). Pre-read there is performative.

### 6.5 Implementer stream stalls

Periodically, an implementer cuttlefish's stream
times out mid-execution. Happened on Dispatch 1 (Admin
allowlist gate) and the Editor session-cancel
dispatch. Pattern: the code is complete; gates pass; the
stream stalls before the handoff doc is written.

This isn't a defect to fix; it's a property of the
system to plan around. See §7 for the recovery
protocol.

The instruction "write the handoff immediately when
gates pass" is the primary mitigation. If the
implementer finishes after writing the handoff, the most
important artifact survives. If it stalls before, the
nautilus has to reconstruct.

---

## 7. Stall-recovery protocol

When an implementer cuttlefish stalls (stream-watchdog
timeout), the nautilus runs this sequence:

1. **Don't immediately re-spawn.** Check current state
   first — file mod times in the last hour, `git status`
   if available, gate results. The implementer often
   completed the code before stalling.
2. **Run all five gates manually.** If they pass, the
   code is good; only housekeeping is missing.
3. **If gates pass**: write the handoff doc post-hoc as
   the nautilus. Spot-check the actual implementation
   against the brief (read the key files, verify the
   substantive decisions). Note the stall in the handoff
   ("Handoff written by the nautilus after the
   implementer cuttlefish completed the substantive
   code work but stalled before reaching the
   housekeeping steps.").
4. **If gates fail**: triage. If it's a small fix
   (typo, missing import), the nautilus can fix inline
   and proceed to step 3. If it's a structural issue,
   probably re-spawn the implementer with a continuation
   prompt referencing the partial state.
5. **Do the BACKLOG move** as the nautilus.
6. **Owner reviews + commits** as normal.

The handoff written post-stall is the same quality as
one written by the implementer — it just costs the
nautilus's time instead of the cuttlefish's. Owner sees
the same artifacts in the same locations.

---

## 8. Post-ship-fix protocol

After a dispatch ships, the owner sometimes finds a
small issue during validation. The protocol depends on
the size of the issue.

### XS fixes (inline, append to handoff)

If the fix is XS (a few lines, contained to the dispatch's
intended behavior space, doesn't change the brief's
scope), the nautilus fixes inline as a follow-up commit
and appends a "Post-ship fix" section to the original
handoff. No new dispatch.

**Examples we've used this for**:

- Auth record deletion: a small modal-state bug found
  immediately post-ship. One-line fix; appended to the
  handoff.
- Waypoint notes/labels: three XS adjustments shipped
  alongside the dispatch's main commit — spaces bug fix,
  threshold tuning (30m → 100m), trim-on-save. Each
  documented in the handoff.

The owner's framing on this (2026-05-23): "XS stays in
scope of where we started. M+ would justify deferring
to a future dispatch."

### S+ fixes — file a follow-up dispatch instead

If the post-ship issue would require S or larger to
address properly, **don't patch it inline**. File as a
follow-up item in BACKLOG. Reasoning:

- An S+ fix usually implies the original design missed
  something structural. Patching extends the original
  commit beyond its tested scope.
- Bisect signal — keeping each commit focused on one
  intent makes future debugging easier.
- The owner's review attention is targeted at the
  dispatch's scope when they reviewed it; an S+ patch
  appended post-hoc dilutes that review.

We haven't actually hit an S+ post-ship issue yet (the
biggest has been the spaces bug, which was XS), so this
boundary is theoretical. But the principle: if "patch
it real quick" starts to feel large, that's the signal
that "real quick" isn't the right response.

### M+ fixes — definitely a new dispatch

For M+ post-ship issues, the original dispatch's
implementation was working from an incomplete
understanding of the problem. A new dispatch with its
own design conversation + brief + pre-read is the
correct response. The original handoff still notes the
issue ("see follow-up dispatch X") for future
attribution, but the fix itself is its own
self-contained piece of work.

---

## 9. Tools and where they live

- **Briefs**: `dispatch/<name>.md` (per dispatch)
- **Handoffs**: `dispatch/<name>-handoff.md` (per
  dispatch, matched pair with the brief)
- **BACKLOG**: `BACKLOG.md` (project root; single file,
  all horizons + Done)
- **This doc**: `WORKING-MODEL.md` (project root)
- **Conceptual frame**: `CUTTLEFISH-NAUTILUS.md` (project
  root) — the long-form paper this playbook pairs with
- **Handoff structure spec**: `HANDOFF-TEMPLATE.md`
  (project root)
- **Codebase guardrails**: `AGENTS.md` (project root)
- **Product spec**: `PRD.md` (project root)
- **Architecture**: `ARCHITECTURE.md` (project root; not
  yet drafted — PRD §4 + AGENTS.md are the interim
  reference)

A typical dispatch leaves behind two files in
`dispatch/` (brief + handoff) plus one BACKLOG edit
(Next → Done with a substantive entry). Nothing else.

---

## 10. What this doc is NOT

- **Not a substitute for the cuttlefish/nautilus paper**,
  which establishes the conceptual frame (why this
  division of labor works, what makes a cuttlefish a
  cuttlefish). This doc is the practitioner's playbook
  that lives in the codebase.
- **Not a codebase guide**. AGENTS.md and ARCHITECTURE.md
  cover the project-specific patterns.
- **Not a template**. HANDOFF-TEMPLATE.md is the
  template. This doc explains the operating context.
- **Not exhaustive**. New patterns emerge; this doc
  updates as they do. Each major addition is itself a
  meta-decision worth a brief design conversation
  between nautilus + owner.

---

## 11. When to update this doc

When a new pattern earns its keep (used 2-3 times,
clearly distinct from existing patterns) — add it. When
an antipattern bites us multiple times — capture it.
When the synthesis of two existing patterns needs
naming — name it.

The maintenance cadence is opportunistic, not scheduled.
Owner can flag "we should update WORKING-MODEL with X"
during any session; nautilus drafts the addition,
owner reviews + commits.

---

End of working model.
