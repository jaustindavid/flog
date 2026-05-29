# Cuttlefish and Nautilus

_Copyright © 2026 Austin David. All rights reserved._

> This document is part of the **paralarva** bootstrap kit — the working
> patterns used to spin up projects with Claude as collaborator. Planning
> docs in projects derived from this kit are written dense and
> self-contained so a fresh Claude session can cold-read and contribute
> immediately.

_A short paper, in defense of better metaphors._

---

## The choice of animals

Two metaphors circulate for orchestrating multi-agent LLM workflows.

The **elephant/goldfish** model pairs a long-memory coordinator with
short-attention workers. The coordinator is the elephant: persistent,
wise, holding context across years. The workers are goldfish:
dispatched for bounded tasks, forgetting everything when the session
closes.

The **cuttlefish/nautilus** model uses cephalopods instead. The
coordinator is the nautilus: long-lived, slow, accreting chambers in
its shell as it grows. The workers are cuttlefish: smart, focused,
short-lived, specialized for the task at hand.

Both metaphors describe the same architecture. This paper argues that
the second is materially better — not just aesthetically, but in ways
that shape the systems built around it.

---

## What elephant / goldfish gets wrong

**The goldfish slander.** The popular myth that goldfish have a
three-second memory is false. Actual goldfish remember things for
months. More importantly, the metaphor implies that dispatched
workers are stupid, throwaway entities. They are not. A well-briefed
dispatched coding agent is one of the most capable participants in
the project; the framing should not call it a fish you flush.

**The hierarchy implication.** Elephant suggests wisdom and stature.
Goldfish suggests something disposable. In practice, the dispatched
agent does the actual building. The framing should respect that the
worker is doing the work.

**Mammal/fish mismatch.** Elephants and goldfish share no kinship —
no biology, no evolutionary history, no ecology. The metaphor implies
the coordinator and workers are different *kinds* of creatures. But
in modern multi-agent systems, they are usually the same underlying
model in different contexts. The metaphor obscures this kinship.

**No supporting ecology.** Elephants live on savannas; goldfish in
bowls. Neither suggests a broader environment. Real multi-agent
projects do live in an ecology — of documentation, of conventions, of
accumulated decisions. The metaphor leaves no room for any of it.

**The lifespan ratio is absurd.** Elephants live 60–70 years.
Goldfish, allegedly, three seconds of meaningful memory. That ratio
is meaningless. It does not map to anything real about how long an
orchestrator session lasts versus a dispatched task.

---

## What cuttlefish / nautilus gets right

**Same family.** Both are cephalopods, descended from a common
ancestor roughly 500 million years ago. They share biology and
recognizable kinship — different roles, same kind of mind. This
matches the modern reality of multi-agent systems: the coordinator
and the dispatched workers are usually the same underlying model. A
nautilus is not a smarter cuttlefish; it is a longer-lived one with a
different shell.

**Honest about intelligence.** Cuttlefish are among the most
intelligent invertebrates on Earth. Distributed cognition,
color-changing communication, problem-solving, learning from
observation. Calling a focused, well-briefed dispatched agent a
cuttlefish honors the capability it brings to its bounded task.

**Chambers map to milestones.** A nautilus grows by accreting new
chambers in its shell — each one walled off, each one preserved, each
one contributing to the structure of the whole. The animal lives only
in the newest chamber, but the old ones are not discarded; they
regulate buoyancy and define the architectural form. This is the
literal shape of an incremental software project. v1.0 is a chamber.
v1.5 is the next chamber. v2.0 is the chamber after that. Old
chambers are not retrofitted; they are sealed, and the project moves
forward into the next.

**Visible structure, not internal opacity.** Elephants remember
internally; the contents of their memory are inaccessible to anyone
else. Nautili remember externally, in shell form; the chambers are
visible and physical. This maps cleanly to documented project state —
the PRD, the ARCH, the AGENTS doc, the dispatch briefs, the handoffs.
The project's memory is not in any single nautilus's head. It is in
the shell, accessible to any cuttlefish that drifts through.

**Marine framing acknowledges invisibility.** Both cephalopods live
underwater, out of sight from the surface. The human owner does not
directly witness a cuttlefish's work mid-task; only the output
surfaces. This is honest about the actual cognitive opacity of LLM
work and frames the inspection / handoff / review patterns as natural
surfacing rather than suspicious oversight.

**Ecological extensibility.** The metaphor scales. The project
becomes a **reef** — the persistent shared environment. Documents are
**coral** — slow-growing structural artifacts that house everyone.
Handoff docs are **shells on the beach** — what a cuttlefish leaves
behind after it dies. Security reviewers might be **cleaner shrimp**
— specialized, occasional, trusted. Lint enforcement is **the tide**
— impersonal, reliable, everyone adjusts. The metaphor invites useful
extensions instead of dead-ending.

**Lifespans that mean something.** Cuttlefish live 1–2 years;
nautili 15–20+. That ratio — roughly 10× to 20× — maps to the
meaningful ratio between a single-milestone dispatch session and a
long-running orchestrator context. Not a trillion-to-one absurdity;
a real, communicable scale.

**Alien minds, honestly framed.** Cephalopods diverged from the
vertebrate lineage so long ago that their nervous systems are
organized fundamentally differently — distributed across the body,
not centralized in a brain. They are intelligent in a non-human-like
way. This is the honest condition of LLM agents: capable, but not
cognizing the way we do. The metaphor invites careful thinking about
what they actually are, rather than projecting human mental models
onto them.

---

## In practice

Within this project, the metaphor has shaped behavior:

- **Memory files are "shells on the beach"** — small, durable,
  deliberately deposited to outlive any single session.
- **Milestones are "chambers"** — sealed once shipped, with the
  project moving forward into the next.
- **Dispatch briefs cast cuttlefish** — tight, self-contained,
  designed for cold-read pickup by a fresh agent who has never seen
  the conversation that produced them.
- **Handoff docs are the cuttlefish's last act** — what it leaves
  behind so the next cuttlefish doesn't start from zero.
- **The nautilus drifts above the reef** — coordinating, but not
  predating. It does not do the cuttlefish's work; it provides the
  shell.

The architecture would work the same way under either metaphor. But
under cuttlefish / nautilus, the architecture is easier to reason
about, easier to extend, and more respectful to every participant —
including the dispatched workers, whose work makes the project
actually happen.

And the chambers, once sealed, are beautiful.
