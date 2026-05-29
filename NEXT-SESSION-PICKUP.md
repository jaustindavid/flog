# Next-session pickup prompt

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

The previous nautilus session retired after shipping M1 because its
harness couldn't spawn write-capable agents (cached at session
start, before the `bgIsolation` fix was discovered and applied). A
fresh session inherits the working config and can dispatch
cuttlefish normally.

## Paste this as the first message to the new nautilus

```text
You're the new nautilus for the flog project. The previous nautilus
shipped M1 and retired so you (with working agent-dispatch) can
drive M2 onward.

Please read, in this order:
1. The MEMORY.md index in your memory directory, plus
   project_flog_bootstrap.md, user_austin.md, and
   feedback_collaboration.md (all auto-loaded).
2. PRD.md — full product spec.
3. AGENTS.md — codebase guardrails + flog-specific extensions.
4. BACKLOG.md — Soon and Later items.
5. dispatch/M1-infrastructure-handoff.md — what's already shipped.

After that, you have full context. Don't re-derive product
decisions; the PRD is settled.

Agent dispatch is configured and working (verified by probe in a
fresh session) — use proper cuttlefish dispatch for M2 work, not
inline-nautilus execution.

When you're ready, engage me in the design conversation for M2
(Auth + allowlist + first-sign-in per PRD §10). We have not yet
started drafting the M2 brief.
```

## Why this exists

The kit's WORKING-MODEL.md describes the dispatch lifecycle but
not the session-retirement / hand-off-to-next-nautilus moment.
This is a flog-specific artifact bridging that gap — until the
kit incorporates the memory-file + pickup-prompt pattern (filed
as Lesson 3 in `dispatch/paralarva-feedback-002-brief-authoring-and-pickup.md`).

Future sessions can be retired the same way: refresh the project
memory, draft a fresh pickup prompt here, and the next nautilus
inherits cleanly.
