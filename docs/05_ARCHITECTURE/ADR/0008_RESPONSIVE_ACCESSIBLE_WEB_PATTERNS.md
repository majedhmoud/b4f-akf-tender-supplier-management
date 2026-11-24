---
status: accepted
---

# Responsive and accessible patterns for the web app

## Context

Four team design reviews of the web app ([UI/UX audit](../../08_TEAM_REVIEWS/UI_UX_AUDIT.md), [visual audit](../../08_TEAM_REVIEWS/VISUAL_UI_UX_AUDIT.md), [authenticated audit](../../08_TEAM_REVIEWS/AUTHENTICATED_UI_UX_AUDIT.md) and [responsive report](../../08_TEAM_REVIEWS/RESPONSIVE_VERIFICATION_REPORT.md)) found the same problems across many screens:

- At phone width, staff and admin tables push status and actions off the screen (AU-01 to AU-04).
- Loading states look like blank panels, one route has no loading fallback, and the root fallback says nothing to screen readers (V-01, UX-01, UX-05).
- Small buttons are 24–28px tall (UX-04).
- The signed-in header takes about 220px of a phone screen before the content, and shows the full account email (AU-05, UX-07).
- Cancelling an inline confirmation loses keyboard focus (responsive report).

Fixing each screen separately would drift. These rules apply to every web screen, existing and new.

## Decision

1. **Lists.** Below the `lg` breakpoint, a list shows one card per row, with the title, the status and the main action together. At `lg` and wider it stays a table with real table headers.
2. **Loading.** Every loading boundary shows a skeleton shaped like the content it replaces, and a visually hidden "Loading…" status for screen readers. No `Suspense` boundary is left without a fallback.
3. **Touch targets.** A standalone or consequential action uses the default button size (40px). The small sizes, at least 36px (`sm`) and 32px (`xs`), are only for grouped, low-risk controls.
4. **Signed-in header on phones.** One compact row: the brand and a compact account control. The account email is truncated on screen and kept in full in the control's accessible name.
5. **Focus.** When an inline confirmation is cancelled or completed, keyboard focus returns to the button that opened it, when that button is still on the page.
6. **Theme.** V1 offers the light theme only. The unused dark tokens are not presented as a supported mode.

Arabic and English share every rule. Tabs keep receiving the page direction from their callers, which the reviews found correct.

## Consequences

- New screens follow these rules without a separate review.
- Lists carry two layouts in one component. Both read the same data, so the content stays the same.
- The implementation adds shared loading and back-link components, responsive list cards, and `useReturnFocus` for inline confirmations. The audits describe earlier observed states. This decision does not assert screen-reader, contrast or zoom conformance.
