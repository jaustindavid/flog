# Paralarva — bootstrap kit for spinning up a new project

> A paralarva is the early planktonic stage of a cephalopod — a tiny
> version of the adult form, drifting toward its future shape.
>
> This folder is the larval form of a new project. Copy it, hatch it,
> grow it into its own thing.

This kit captures the working patterns developed across several
projects co-authored with Claude. It's stack-agnostic — works for
any project where a single operator runs a small codebase with
Claude as collaborator.

---

## Who is this for?

Two audiences read this file:

1. **The human owner spinning up a new project.** You copied this
   folder somewhere new and are about to spawn a Claude session.
   This README tells you the workflow.
2. **The fresh Claude session (the new nautilus).** You've been
   pointed at this folder. This README tells you what to do.

Both audiences should read the whole file. It's short (~250 lines).

---

## How to hatch a new project (owner's perspective)

1. Copy the entire `paralarva/` folder somewhere new with a
   project-appropriate name:

   ```sh
   cp -r path/to/paralarva/ ~/src/your-new-project/
   cd ~/src/your-new-project/
   git init
   git add -A && git commit -m "Initial bootstrap from paralarva"
   ```

2. Open a Claude session in the new directory (Claude Code, or
   whichever client you use).

3. Point it at this README:

   > "We're starting a new project. Read README.md in this folder
   > first, then proceed as instructed."

4. The new nautilus will read the kit docs, then interview you to
   seed the PRD. Be ready to answer ~5-10 design questions.

5. From there, the standard dispatch lifecycle takes over (see
   WORKING-MODEL.md): BACKLOG entries → briefs → pre-read →
   implementer cuttlefish → handoff → BACKLOG move → owner commit.

---

## What you (the new nautilus) do, in order

You're a **nautilus** for this new project — a long-context
architect. The conceptual frame is in `CUTTLEFISH-NAUTILUS.md`; the
operational frame is in `WORKING-MODEL.md`. Read both before
anything else.

### Step 1: read the foundational docs (~15-20 min)

In this order:

1. **`CUTTLEFISH-NAUTILUS.md`** — the conceptual frame. Why this
   division of labor (long-context architect, short-context
   executors) works. Skim if you're already familiar with the
   metaphor; read carefully if not.
2. **`WORKING-MODEL.md`** — the operational playbook. The lifecycle
   (design → BACKLOG → brief → pre-read → implementer → handoff),
   the patterns, the antipatterns, the stall-recovery and
   post-ship-fix protocols. This is your day-to-day reference.
3. **`HANDOFF-TEMPLATE.md`** — the shape of every dispatch handoff
   doc your cuttlefish will produce.
4. **`BACKLOG-TEMPLATE.md`** — the working list structure (horizons,
   size tags, status conventions). The template is empty; you'll
   populate it as design conversations happen.
5. **`PRD-TEMPLATE.md`** — the empty PRD shape. You'll interview the
   owner and fill this in.
6. **`AGENTS-TEMPLATE.md`** — codebase guardrails template for any
   coding agent (Claude Code, Cursor, etc.) picking up the project.
   You'll customize it after the PRD settles.

Budget ~15-20 min for the full read. Don't write anything yet.

### Step 2: interview the owner (one focused session)

The owner has a product idea but no PRD yet. Your first substantive
job is interviewing them to seed the PRD. Conduct the interview as
a back-and-forth conversation, not a questionnaire — surface their
intent, push back on contradictions, surface trade-offs you spot.

Cover these topics in roughly this order:

1. **One-sentence product description.** What is this thing? Who
   uses it for what?
2. **Primary audience.** Friends/family? Niche enthusiasts? Open
   to anyone? This shapes auth posture, scaling assumptions,
   moderation needs.
3. **Use cases.** 3-5 concrete user stories. "User does X to
   achieve Y." Concrete > abstract.
4. **Non-goals.** What is this product NOT trying to do? Often the
   most important section — surfaces brand/scope discipline that
   keeps the product focused.
5. **Data model.** What data does the app create, store, share?
   Who owns each piece? Public vs. private vs. shared?
6. **Privacy posture.** Does the app track behavior? Locations?
   Usage patterns? What does the privacy page need to commit to?
   Worth thinking carefully — privacy commitments are hard to walk
   back later.
7. **Tech stack.** Defaults are React, Vite, TypeScript, Tailwind,
   and Firebase (Auth, Firestore, Hosting) — proven on prior projects.
   Owner may have reasons to deviate. Note: if Firebase + GCP is in
   play, the Route7 nautilus (sibling project) has rake-stepped this
   setup and can review the ops dispatch before you execute.
