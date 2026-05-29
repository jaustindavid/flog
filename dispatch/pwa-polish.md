# PWA polish + manifest + icon wiring

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

**Status**: draft — pending pre-read by reviewer cuttlefish (per
WORKING-MODEL §3) before implementer dispatch.

---

## 1. Context

The "B" dispatch from the post-v0 UI work (A = log-screen
restructure, shipped; B = this; C = cars-screen kebab). A
UI-design cuttlefish recommended a "PWA feel" 2026-05-29; owner
approved with the no-offline / icon-tension resolutions captured
below.

**The asset half is already done** (nautilus-inline, 2026-05-29):
`/public/` contains the five shipping icon assets — `icon-512.png`,
`icon-192.png` (blue-600 full-bleed logo, maskable-safe), plus
`favicon.ico` (16/32/48), `favicon-32.png`, `favicon-16.png`
(same logo, accepted-squishy at tab sizes). The owner's logo was
recolored green→blue-600 to match the app accent. Provenance copy
of the green original is at `dispatch/assets/`.

This dispatch is the **code half**: wire those assets into an
installable PWA via a manifest + `index.html` link/meta tags, plus
a few app-feel CSS touches. After this, flog installs to a Pixel
home screen with the logo icon, standalone display, blue status
bar.

What this dispatch does NOT do:

- No service worker / offline support. PRD §2 punts offline
  ("assumes connectivity at the pump"); BACKLOG → Later has
  "Offline-first capture" as the L-sized deep version. A
  cache-only service worker would *look* like progress without
  delivering offline correctness — explicitly out of scope.
