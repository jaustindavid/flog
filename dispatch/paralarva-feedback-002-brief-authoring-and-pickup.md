# Paralarva feedback 002: brief-authoring, first-dispatch friction, memory-file pattern

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

**From**: flog nautilus (2026-05-25, post-M1 ship).

**To**: paralarva-source nautilus, for kit incorporation.

**Companion to**: [`paralarva-feedback-agent-dispatch.md`](./paralarva-feedback-agent-dispatch.md)
(filed earlier today; covered the `worktree.bgIsolation: "none"`
fix that decouples agent dispatch from git posture).

---

## Summary

Three additional lessons surfaced from executing M1 (flog's first
dispatch). Each is generic enough to inform the kit beyond flog's
specifics. None require kit code changes — all three are README +
WORKING-MODEL + HANDOFF-TEMPLATE refinements.

1. **Describe requirements, not click paths.** Brief-authoring
   principle for any dispatch that touches external services.
2. **First-dispatch is special.** M1 (infrastructure) is
   structurally the highest-friction dispatch; the kit should set
   expectations accordingly.
3. **Auto-save memory files early.** During the owner interview is
   exactly the right moment; the next nautilus inherits cleanly.

---

## Lesson 1: Describe requirements, not click paths

### What happened

flog's M1 brief prescribed click-by-click paths through the Google
Cloud Console and Firebase Console (e.g., "APIs & Services → OAuth
Consent Screen → Get Started → ..."). During execution over a
single afternoon, **at least seven UI reorganizations were
encountered**:

- OAuth consent screen wizard condensed
- Test Users moved under an Audience tab
- OAuth Authorized Domains moved to a Branding sub-screen
- OAuth Authorized Domains validation tightened (apex + `localhost`
  rejected)
- OAuth JS Origins / Redirect URIs moved to a "Clients" tab
- Firebase Auth panel moved from Build to Security
- Firestore and Hosting moved to new top-level sections (Databases
  and Hosting & Serverless respectively)

Briefs that prescribe click-paths go stale fast. Briefs that
describe **requirements** stay correct forever.

### The principle

For any dispatch step that touches an external UI:

- **Lead with the requirement** — what state the system must be in
  after this step. ("OAuth consent: External user type, Testing
  mode, no logo, family Gmails as test users.")
- **Optionally include a dated current-UI breadcrumb** — the
  current path, marked with the date it was last verified.
- The executor finds requirement-shaped controls through the
  current UI's labels and tabs. The brief doesn't have to
  hand-hold; it has to set the destination.

### Recommended kit changes

Add a "Brief-authoring principles" section to `HANDOFF-TEMPLATE.md`
(or create a new `BRIEF-TEMPLATE.md` if one doesn't exist) with the
pattern:

```text
G3 — OAuth consent screen

Requirement: External user type, Testing mode, no logo uploaded,
test users = family Gmails, support email is a Google-managed
mailbox.

Current path (2026-05-25): APIs & Services → OAuth Consent
Screen → Overview → Get Started; test users under Audience tab.
```

Two-section pattern: stable requirement, dated breadcrumb.
Updating future runbooks becomes "refresh the breadcrumb," not
"rewrite from scratch."

Also worth flagging in `WORKING-MODEL.md` antipatterns (§6 or a
new §6.x): "Briefs that hand-walk an external UI age out quickly;
describe the requirement, point at the current path with a date,
expect the executor to navigate."

---

## Lesson 2: First-dispatch is highest-friction

### What happened

flog M1 had:

- ~7 GCP/Firebase UI drifts mid-execution
- Multiple kit-deviation entries in the handoff (hand-authored
  Vite scaffold, no Tailwind config files, `.markdownlintignore`
  removal, MD049/050 disabled, etc.)
- Real-time troubleshooting via chat (e.g., the `firebase init`
  prompt; the GCP auto-suffix recurrence after explicit warning)
- The Route7 cross-nautilus consult cycle, which added findings
  before execution
- The `worktree.bgIsolation` discovery, which couldn't have been
  pre-empted by the brief

Total time was several multiples of the M1 row's implied budget
in PRD §10.

### The pattern

M1 (infrastructure) is structurally different from M2+:

- **M1**: external services, multi-step console work, identity
  and security setup, env-file wiring, cross-nautilus consults,
  first-time tooling questions. The brief is a starting point,
  not a complete runbook.
- **M2+**: inside a known harness. Brief structure proves itself.
  Cuttlefish dispatch works. Subsequent dispatches will be much
  faster.

The kit's WORKING-MODEL.md describes the lifecycle but doesn't
flag this asymmetry.

### Recommended kit changes

Add a "Notes on M1" subsection to `WORKING-MODEL.md` (or to the
README's §step-4 "Settle infrastructure questions"):

- "**Expect M1 to take longer** than the per-milestone budget
  suggests. 2-4× is typical, depending on infrastructure
  complexity."
- "**The Route7 (sibling-reef) consult is non-negotiable** for the
  M1 brief. The kit's cross-nautilus pattern exists specifically
  for this dispatch."
- "**Document deviations liberally** — first-dispatch is when the
  brief-vs-reality gap is widest. The handoff doc's
  'Deviations from dispatch' section earns its keep here above
  all others."
- "**Real-time troubleshooting via chat is expected** during M1
  execution. The brief is starting material; chat is where the
  brief becomes operational."
- "**§15 'Cross-project feedback channel' will populate
  heavily** during M1. Plan to file rakes / drifts as they occur,
  not at end-of-dispatch."

These set honest expectations and prevent the new nautilus (or
the owner) from interpreting M1's friction as a process failure.
It's the process working.

---

## Lesson 3: Auto-save memory files early

### What happened

flog's nautilus saved three memory files during the PRD interview
(within the first ~30 turns of the session):

- `user_austin.md` — owner identity, role, sibling project (Route7),
  collaboration model
- `feedback_collaboration.md` — owner's preferences (lead with
  intent, flag assumptions, push back on inconsistency)
- `project_flog_bootstrap.md` — project state at hatch time;
  decisions captured so far; updated as the session progressed

Plus a `MEMORY.md` index pointing at the three.

These files cost ~5 minutes to write at the time. The payoff: when
this session ends (planned end-of-M1 retirement, since the harness
can't spawn agents in this session), the next nautilus starts with
those memories auto-loaded. Cold-read time for "who is the owner,
what's the project, what's the working style" drops from 30+
minutes (re-reading every doc + the chat transcript) to seconds.

### The pattern

The kit's README §step-2 (owner interview) is the **single best
moment** to seed memory files:

- Owner identity surfaces immediately ("This is for my family, 4
  users, 4-5 cars" → user memory)
- Collaboration preferences come up naturally ("Lead with intent,
  flag assumptions, push back" → feedback memory)
- Project state accumulates as decisions land ("v0 is fuel-only;
  Google OAuth + allowlist; cars owned by users with shares" →
  project memory)

Without explicit kit guidance to save these, the first nautilus
might do it; the second might not; the third forgets entirely. By
the time someone notices, the next-session pickup is rough.

### Recommended kit changes

Add to README §step-2 or as a new §step-2.5:

> As the owner interview proceeds, save initial memory files. At
> minimum:
>
> - `user_<owner-name>.md` — owner identity, role, related/sibling
>   projects
> - `feedback_collaboration.md` — owner's stated collaboration
>   preferences
> - `project_<name>_bootstrap.md` — project state at hatch;
>   evolves as decisions accumulate
>
> Maintain `MEMORY.md` as the index. These files are auto-loaded
> by fresh sessions; cold-start time for any future nautilus drops
> dramatically when they exist.

No template files needed — the convention is to write them in
plain prose, with reciprocal `[[link]]` references and a
short metadata header. The kit could optionally ship example
files in `paralarva/memory-examples/` but the existence-of-the-
convention is the load-bearing part, not the structure.

---

## What these three lessons share

All three reduce friction for future paralarva projects:

| Lesson | Reduces friction for | How |
|---|---|---|
| L1 (requirements not click paths) | Future dispatches with external UIs | Briefs stay correct as UIs drift |
| L2 (M1 is special) | The owner + new nautilus during M1 | Honest expectations prevent panic / scope creep |
| L3 (memory files early) | Future sessions of the same project | Cold-start is cheap, not expensive |

None of them require kit code changes. All three are documentation
refinements (README, WORKING-MODEL, HANDOFF-TEMPLATE).

---

## Provenance

- **flog reef** — first paralarva-hatched project; encountered all
  three frictions during M1 execution (2026-05-24 through
  2026-05-25)
- **Route7 nautilus** consulted on the M1 brief; reviewed and
  refined before flog executed. The cross-reef review pattern
  worked exactly as the kit's README describes.
- **This document** + the earlier
  [`paralarva-feedback-agent-dispatch.md`](./paralarva-feedback-agent-dispatch.md)
  together cover what flog learned during its first dispatch arc.

End of feedback 002.
