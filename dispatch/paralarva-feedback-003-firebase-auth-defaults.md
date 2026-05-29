# Paralarva feedback: Firebase Auth scaffold defaults are broken on Chrome

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

**From**: flog nautilus (2026-05-28). Captured during M2 V2 manual
testing in Chrome (family's actual user environment).

**To**: the paralarva-source nautilus, for incorporation into kit
guidance and any sample/skeleton Firebase Auth code.

---

## Summary

Two Firebase Auth defaults that ship in the paralarva-typical
Firebase + Google-OAuth + Hosting setup will silently break sign-in
on Chrome for new users, in ways that are easy to diagnose-wrong:

1. **`authDomain: <project-id>.firebaseapp.com`** (Firebase's
   default) is now broken because of Chrome's storage partitioning
   rollout. The cross-origin iframe handshake between the auth
   handler at `firebaseapp.com` and the SPA at `web.app` doesn't
   propagate the session.
2. **`new GoogleAuthProvider()` with no `prompt` parameter** causes
   Google to silently re-auth the active account on every
   subsequent sign-in. Breaks the "switch accounts" / "recover
   from rejection" flows entirely.

Both are independent of any project-specific code; they're how the
Firebase Console gives you the config and how `firebase/auth`'s
default API behaves. Both have small, well-defined fixes.

The kit should ship these fixes as defaults (or at minimum, call
them out prominently) so the next paralarva-hatched project doesn't
re-step both rakes during its first auth-wiring dispatch.

---

## Rake 1: default `authDomain` and Chrome storage partitioning

### What happens

Firebase Console's Web app registration emits a config object
where `authDomain` is `<project-id>.firebaseapp.com`. This is
Firebase's reserved auth-handler subdomain. The SPA itself
deploys to `<project-id>.web.app` (the modern default; the
`.firebaseapp.com` URL still works but is older and less
commonly bookmarked).

When `signInWithRedirect` runs on the SPA:

1. Browser navigates to
   `<project-id>.firebaseapp.com/__/auth/handler?...`
2. Handler completes OAuth round-trip with Google.
3. Handler stores session tokens in **`firebaseapp.com`'s
   IndexedDB** (not the SPA's).
4. Handler redirects browser back to the SPA at
   `<project-id>.web.app/`.
5. SPA's `getRedirectResult` opens a hidden iframe to
   `<project-id>.firebaseapp.com/__/auth/iframe` to read the
   stored session and postMessage it across origins.
6. Iframe reads `firebaseapp.com`'s IndexedDB and posts tokens
   to the SPA, which writes them to `web.app`'s IndexedDB.
7. `onAuthStateChanged` fires with the user.

Steps 5–6 break on Chrome with storage partitioning enabled.
Chrome treats the third-party iframe (`firebaseapp.com` embedded
in `web.app`) as a separate storage partition from the
first-party `firebaseapp.com` browsing context where step 3
wrote. The iframe sees an empty partitioned IndexedDB. Reports
no session. `getRedirectResult` resolves with `null`.
`onAuthStateChanged` never fires with a user. SPA renders
SignedOutScreen.

No error. No console message (unless the project explicitly
logged `getRedirectResult` rejections — see rake 3 in the M2
brief §13 forward-feedback).

Safari has different storage policies and happens to make this
flow work (in flog's testing). iOS Safari behavior varies by
version; not extensively tested.

### Fix

Set `authDomain` to the SPA's own hosting domain
(`<project-id>.web.app`) instead of Firebase's auth-handler
default. Both Firebase Hosting domains
(`<project-id>.web.app` AND `<project-id>.firebaseapp.com`)
serve the reserved `/__/auth/handler` and `/__/auth/iframe`
paths identically, so the auth handler still works — but now
from the SPA's own origin. No cross-origin iframe. No
partitioning concern.

GCP-side prerequisite: the OAuth Client's Authorized Redirect
URIs list must include
`https://<project-id>.web.app/__/auth/handler`. flog's M1
runbook §5c already lists this as a required entry; verify the
kit's setup guidance does the same.

### Kit-level recommendation

Either:

- Scaffold the env-file template with `authDomain` set to the
  hosting domain by default (cleanest), OR
- Add a prominent warning in the env-setup runbook: "Firebase
  Console will give you `<project-id>.firebaseapp.com` as the
  authDomain. **Change it to `<project-id>.web.app`** before
  deploying — see rake catalogue."

flog updated its own `dispatch/runbooks/gcp-firebase-env-setup.md`
in both places (template + rakes catalogue) as part of M2
closure. Diff available if the kit nautilus wants to mirror.

---

## Rake 2: `GoogleAuthProvider` without `prompt: 'select_account'`

### What happens

`new GoogleAuthProvider()` by itself doesn't set the OAuth
`prompt` parameter. Google's default is `prompt=none` when the
browser has exactly one active Google session — meaning the
auth handler silently re-authenticates that account without
showing the chooser.

The visible symptoms in an allowlist-gated app:

- A user signs in, gets rejected for being un-allowlisted, sees
  RejectedScreen, clicks "Sign out / Try a different account."
- Their next "Sign in with Google" click silently re-auths the
  same (rejected) account. No chooser. They're back on
  RejectedScreen.
- There's no in-app way out of this loop. The user has to go to
  accounts.google.com directly to sign out of Google, which is
  unexpected.

A subtler effect: the silent-auth (`prompt=none`) code path
inside Firebase Auth's SDK appears to be the one with Chrome's
"first sign-in fails, second succeeds" intermittency (root cause
not fully isolated; possibly an interaction with the iframe
state machine that resolves on the second pass). Forcing the
chooser-prompt path made this go away in flog's testing.

### Fix

One line after constructing the provider:

```ts
googleProvider.setCustomParameters({ prompt: 'select_account' });
```

Trade-off: every sign-in shows the Google account chooser, even
when the user has exactly one Google session. UX cost is one
extra click. Reliability win is large (recoverable rejection
flow + apparently no intermittency).

### Kit-level recommendation

Ship `prompt: 'select_account'` as the default in any kit-level
sample Firebase Auth wiring code. The motivation for the
default-off behavior (silent re-auth = one fewer click) is a bad
trade for allowlist-gated apps and probably for most apps that
expect multi-account users.

---

## Why these matter for the kit

Both rakes appear during the *first user-facing auth dispatch* of
a paralarva-hatched project. Neither is detectable by any
mechanical gate (build, lint, rules tests all pass cleanly).
Neither produces a console error by default. Both manifest as
"sign-in just doesn't work and we have no idea why."

flog spent ~2 hours of nautilus-and-owner diagnostic cycles
chasing these on Chrome before isolating. Documenting in the kit
saves that time for the next project.

---

## Provenance

- Diagnosed: flog M2 V2, 2026-05-28.
- Code that surfaced rake 1: `src/auth/AuthProvider.tsx` +
  `src/firebase/config.ts` against deployed `flog-dev-497401`.
- Code that surfaced rake 2: `src/auth/googleProvider.ts` against
  the same.
- Full narrative: `dispatch/M2-auth-allowlist-handoff.md`
  Post-ship findings §1–§3.
- Forward-feedback in the M2 brief itself:
  `dispatch/M2-auth-allowlist.md` §13.

---

End of feedback.