- No `viewport-fit=cover` / safe-area edge-to-edge. That's the
  one layout-affecting PWA touch; deferred to keep this dispatch
  purely additive (see §4 Decision #5). The `theme-color` meta
  already tints the status bar without it.
- No new icon assets (asset half is done).
- No app-logic, data-path, routing, or component changes.
- No new dependencies.

---

## 2. Required reading

In order:

1. `PRD.md` §1.2 (no analytics / no third-party scripts — the
   manifest is first-party static, no conflict), §1.4 (same),
   §2 (offline non-goal — why no service worker), §9 (UI;
   mobile-first; Pixel target).
2. `AGENTS.md` — full read. No-third-party-scripts and
   no-analytics guardrails matter (a manifest is neither; confirm).
3. `WORKING-MODEL.md` §3, §5, §6.
4. `HANDOFF-TEMPLATE.md`.
5. `dispatch/log-screen-restructure-handoff.md` — the most recent
   dispatch; confirms current `index.html` / `src/index.css`
   state (the A dispatch touched `index.css` for the fade-in
   keyframe).
6. Current `index.html` (repo root) — the file this dispatch
   primarily modifies.
7. Current `src/index.css` — gets the app-feel CSS additions.

---

## 3. Scope

### In scope

- **`public/manifest.webmanifest`** (new file):

  ```json
  {
    "name": "flog",
    "short_name": "flog",
    "start_url": "/",
    "scope": "/",
    "display": "standalone",
    "background_color": "#ffffff",
    "theme_color": "#2563eb",
    "icons": [
      {
        "src": "/icon-192.png",
        "sizes": "192x192",
        "type": "image/png",
        "purpose": "any maskable"
      },
      {
        "src": "/icon-512.png",
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "any maskable"
      }
    ]
  }
  ```

  - `background_color` white = the splash screen behind the
    blue icon while the standalone app boots (blue icon pops on
    white).
  - `theme_color` blue-600 = Android status-bar tint in
    standalone mode.
  - `purpose: "any maskable"` = the icons work both as adaptive
    (cropped by launcher mask) and as-is. The assets were built
    full-bleed with the art in the center ~60% safe zone, so
    masking is safe.

- **`index.html`** (modified — add to `<head>`):
  - `<meta name="theme-color" content="#2563eb" />`
  - `<link rel="icon" href="/favicon.ico" sizes="any" />`
  - `<link rel="icon" type="image/png" sizes="32x32"
    href="/favicon-32.png" />`
  - `<link rel="icon" type="image/png" sizes="16x16"
    href="/favicon-16.png" />`
  - `<link rel="manifest" href="/manifest.webmanifest" />`
  - Do NOT add `apple-touch-icon` or `apple-mobile-web-app-*`
    metas — family is 100% Android (Pixel 6/7a/9); iOS legacy
    tags are dead weight.
  - Do NOT change the existing `<meta name="viewport">` — leave
    it as `width=device-width, initial-scale=1.0`. (No
    `viewport-fit=cover` this dispatch — Decision #5.)
  - Optionally tighten the `<title>` if it's still a Vite
    default — verify; if it already says "flog" leave it.

- **`src/index.css`** (modified — append app-feel touches):
  - `-webkit-tap-highlight-color: transparent;` on a global
    selector (e.g., `html` or `*`) — kills the grey tap-flash
    that reads as "webpage." Buttons already have
    `focus:ring-*` for keyboard/focus affordance, so removing
    the tap flash loses nothing.
  - `overscroll-behavior: none;` on `body` — disables the
    bounce/pull-to-refresh that reveals browser chrome. App-like
    on Android Chrome. (Implementer may use
    `overscroll-behavior-y: contain` if they judge it gentler;
    either is acceptable — flag choice in handoff.)
  - These additions go alongside the existing `@theme` block and
    the A-dispatch `@keyframes fade-in` — do not disturb those.

### Out of scope (defer)

- Service worker / offline (BACKLOG → Later "Offline-first
  capture", L).
- `viewport-fit=cover` + `env(safe-area-inset-*)` edge-to-edge
  layout (Decision #5; a future "edge-to-edge polish" XS if ever
  wanted).
- Splash-screen customization beyond `background_color`.
- App shortcuts / share-target / other manifest advanced fields
  (YAGNI at family scale).
- Any change to icon assets (asset half complete).

---

## 4. Decisions locked in

1. **Logo-everywhere icons** (no separate simplified favicon).
   Owner 2026-05-29: the simple-"f" favicon resembled the
   Facebook logo; accepted the squishy logo favicon instead,
   revisit later if the tab icon bugs anyone. Assets already
   built this way.
2. **App stays blue-600**; the logo was recolored green→blue to
   match (owner: "my car is blue"). `theme_color` = `#2563eb`.
3. **No service worker.** Offline is a deferred L item; a
   cache-only SW is worse-than-nothing (looks like offline
   support without the write-queue correctness).
4. **No iOS metas.** Family is 100% Pixel/Android.
5. **No `viewport-fit=cover` this dispatch.** It's the only
   layout-affecting PWA touch (content extends under the status
   bar / gesture area, requiring `env(safe-area-inset-*)`
   padding on the Header and scroll containers — real layout
   work + Pixel hardware testing). Keeping B purely additive and
   non-layout-affecting makes it safe and fast. The `theme-color`
   meta tints the status bar without cover-mode. Edge-to-edge
   becomes a separate XS polish later if desired.
6. **Manifest `display: standalone`** (not `fullscreen` — keeps
   the status bar visible, which is what families expect; not
   `minimal-ui`).
7. **Pre-read required** (WORKING-MODEL §3), even though small —
   manifest schema validity and icon-path correctness are worth
   a fresh-eyes check, and a broken manifest fails the install
   silently-ish (no install prompt) rather than loudly.

---

## 5. Files in play

```text
flog/
├── index.html                      (modified — head meta/links)
├── public/
│   └── manifest.webmanifest        (new)
└── src/
    └── index.css                   (modified — 2 app-feel rules)
```

Three files. The five icon assets in `/public/` already exist
(asset half) and are NOT modified.

Handoff at `dispatch/pwa-polish-handoff.md`.

---

## 6. Files NOT to touch

- `PRD.md`, `AGENTS.md`, `BACKLOG.md`, `CUTTLEFISH-NAUTILUS.md`,
  `WORKING-MODEL.md`, `HANDOFF-TEMPLATE.md`, `README.md`
- All `dispatch/*` files (closed records; this brief is the only
  active one — populate its §13 if a rake surfaces)
- `dispatch/assets/logo-source-green-original.png` (provenance
  archive; leave it)
- `firestore.rules`, all `tests/**`
- All `src/**` EXCEPT `src/index.css` (2-rule append)
- The five `/public/*` icon assets (icon-512, icon-192,
  favicon.ico, favicon-32, favicon-16) — these are final;
  do not regenerate or modify
- `.firebaserc`, `firebase.json`, `vite.config.ts`,
  `tsconfig*.json`, `eslint.config.js`, `vitest*.config.ts`,
  `package.json`
- `.env.development`, `.env.production`

---

## 7. Notes for the implementer

- **Vite serves `/public/` at the web root.** A file at
  `public/manifest.webmanifest` is served at
  `/manifest.webmanifest`; `public/icon-192.png` at
  `/icon-192.png`. So the absolute paths in the manifest
  (`/icon-192.png`) and in the `index.html` links
  (`/favicon.ico`, `/manifest.webmanifest`) are correct as
  written. Verify against `vite.config.ts` that `publicDir`
  isn't overridden (it shouldn't be — M1 used defaults).
- **Manifest MIME type**: Vite serves `.webmanifest` with the
  correct `application/manifest+json` type out of the box.
  No config needed. (If a future static host mis-serves it,
  that's a hosting concern, not this dispatch.)
- **The build copies `/public/` to `dist/`** verbatim, so
  `build:dev` / `build:prod` will include the manifest + icons.
  Verify they land in `dist/` during the V build check.
- **`overscroll-behavior` + `tap-highlight`** go in the global
  CSS layer, not scoped to a component. Append after the
  existing `@theme` and `@keyframes fade-in` blocks in
  `src/index.css`. Don't wrap them in `@layer` unless the file
  already uses layers (it doesn't — it's plain CSS after the
  Tailwind import).
- **No JS changes at all.** This is HTML + JSON + CSS only.

---

## 8. Acceptance criteria

### M* — Manifest

- **M1** `public/manifest.webmanifest` exists with the exact
  shape in §3 (name, short_name, start_url, scope, display,
  background_color, theme_color, two maskable icons). Valid
  JSON.
- **M2** Manifest validates: no schema errors in Chrome DevTools
  → Application → Manifest panel (owner V-step), and the two
  icons resolve (no 404).

### H* — HTML head

- **H1** `index.html` `<head>` gains: `theme-color` meta;
  favicon links (.ico + 32 + 16 PNG); manifest link. Exact tags
  per §3.
- **H2** No `apple-*` metas added. Existing `<meta viewport>`
  unchanged (no `viewport-fit=cover`).
- **H3** `<title>` is "flog" (verify; correct if it's a stale
  Vite default).

### C* — CSS app-feel

- **C1** `src/index.css` gains `-webkit-tap-highlight-color:
  transparent` (global) and `overscroll-behavior: none` (or
  `-y: contain`) on `body`. Existing `@theme` + `@keyframes
  fade-in` untouched.

### L* — Lint + build

- **L1** `npm run lint` exits 0 (no JS/TS touched, so this is a
  formality, but run it).
- **L2** `npm run lint:md` exits 0 (this brief + handoff are new
  markdown).
- **L3** `npm run build:dev` and `npm run build:prod` exit 0,
  AND `dist/` contains `manifest.webmanifest` + all five icon
  files after build (verify the public-dir copy worked).

### V* — Verification

- **V1** Owner manual test (post-`npm run deploy:dev`):
  - Chrome DevTools → Application → Manifest: name "flog",
    theme/background colors shown, both icons render in the
    panel with no errors.
  - DevTools → Application → Manifest → "Installability":
    Chrome reports the app is installable (the criteria:
    served over HTTPS ✓ via Firebase Hosting, has manifest ✓,
    has 192 + 512 icons ✓; no service worker is required for
    installability in current Chrome).
  - On an actual Pixel (6/7a/9): visit the dev URL in Chrome →
    menu → "Add to Home screen" / "Install app" → confirm the
    home-screen tile shows the blue flog logo (not a generic
    globe), launches standalone (no browser chrome), status bar
    tinted blue.
  - Browser tab favicon shows the (squishy) logo, not the Vite
    default.
  - Verify no grey tap-flash on buttons; verify no
    bounce/pull-to-refresh revealing browser background when
    scrolling the log screen.
- **V2** No prod deploy.

---

## 9. Stop and ask

1. Any new dependency (none expected).
2. Any change beyond the three files in §5.
3. If `vite.config.ts` turns out to override `publicDir` or base
   path such that `/manifest.webmanifest` or `/icon-*.png` won't
   resolve at the web root — surface before working around it.
4. If the existing `<meta viewport>` or `<title>` looks
   materially different from the brief's assumption — surface
   rather than guess.
5. If `overscroll-behavior: none` visibly breaks any intended
   scroll on the cars list or entries table during your local
   check — fall back to `-y: contain` and note it.

---

## 10. Dependencies expected

None. HTML + JSON + CSS only. No npm changes.

---

## 11. Handoff guidance

`dispatch/pwa-polish-handoff.md` per template. Capture:

- The `overscroll-behavior` value chosen (`none` vs `-y:
  contain`) + why.
- Confirmation that `dist/` includes the manifest + icons after
  build.
- Bundle delta (should be ~0 for JS; the manifest + icons are
  static assets, not bundled).
- Anything the **prod cutover** conversation needs: the manifest
  `start_url`/`scope` are `/`, which is correct for both
  `flog-dev` and `flog-prod` (same relative root); no per-env
  manifest needed. Note this so cutover doesn't re-litigate.
- Note for **C (cars kebab)** and any future dispatch: the
  app-feel CSS now lives in `src/index.css` after the fade-in
  keyframe; future global CSS appends go there.

---

## 12. Pre-read checklist

- **Manifest schema**: validate the JSON in §3 against the W3C
  web app manifest spec. `purpose: "any maskable"` is the
  correct space-separated form (not an array). `sizes` strings
  correct. `display: standalone` valid enum.
- **Icon paths**: confirm `/icon-192.png` and `/icon-512.png`
  resolve from web root given Vite's `public/` serving. Confirm
  the files actually exist at `public/icon-192.png` /
  `public/icon-512.png` (they do — asset half).
- **index.html current state**: read the actual file; verify the
  `<head>` is as the brief assumes (charset, viewport, title,
  the A-dispatch may have touched it — confirm). Verify the
  brief's link tags don't duplicate anything already present.
- **src/index.css current state**: read it; confirm the `@theme`
  block + the A-dispatch `@keyframes fade-in` are present and the
  brief's 2-rule append won't collide.
- **vite publicDir**: read `vite.config.ts`; confirm `publicDir`
  isn't overridden and `base` is default (`/`), so absolute
  asset paths resolve.
- **AGENTS no-third-party-scripts**: confirm a manifest +
  favicon links introduce no third-party script (they don't —
  all first-party static). Sanity-check there's no CDN reference
  sneaking in.
- **Internal consistency**: §3 ↔ §5 ↔ §8 ACs.

Report: BLOCKING / SHOULD-FIX / NITS / CONFIRMED-OK. Reviewer
modifies no files.

---

## 13. Forward feedback channel

(empty until execution)

Examples of what belongs here: Vite `.webmanifest` serving
quirks; Chrome installability criteria changes; Pixel launcher
mask behavior on the maskable icons.

---

End of brief.
