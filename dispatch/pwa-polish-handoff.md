# PWA polish — handoff

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

Matched pair: `dispatch/pwa-polish.md` (brief) ↔ this handoff.
Dispatch B in the post-v0 UI arc (A = log-screen-restructure,
shipped; B = this; C = cars-screen kebab).

## Status

- ✅ **M1** `public/manifest.webmanifest` created with the exact
  JSON from brief §3. Valid JSON; all required fields present
  (name, short_name, start_url, scope, display, background_color,
  theme_color, two icons with `purpose: "any maskable"`).
- ✅ **M2** Manifest validated on the live dev deploy 2026-05-29;
  installability confirmed (see V1).
- ✅ **H1** `index.html` `<head>` gains all five tags exactly as
  specified: `theme-color` meta, `.ico` link, 32px PNG link, 16px
  PNG link, manifest link.
- ✅ **H2** No `apple-*` metas added. Existing `<meta viewport>`
  is `width=device-width, initial-scale=1.0` — unchanged.
- ✅ **H3** `<title>` was already "flog" (confirmed pre-read) —
  left as-is.
- ✅ **C1** `src/index.css` gains `html { -webkit-tap-highlight-color:
  transparent; }` and `body { overscroll-behavior: none; }`.
  Existing `@theme` block and `@keyframes fade-in` untouched.
- ✅ **L1** `npm run lint` exits 0.
- ✅ **L2** `npm run lint:md` exits 0.
- ✅ **L3** `npm run build:dev` exits 0. `npm run build:prod`
  exits 0. `dist/` contains all six expected files:
  `manifest.webmanifest`, `icon-192.png`, `icon-512.png`,
  `favicon.ico`, `favicon-32.png`, `favicon-16.png`.
- ✅ **V1** Owner verified 2026-05-29 on a Pixel: installed to
  home screen, blue flog logo tile, launches standalone with
  blue status bar; favicon shows in tab; no tap-flash / bounce.
- ✅ **V2** No prod deploy.

## Versions chosen

No new dependencies. HTML + JSON + CSS only. No npm changes.

## Assumptions made

- **`overscroll-behavior: none` (not `-y: contain`).** Chose the
  full variant. The app has no horizontal scroll surface; both axes
  need the bounce/pull-to-refresh suppressed for the "no browser
  chrome bleed" feel. If the cars list or log entries table ever
  gains a nested horizontal scroll, swap to `-y: contain` at that
  point. No scroll-feel issues observed statically; the call is
  safe until runtime testing says otherwise.
- **`-webkit-tap-highlight-color` on `html`.** Applied to `html`
  rather than `*` (briefer mentions either). Both achieve the same
  effect via inheritance for tap targets. `html` is marginally
  cleaner (one rule, not a universal-selector override).

## Deviations from dispatch

None — followed the dispatch as written.

## Files created

- `public/manifest.webmanifest` — PWA manifest (new).

## Files modified

- `index.html` — five tags added to `<head>` (theme-color meta,
  three favicon links, manifest link).
- `src/index.css` — two app-feel rules appended after
  `.animate-fade-in` (tap-highlight + overscroll).

## Files NOT touched (confirmed)

All §6 NOT-touch entries respected. The five `public/` icon
assets (`icon-512.png`, `icon-192.png`, `favicon.ico`,
`favicon-32.png`, `favicon-16.png`) were not modified. No changes
to `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`,
`vitest*.config.ts`, `package.json`, `package-lock.json`,
`firebase.json`, `.firebaserc`, `firestore.rules`, `PRD.md`,
`AGENTS.md`, `BACKLOG.md`, `CUTTLEFISH-NAUTILUS.md`,
`WORKING-MODEL.md`, `HANDOFF-TEMPLATE.md`, `README.md`,
`dispatch/assets/`, any `tests/**`, or any `src/**` file other
than `src/index.css`. No `.env.*` edits. No git commits.

## Items deferred

### To the next dispatch

- **Owner V1 manual validation** (post `npm run deploy:dev`):
  Chrome DevTools Application → Manifest panel; installability
  check; Pixel home-screen install to verify blue logo tile +
  standalone launch + blue status bar; tab favicon showing
  flog logo; no grey tap-flash; no pull-to-refresh bounce.
- **Dispatch C (cars-screen kebab)** — separate, not in scope
  here. The app-feel CSS now lives in `src/index.css` after
  `.animate-fade-in`; any future global CSS appends go there.

### To BACKLOG

- `viewport-fit=cover` + `env(safe-area-inset-*)` edge-to-edge
  layout — deferred per Decision #5 (brief §4). A future
  "edge-to-edge polish" XS if ever wanted.
- Service worker / offline — BACKLOG → Later "Offline-first
  capture" (L). Reminder: a cache-only SW is explicitly worse-
  than-nothing per brief §1.

## Expected cost impact

None. HTML + JSON + CSS; no new Firestore reads, API calls, or
CDN fetches.

## Manual steps for the human owner

1. `npm run deploy:dev` (no rules change; standard deployment
   is sufficient).
2. Open `https://flog-dev.web.app/` in Chrome desktop.
3. DevTools → Application → Manifest:
   - Name shows "flog", theme color `#2563eb`, background
     `#ffffff`.
   - Both icons render in the panel (192 + 512).
   - No schema errors listed.
4. DevTools → Application → Manifest → Installability:
   - Chrome should report the app is installable (HTTPS ✓,
     manifest ✓, 192 + 512 icons ✓; no service worker
     required for installability in current Chrome).
5. On a Pixel (6 / 7a / 9) in Chrome:
   - Visit the dev URL → menu → "Add to Home screen" /
     "Install app".
   - Home-screen tile: blue flog logo (not a generic globe).
   - Launch: standalone (no browser address bar / chrome).
   - Status bar: tinted blue.
6. Confirm browser tab shows the (squishy) flog logo as favicon
   rather than the Vite default.
7. On the log screen: tap a button — no grey flash. Scroll the
   entries table to the bottom, pull past it — no bounce/
   pull-to-refresh revealing browser background.

## Notes for the next dispatch brief

- **`manifest.webmanifest` MIME type**: Vite dev server and build
  output serve `.webmanifest` as `application/manifest+json`
  automatically. No config required. If a future static host
  mis-serves the MIME type, add a `firebase.json` headers rule —
  that's a hosting concern, not a manifest concern.
- **`start_url`/`scope` are `/`**: correct for both `flog-dev`
  and `flog-prod`. No per-env manifest needed at prod cutover.
  The prod cutover conversation need not re-litigate this.
- **Bundle delta**: ~0 JS (no JS touched). CSS gained ~120 bytes
  (two short rules). The manifest + icons are static assets
  copied from `public/`, not bundled — no JS bundle impact.
- **Global CSS location**: `src/index.css` after `.animate-fade-in`
  is the established home for global app-feel rules. Dispatch C
  (cars kebab) and any future dispatch appending global CSS should
  add there.
- **`overscroll-behavior` tripwire**: if a future feature adds a
  nested horizontal scroll surface (e.g., a swipeable card), and
  `none` breaks the horizontal gesture, swap to
  `overscroll-behavior-y: contain` to preserve only the vertical
  suppression. Document the swap in that dispatch's handoff.

End of handoff.
