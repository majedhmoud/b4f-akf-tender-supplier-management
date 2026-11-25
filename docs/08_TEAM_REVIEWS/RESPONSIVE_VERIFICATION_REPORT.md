# Responsive UI Verification Report

This is a historical browser run. The closeout snapshot adds focus restoration through `useReturnFocus`, as recorded in [ADR 0008](../05_ARCHITECTURE/ADR/0008_RESPONSIVE_ACCESSIBLE_WEB_PATTERNS.md). The browser observations below predate that change.

## 1. Executive Summary

The three list components were visually inspected in English and Arabic at the browser widths available during this run: 714px and 1280px. At 714px, the card layouts were visible; at 1280px, the tables were visible. Content and primary actions were readable in the captured states, with no visible clipping or horizontal page overflow.

One confirmed keyboard usability issue remains: after cancelling the supplier suspension confirmation with the keyboard, focus returns to the page root instead of the triggering action (P2). No supplier state was changed.

The browser tool did not expose a way to set a precise viewport width. None of the requested exact widths (375px, 768px, 1366px, 1920px) was verified. The screenshots listed below are browser captures from this run at the measured widths, not captures at the requested widths.

## 2. Exact Viewports Tested

| Measured `window.innerWidth` | Document client width | Layout observed | Result |
|---:|---:|---|---|
| 714px | 699px | Card layout in all three lists | Visually inspected in English and Arabic |
| 1280px | 1265px | Table layout in all three lists | Visually inspected in English and Arabic |

The 15px difference is the browser’s vertical scrollbar. These values were measured in the page; no viewport emulation was applied.

| Requested width | Verification |
|---:|---|
| 375px | Not verified: exact viewport could not be set |
| 768px | Not verified: exact breakpoint boundary could not be set |
| 1366px | Not verified: exact viewport could not be set |
| 1920px | Not verified: exact viewport could not be set |

## 3. English and Arabic Results

- **English (LTR):** titles, metadata, statuses, and actions were readable in the captured card and table states. The seeded content included one Arabic tender title in the English interface; it remained legible.
- **Arabic (RTL):** page headings, filters, metadata labels, and table columns followed RTL alignment. Mixed-direction English tender and supplier names remained legible in the captured states. No clipping was visible at 714px or 1280px.
- The seeded supplier names were English. Long Arabic legal names were not available to verify.

## 4. Findings by Component

### Employee Tender List

**Verified at 714px:** card rows showed tender title, status badge, category, created date, and a full-width “View tender” action. The tested Arabic card showed RTL metadata while retaining readable English titles. The first card was about 225px tall in the captured viewport; the next card began below it, with no overlap or clipping.

**Verified at 1280px:** the desktop table showed title/category, date, status, and action columns. The seeded rows fit the visible table width; no horizontal page overflow was visible.

**Findings:** no visual defect confirmed at the observed widths. Long titles at 375px and exact breakpoint behavior at 768px remain unverified.

### Managed Tenders

**Verified at 714px:** cards displayed title, status, category, requesting employee, creation date, and a full-width “View tender” action. In Arabic, labels and metadata aligned RTL; Latin requester names and mixed-direction tender titles remained legible. No overlap or clipping was visible.

**Verified at 1280px:** the table showed tender title/category, requester, created date, and status. The visible rows fit the available content area without visible horizontal overflow.

**Findings:** no visual defect confirmed at the observed widths. Very long requester names and titles at 375px, and the exact 1024px card-to-table boundary, remain unverified.

### Supplier Directory

**Verified at 714px:** cards showed legal name, status, registration number, and a visibly destructive Suspend action. In Arabic, the search controls followed RTL flow, and English seeded supplier names and registration numbers remained readable. The confirmation text and buttons stayed inside the card without overlap.

**Verified interaction:** opening Suspend showed an inline confirmation. Cancelling restored the row’s Suspend action and left the supplier status Active. The same cancellation was checked in English and Arabic; no destructive action was submitted.