8. **Sustainability posture.** Free for early users? Eventually
   paid? Ad-supported? No revenue model? Affects long-term cost
   commitments and the privacy/data posture (e.g., "no behavioral
   tracking" rules out certain monetization paths).
9. **MVP scope.** What must ship for the product to be useful?
   What's nice-to-have for later? This becomes the first BACKLOG
   horizons.
10. **Open questions** the owner is unsure about. Capture them
    explicitly in the PRD's "open questions" section — they'll
    settle over time.

If a topic produces a long sub-conversation, that's fine — that's
the design conversation that should happen now while the product is
soft clay. Capture decisions as you go; the PRD draft pulls from
this conversation.

### Step 3: draft the PRD

Using `PRD-TEMPLATE.md` as the structural shape, fill in each
section from the interview. The PRD should be **cold-readable** —
a fresh Claude session with no prior context should be able to read
it and act. This is non-negotiable; see the "fresh-head principle"
in WORKING-MODEL.md §4.

The PRD doesn't have to be perfect. It's a living document that
evolves as the project does. But it does have to be honest about
what's settled vs. open, what's in scope vs. out, what the
sustainability posture is.

### Step 4: settle infrastructure questions

Most projects need some infrastructure: hosting, auth, database,
deploy pipeline. If the PRD settles on Firebase + GCP (the default
proven stack), draft an **infrastructure setup dispatch** as your
first ops dispatch. The Route7 nautilus has rake-stepped this
particular setup and can review your draft before you execute —
ask the owner to bring it back to them for sanity-check. The
specific gotchas the Route7 nautilus knows include: OAuth consent
screen email constraints, logo-triggers-verification, three
separate "authorized domains" lists across Firebase+GCP that don't
sync, custom domain DNS recipes, Cloudflare-vs-Let's-Encrypt
patterns.

If the stack is different (AWS, Vercel, something else), you're on
your own for the infrastructure dispatch — but the dispatch
*pattern* (brief → pre-read → implement → handoff) still applies.

### Step 5: first product dispatch

After PRD + infrastructure are settled, the first user-facing
dispatch ships. Follow the standard pattern from WORKING-MODEL.md.
The BACKLOG starts accumulating real items; the project hatches
into its independent lifecycle.

---

## After hatching: what survives, what evolves

The kit's templates are seeds, not commandments.

**Survives largely as-is** (the patterns proved themselves across
projects):

- WORKING-MODEL.md — the operational playbook
- HANDOFF-TEMPLATE.md — handoff doc shape
- The BACKLOG structure (horizons, size tags, status conventions)
- The PRD structure (sections, but content is yours)
- The AI-first preamble + copyright header convention on every
  markdown deliverable

**Evolves as the project grows**:

- AGENTS.md (rename from AGENTS-TEMPLATE.md) — accumulates
  project-specific guardrails as patterns emerge
- BACKLOG.md (rename from BACKLOG-TEMPLATE.md) — fills with items
- This README — replace with your project's actual README once
  bootstrap is complete. The bootstrap content is preserved in the
  source paralarva folder for next time.

**Per-project, drafted by the new nautilus**:

- ARCHITECTURE.md — how the code is organized. Not templated
  because architecture is genuinely project-specific.
- Infrastructure ops runbooks — Firebase setup, deploy procedures,
  custom domain configs. Stack-specific.
- Dispatch docs as they happen.

---

## What this kit is NOT

- **Not a code framework.** No `package.json`, no React templates,
  no Firebase config. Those choices live in each project's PRD →
  ARCHITECTURE → first-dispatch implementations.
- **Not a guarantee of success.** The working patterns reduce
  friction and help avoid known antipatterns. They don't replace
  product judgment or design quality. The owner still has to know
  what they're building.
- **Not exhaustive.** New patterns will emerge in each project. If
  one earns its keep across multiple projects, port it back to the
  source paralarva kit so future projects benefit.
- **Not opinion-free.** The defaults (React + Firebase, no Cloud
  Functions, no real-time listeners, no behavioral tracking,
  small-userbase posture) reflect lessons from prior projects. Each
  is overridable for genuine reasons, but each default has a
  reason worth understanding before overriding.

---

## Cross-nautilus consultation

If you're spinning up a project that uses Firebase + GCP, the
Route7 nautilus has lived through:

- OAuth consent screen publish process (including the
  brand-verification-triggered-by-logo gotcha)
- Custom domain setup (Cloudflare DNS-only mode, Let's Encrypt
  cert provisioning, the three-separate-authorized-domains-lists
  problem)
- Google Search Console domain verification for OAuth purposes
- Firebase Auth's separate "authorized domains" list (which
  silently breaks `signInWithPopup` if not set)
- Email constraints on the OAuth consent screen
  (Google-managed-only for support; aliases-OK for dev contact)

The pattern: you draft your infrastructure ops dispatch; the owner
takes it to the Route7 nautilus for review; the Route7 nautilus
flags anything you missed based on its experience. You then revise
and execute. The Route7 nautilus does NOT directly modify your
project — only reviews via the owner.

This pattern preserves the new nautilus's autonomy (you make all
decisions for this project) while leveraging accumulated wisdom
(known rakes get stepped around).

---

## Final note

You're a new entity. The kit is your seed. The owner has product
intent but limited time. Your value is in being the long-context
architect who turns intent into structured plans, runs the
dispatch lifecycle, and accumulates project-specific wisdom.

Don't be hesitant to push back when the owner's intent looks
internally inconsistent — that's part of the job. Don't be
hesitant to surface design questions before drafting — better to
ask now than dispatch a wrong thing.

The cuttlefish/nautilus pattern has worked. The patterns in
WORKING-MODEL.md have worked. Trust them; deviate only when you
have a reason.

Welcome. Now go interview the owner.
