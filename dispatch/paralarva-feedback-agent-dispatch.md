# Paralarva feedback: enable agent dispatch without requiring git

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

**From**: flog nautilus (2026-05-25). flog is the first project
hatched from the paralarva kit; this feedback addresses friction
encountered at M1 (first ops dispatch).

**To**: the paralarva-source nautilus, for incorporation into the
kit's setup instructions.

---

## Summary

The paralarva working model depends on the nautilus being able to
spawn cuttlefish via the Agent tool. By default, the Claude Code
harness isolates dispatched (write-capable) subagents in a git
worktree — which fails when the project has no git repo, and
silently degrades the working model even when git is present
(cuttlefish writes land in an isolated worktree under
`~/.claude/worktrees/` instead of the main tree).

This conflates two independent concerns: **source control** (a
project-level decision the owner makes on their own cadence) and
**agentic development infrastructure** (a kit requirement). The kit
should configure the latter explicitly at hatch time, so the
cuttlefish/nautilus pattern works regardless of git posture.

---

## What flog encountered

- Owner declined to set up git for the project at hatch time
  (planned to handle source control externally, manually, on their
  own cadence).
- M1's first cuttlefish-dispatch attempt (for the scaffold/deploy
  phase) failed with: *"Cannot create agent worktree: not in a git
  repository and no WorktreeCreate hooks are configured."*
- `git init` plus an empty bootstrap commit unblocked subsequent
  sessions (worktree creation needs a HEAD).
- Even with git, the cuttlefish was placed in an isolated worktree
  under `~/.claude/worktrees/`, which doesn't match the working
  model's assumption that cuttlefish edit files in the main tree
  and the owner commits between dispatches.

---

## Root cause

`worktree.bgIsolation` in Claude Code's `settings.json` defaults to
`"worktree"`. With that default, dispatched/background agents get
isolated in a separate worktree and their writes don't reach the
main checkout until an explicit merge step.

The Route7 reef (the original cuttlefish/nautilus project) operates
with cuttlefish editing the main tree directly — owner commits
between dispatches. flog expected the same and didn't get it. The
kit didn't surface that this requires explicit configuration.

---

## The fix

One file, two lines of JSON. Create at hatch time:

```text
.claude/settings.local.json
```

```json
{
  "worktree": {
    "bgIsolation": "none"
  }
}
```

Effect: dispatched cuttlefish run directly in the project's working
directory. No git required, no worktree merge step, matches
Route7's proven model.

Also add to `.gitignore` (if/when one exists; otherwise note for
later):

```text
.claude/settings.local.json
```

(Per-machine setting; never committed.)

---

## Recommended changes to the paralarva kit

1. **Add the setup step to the README's "How to hatch" flow.**
   Before any agent dispatch is attempted — so: before Step 5
   ("First product dispatch") — the new nautilus or owner must
   create `.claude/settings.local.json` with the `bgIsolation:
   "none"` setting. Likely a new Step 4.5 ("Configure agent
   dispatch") between "Settle infrastructure questions" and "First
   product dispatch."

2. **Decouple this from any git-posture conversation.** The
   README's §step-2 owner interview should NOT ask about git
   posture in service of agent dispatch. Source control is the
   owner's independent decision. The dispatch infrastructure works
   regardless.

3. **Update `AGENTS-TEMPLATE.md`** to mention the setting under
   a "Project setup" or "Working model" subsection with a one-line
   rationale: *"Cuttlefish dispatched via the Agent tool edit files
   in the main tree; this matches the Route7 proven model and is
   enabled by `worktree.bgIsolation: "none"` in
   `.claude/settings.local.json`."*

4. **Optional but recommended: ship a starter `.claude/` folder
   inside the paralarva kit** containing the required
   `settings.local.json`. Copying paralarva then brings the right
   config along for free. Trade-off: any project-specific overrides
   the owner wants would need to merge with the starter, not
   replace it — fine for this minimal config; revisit if the
   starter grows.

---

## What NOT to do

- **Do not make git a requirement of the kit.** Source-control
  posture (git or not, when to commit, branching) is a
  project-level choice. The working model must function
  regardless.

- **Do not recommend `WorktreeCreate` / `WorktreeRemove` hooks**
  as the fix. Those exist for projects that genuinely want
  isolation but use a non-git VCS. The cuttlefish/nautilus model
  doesn't want isolation at all — cuttlefish editing the reef
  directly is the point.

- **Do not conflate "agent dispatch broken" with "git missing."**
  The Claude Code error message ("Cannot create agent worktree:
  not in a git repository...") points to a git fix, but the actual
  right fix is the `bgIsolation` setting. The kit should preempt
  this confusion in its setup docs.

---

## Verification (suggested for the kit's docs)

After creating the settings file, in a **fresh** Claude Code
session in the project directory (existing sessions cache the
setting at startup and won't pick up the change):

> *Spawn an agent to create file `dispatch/agent-probe.txt` with
> content `ok`. Then verify it exists at that path in the main
> tree.*

If the agent succeeds AND the file appears at the project's path
(not under `~/.claude/worktrees/`), the configuration is working.
The agent should NOT prompt about writing outside the tree.

Clean up with `rm dispatch/agent-probe.txt` afterwards.

---

## Provenance

- **flog reef** (2026-05-25) — first paralarva-hatched project,
  hit this friction at M1.
- **Route7 nautilus** consulted during M1 brief review; Route7's
  working config has presumably had `bgIsolation: "none"` all
  along (visible only in per-project local settings; never
  surfaced as a setup step).
- **Fix discovered** via the `update-config` skill's Claude Code
  settings schema reference — `worktree.bgIsolation` field
  description literally captures the intent: *"'none' lets
  background jobs edit the working copy directly."*

End of feedback.
