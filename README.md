# flog

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

**A fuel log for small groups who share cars.**

flog replaces the lightweight Google Form my family used to track
fill-ups across our vehicles — same low-friction capture at the pump,
plus a real step up in ergonomics (mobile-first, one-tap car switch,
installable to your phone's home screen) and a small step up in
usefulness (per-car MPG, range, stats computed for you).

The canonical user is a family: a few people sharing a handful of cars,
logging gas at the pump from their phones.

It runs at flog.austindavid.com, where a single instance can host
several independent groups, kept private from each other. Email me
if you'd like a free fuel logger of your own.

---

## What it does

- **Log a fill-up in seconds** — pick a car, enter odometer / gallons /
  cost, save. The form remembers your most-recent car and is the home
  screen.
- **Per-car MPG** — last-fill, average of the last 5, and lifetime,
  computed automatically from your fill-ups.
- **Per-car stats** — expected driving range, P95 MPG, longest tank,
  and largest fill, derived from your fill-up history.
- **Multiple cars, shared by email** — own your cars; share one with a
  family member by their email and they can log fills too.
- **Edit or delete** entries when someone fat-fingers an odometer.
- **Installable** — add it to your phone's home screen; it runs
  standalone like a native app, and works offline through fills with
  poor signal (they sync when you're back online).
- **Sign in with Google**, gated by an allowlist so only invited people
  get in.

## Principles

- **No tracking, ever.** No analytics, no telemetry, no third-party
  scripts beyond Google Identity for sign-in.
- **Your data is yours.** Built so export and account-deletion drop in
  cleanly.
- **Free to run.** Targets the Firebase free tier at family scale; if
  usage nears a paid threshold, that's a signal to rethink, not to
  upgrade reflexively.
- **Capture beats insight.** The first job is to be faster than the
  Google Form. Reports earn their place only if they're cheap and never
  slow down logging.

## Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS v4, deployed as
  a static SPA to Firebase Hosting.
- **Backend**: none. Cloud Firestore with security rules doing the
  access control; Firebase Auth (Google provider). No Cloud Functions,
  no server, no API layer.
- **Auth model**: Google OAuth + an email allowlist that's populated as
  a side effect of sharing a car.

See [`PRD.md`](PRD.md) for the full product spec and data model, and
[`AGENTS.md`](AGENTS.md) for the codebase guardrails.

## Status

v0 is live in production at flog.austindavid.com: Google sign-in with
allowlist, cars + share-by-email, mobile-first fill-up logging, per-car
MPG and stats, edit/delete, and an installable offline-capable app. The
family is onboarded and historical fill-ups are imported; development
continues from [`BACKLOG.md`](BACKLOG.md).

## Running locally

```sh
npm install
npm run dev          # Vite dev server against the dev Firebase project
npm run emulators    # Firebase Auth + Firestore emulators (rules work)
npm test             # unit tests
npm run test:rules   # Firestore security-rules tests (emulator-backed)
npm run lint         # ESLint
npm run build:dev    # production build (dev config)
```

Firebase project config lives in `.env.development` / `.env.production`
(gitignored). Deployment is `npm run deploy:{dev,prod}`, which ships
both the hosting bundle and the Firestore security rules. Escape
hatches for one without the other: `npm run deploy:hosting:{dev,prod}`
and `npm run deploy:rules:{dev,prod}`.

## How it's built

flog is developed almost entirely through human–AI pairing, using a
**cuttlefish/nautilus** working model that originated in the *paralarva*
project-bootstrap kit: a long-context "nautilus" holds the architecture
and writes dispatch briefs; short-context "cuttlefish" implement them;
every change is reviewed before it lands. The planning docs (`PRD.md`,
`AGENTS.md`, and the `dispatch/` briefs and handoffs) are written to be
cold-readable, so any fresh session can pick up the thread. It's a small
app with an unusually complete paper trail — that's the point.

## License

[PolyForm Noncommercial License 1.0.0](LICENSE) — free to use, modify,
and share for any **noncommercial** purpose, provided the copyright and
license notices are preserved. Commercial use requires a separate
arrangement with the owner.

Copyright © 2026 Austin David.