**Verified at 1280px:** the table showed legal name, registration number, status, and action columns. Suspend remained available in the action column. The Arabic table aligned RTL and displayed the Latin supplier name and registration number without visible clipping.

**Finding — P2, keyboard focus after cancelling confirmation:** after navigating to Suspend, opening its confirmation with Enter, tabbing to Cancel, and cancelling with Enter, focus moved to the page root rather than returning to the original Suspend button. The confirmation controls themselves were keyboard reachable and showed a visible focus indicator when tabbed to. Recommend restoring focus to the triggering action after cancellation (and after a completed action where the row remains present).

Long Arabic legal names, suspended supplier rows with Reactivate actions, and exact 375px rendering remain unverified.

## 5. Screenshot and Browser References

Screenshots were captured and visually reviewed in the in-app browser during this run. They were not persisted as image files; references below identify the route, locale, and measured browser width of each capture.

| Ref | Route | Locale | Width | State |
|---|---|---|---:|---|
| EV-01 | `/employee/tenders` | English | 714px | Cards |
| EV-02 | `/employee/tenders` | Arabic | 714px | Cards |
| EV-03 | `/employee/tenders` | English | 1280px | Table |
| EV-04 | `/employee/tenders` | Arabic | 1280px | Table |
| EV-05 | `/manage/tenders` | English | 714px | Cards |
| EV-06 | `/manage/tenders` | Arabic | 714px | Cards |
| EV-07 | `/manage/tenders` | English | 1280px | Table |
| EV-08 | `/manage/tenders` | Arabic | 1280px | Table |
| EV-09 | `/admin/suppliers` | English | 714px | Cards |
| EV-10 | `/admin/suppliers` | Arabic | 714px | Cards |
| EV-11 | `/admin/suppliers` | English | 1280px | Table |
| EV-12 | `/admin/suppliers` | Arabic | 1280px | Table |
| EV-13 | `/admin/suppliers` | English | 714px | Suspend confirmation, then cancelled |
| EV-14 | `/admin/suppliers` | Arabic | 714px | Keyboard focus and confirmation cancellation |
| EV-15 | `/admin/suppliers` | Arabic | 1280px | Suspend confirmation, then cancelled |

## 6. Regression and Accessibility Checks

- No visible horizontal page overflow, clipped content, overlapping buttons, or badge collisions were observed in the captured screens at 714px and 1280px.
- The supplier directory’s document client width was 699px at a 714px `window.innerWidth`; the document scroll width was also 699px, so no horizontal overflow was present in that checked state.
- Keyboard navigation reached the supplier Suspend action, confirmation action, and Cancel button. Focus visibility was visible on the focused link, filter control, and supplier action.
- Focus restoration after cancelling the confirmation is the confirmed P2 issue described above.
- Screenshots do not establish screen-reader behavior, contrast conformance, or full WCAG compliance.

## 7. Explicitly Unverified Scenarios

- Exact 375px, 768px, 1366px, and 1920px viewports, including breakpoint boundaries.
- Very long English or Arabic tender titles, requester names, legal names, and registration numbers at 375px.
- Supplier Reactivate styling and confirmation, because the available seeded directory rows were active.
- Empty, loading, and error states for these lists.
- Keyboard focus behavior for employee and managed-tender links beyond their presence and accessibility-tree labels.
- Screen-reader announcements, contrast measurements, browser zoom, and full accessibility conformance.
- A before/after visual comparison: no saved pre-change screenshots were available in this run.

## 8. Final Recommendation

At the two measured widths, the card/table presentations expose the requested information and actions in both locales without visible clipping. Address the P2 supplier confirmation focus restoration issue, then repeat the visual pass at the four exact requested widths using a browser surface with explicit viewport sizing. Include long Arabic and English sample values and a suspended supplier row in that pass.
