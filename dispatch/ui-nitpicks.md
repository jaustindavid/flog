# UI nitpicks — accumulating for a batched dispatch

_Copyright © 2026 Austin David. All rights reserved._

> flog is built with Claude (Anthropic) as a continuous collaborator.
> The PRD, ARCHITECTURE doc, and most code are produced via human-AI
> pairing — the planning docs are written dense and self-contained so
> a fresh Claude session can cold-read and contribute immediately.

**Status**: collecting small UI tweaks the owner flags during playtest.
Accumulate here until there's enough for one tidy XS/S dispatch (likely
all-Sonnet, mechanical), rather than a dispatch per nitpick. Each item
records the exact location so the eventual dispatch is turnkey.

---

## Open (not yet dispatched)

1. **Drop the redundant "← Back to cars" link on car-detail.** Owner
   2026-05-31. The global header (`src/components/Header.tsx:44`,
   `to="/cars"`) already renders a "Cars" link above the page content,
   so the in-page back-link is duplicative.
   - Loaded view: `src/screens/CarDetailScreen.tsx:175-180` (the link in
     the top `<div>`, above the rename form) — **remove this one.**
   - Error / not-found view: `src/screens/CarDetailScreen.tsx:153-158`
     ("Car not found or no access."). **Decision needed:** does the
     header render on the error surface too? If yes, drop this one as
     well; if the error surface is a bare `<main>` with no header, keep
     it (it's the only way back from a dead end). Verify during the
     dispatch and choose accordingly — default to keeping the error-view
     link unless the header is confirmed present there.

2. **Re-tap the active car chip → navigate to that car's detail page.**
   Owner 2026-05-31 (decided: "Re-tap → car detail" variant). On the
   fuel screen the `CarPickerChips` row (`src/components/CarPickerChips
   .tsx`, mounted at `src/screens/LogFillupScreen.tsx:253`) currently
   selects on tap and nothing navigates. Change: tapping a chip that is
   **already selected** pushes `/cars/:carId` (the car-detail page —
   what the owner called "the maintenance screen"). Tapping a
   non-selected chip still just selects (unchanged).
   - **A11y (required, not optional).** The chips are today an ARIA
     `radiogroup` of `role="radio"` buttons. A radio that navigates
     breaks the radio contract. Reclassify the control so the navigation
     is legitimate — e.g. a `tablist`/plain labeled buttons — and make
     sure the "activate the already-active item" path is announced
     correctly. Do NOT leave them as radios.
   - **Accepted edge.** A fast double-tap while selecting a *different*
     car (tap 1 selects, tap 2 lands on the now-active chip and
     navigates, dropping any half-typed fill-up) is accepted as
     low-stakes — re-tapping the already-active car is a deliberate act.
     No confirm-on-unsaved guard (owner declined that variant).
   - **Wiring.** `CarPickerChips` needs a way to signal "re-tap of the
     active chip" to the screen (e.g. an `onReselect(carId)` callback, or
     have the screen pass a navigate handler) — `LogFillupScreen` owns
     routing via `useNavigate`. Keep the chip component presentational.
   - **Docs reconciliation (do in the same dispatch).** PRD §14.5 was
     locked 2026-05-31 as "the banner is the ONLY maintenance reference
     on the fuel screen." This adds a second path from the fuel screen to
     the car's maintenance home. Treat it as distinct in kind
     (navigation to car-detail, not a standing "log maintenance" link)
     and amend §14.5 to note the exception rather than leave the lock
     silently contradicted.

---

## Dispatched / done

_(none yet)_
