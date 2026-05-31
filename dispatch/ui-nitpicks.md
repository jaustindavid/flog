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

_(none)_

---

## Dispatched / done

1. **Drop the redundant "← Back to cars" link on car-detail.**
   Owner 2026-05-31. Both links removed (loaded view and error/not-
   found view). `Link` import removed. Header's "Cars" NavLink covers
   both surfaces. Dispatched: `ui-nits-batch` (2026-05-31).

2. **Re-tap the active car chip → navigate to that car's detail
   page.** Owner 2026-05-31. `onReselect` prop added to
   `CarPickerChips`; `LogFillupScreen` wires it via `useNavigate`.
   A11y reclassified: `role="group"` + `aria-current="true"` on
   selected chip (was `radiogroup`/`radio`/`aria-checked`). PRD Flow C
   §7 step 2 + §14.5 amended. Dispatched: `ui-nits-batch`
   (2026-05-31).
