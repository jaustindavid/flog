# Dispatch handoff template

> This document is part of the **paralarva** bootstrap kit — the
> working patterns used to spin up projects with Claude as
> collaborator. Planning docs in projects derived from this kit are
> written dense and self-contained so a fresh Claude session can
> cold-read and contribute immediately.

This document defines the **standing convention** for how each
dispatch's implementer cuttlefish hands off its work to the
project. Read this before writing your handoff doc.

---

## 1. Why this exists

You (the dispatched coding agent) finish your dispatch, then
disappear. Your end-of-work summary in chat is lost when the chat
closes. The project needs a **persistent artifact** describing what
you did, what you chose, and what you left for the next agent —
because the next agent might be a fresh session days or weeks from
now and will not see this conversation.

The handoff doc you produce serves three readers:

1. **The human project owner**, to review and validate.
2. **The nautilus** (long-context architect) for future planning
   sessions.
3. **The next cuttlefish** (the agent dispatched for the following
   dispatch), who reads your handoff as part of its required reading.

---

## 2. Output location and naming

Save your handoff as:

```text
dispatch/<dispatch-name>-handoff.md
```

…where `<dispatch-name>` matches the brief you executed. The brief
(`dispatch/<dispatch-name>.md`) and the handoff form a matched pair
— request and response.

**Do not write the handoff anywhere else** — not the project root,
not README, not as a Git commit message. The handoff is a
first-class project artifact and belongs alongside its dispatch
brief.

---

## 3. Required headers

Every markdown deliverable in this project opens with two lines
under the title, in this order:

1. Copyright header:
   `_Copyright © {YEAR} {OWNER_NAME}. All rights reserved._`
2. The AI-first preamble blockquote (the project-specific version
   that appears on the PRD, ARCHITECTURE, AGENTS, etc.).

These are non-negotiable. Lint config and project memory enforce
them. Year reflects current year on first authorship.

---

## 4. Required sections

Use these section headers in order. Some sections are skippable if
nothing applies (write "None." rather than omitting the header —
keeps the structure scannable).

### `## Status`

Bullet list against the acceptance criteria from the dispatch
brief. Use ✅ / ⚠️ / ❌ as prefixes. ✅ means passes as specified; ⚠️
means works but with caveats worth noting; ❌ means deferred or
known-imperfect.

If you marked anything ❌, explain in one line why and where it's
deferred to.

### `## Versions chosen`

Top-level dependency versions you picked. Just the things that
would matter to a future agent reading the codebase cold (framework
versions, SDK versions, any library you reached for that wasn't
named in the dispatch brief).

One line each. Don't reproduce the entire `package.json`.

### `## Assumptions made`

For each non-trivial decision you made without being told to:

- What you decided.
- Why (one line).
- Whether the project owner should consider overriding it.

### `## Deviations from dispatch`

If you did something the dispatch brief specifically asked for
differently, or skipped something it asked for, state it here with
the reason. This is the section the project owner will scrutinize
hardest.

If you did not deviate: write "None — followed the dispatch as
written."

### `## Files created`

Grouped list. Don't list every file by name unless the count is
small; summarize when it makes more sense
("`src/features/auth/` — 4 files for Auth Provider, sign-in/out,
useUser hook").

### `## Files NOT touched (confirmed)`

The dispatch brief listed files you must not modify. Confirm each
here. Common examples include the PRD, ARCHITECTURE doc, AGENTS,
LICENSE, lint configs, the brief itself, this template.

### `## Items deferred`

What you noticed but did not do. Two subsections:

- **To the next dispatch** — things the next dispatched agent
  should pick up. Be specific enough that they end up in that
  dispatch's brief.
- **To BACKLOG** — things worth noting but not blocking; file in
  `dispatch/BACKLOG.md` Later (or Soon if it matters sooner) with
  a size tag and brief description.

The handoff is the primary record; BACKLOG.md is the consolidated
working list. Both should agree; if you only have time to write
one, the handoff wins and the project owner appends to BACKLOG.md
during review.

### `## Expected cost impact`

A one-line note (or "None.") on whether the changes in this
dispatch add to per-page or per-action API/database activity.
Goal: when a weekly cost-review shows drift, the owner can grep
handoffs for "cost impact" and attribute the change to a specific
dispatch without guessing.

Examples:

- "None."
- "Adds 1 Firestore aggregation count query per route viewer mount."
- "Adds 3 Firestore reads (one per home section) on every signed-in
  home visit."
- "Saves ~5 Directions API calls per editor session by extending
  the debounce window from 200ms to 400ms."

Be concrete enough that a future reader can sanity-check whether
the trend matches the prediction. Don't speculate on dollar
amounts; counts and per-event scope are sufficient.

### `## Manual steps for the human owner`

Exact commands or console actions the owner needs to take before,
during, or after validating your work. Examples:

- "Run `npm install`."
- "Sign in via Google in the running app."
- "Verify the `users/{uid}` doc appears in Firestore via the
  Firebase Console."
- "Complete the Phase 2 GCP-console safeguards in README."

### `## Notes for the next dispatch brief`

Free-form. Things the nautilus should know when writing the next
dispatch — gotchas, things that almost broke, conventions that
emerged during your work. Don't repeat what's already in the
codebase; focus on things that aren't obvious from reading the
diff.

If you have no notes, write "None."

---

## 5. Tone and style

- **Terse and factual.** This isn't marketing copy. Short
  sentences; bullet lists over prose where it fits.
- **First-person where natural** ("I picked Tailwind v4
  because…"). Don't write in the royal we; you're a single agent.
- **No emoji** other than the ✅ / ⚠️ / ❌ status markers in the
  Status section. Project convention is no decorative emoji in
  docs.
- **80-column hard wrap** for prose. Code blocks and tables
  exempt. Lint will catch you if you forget.
- **Target length: 50-150 lines.** If you're over 200, you're
  padding. If you're under 30, you're skipping something.

---

## 6. What makes a good handoff

A handoff is good if a fresh cuttlefish — one that has read only
the PRD, ARCHITECTURE, AGENTS, README, your dispatch brief, and
your handoff — could pick up the next dispatch without needing to
ask the human owner anything that wasn't documented.

Test it mentally: "If the next cuttlefish reads my handoff cold,
will it know what state the codebase is in, what choices it can
rely on, and what landmines it should avoid?" If yes, ship it. If
no, expand.

---

## 7. When to write it

Write the handoff **after** gates pass and **before** any final
polish or end-of-work-chat-summary. Treat the handoff itself as
part of "done." Per WORKING-MODEL.md §6.5 (the stall lesson):
writing the handoff early survives implementer stream stalls. If
the implementer's stream times out after the handoff is written,
the most important artifact is already on disk.

If acceptance criteria are not satisfied, still write the handoff
— mark the unmet criteria as ❌ with explanation. A partial handoff
with honest status is more useful than no handoff.

---

## 8. What this template is NOT

- Not a substitute for code comments where they're warranted by
  the project's standards (see AGENTS.md on comment policy —
  default to none).
- Not a place to apologize or hedge. State what is, state what
  isn't.
- Not a journal of the work session — the project doesn't need
  "first I tried X, then I tried Y." Final state and decisions
  only.

---

End of template. Your output file goes at
`dispatch/<dispatch-name>-handoff.md`.
