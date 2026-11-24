# Visual UI/UX Audit

Historical review evidence. The accepted response is in [ADR 0008](../05_ARCHITECTURE/ADR/0008_RESPONSIVE_ACCESSIBLE_WEB_PATTERNS.md).

- **Review date:** 2026-11-24
- **Environment:** Running local frontend at `localhost:3000`
- **Evidence:** Screenshots captured and inspected in the in-app browser during this audit; no application source was changed.

## 1. Executive Summary

The accessible public experience looks coherent across the requested widths. The public tender list, tender detail, signup form, and sign-in form use consistent spacing, readable type, restrained green actions, and clear field labels. At 375px, the list cards and forms reflow into a single column; at 1920px, the public content remains centered rather than stretching across the screen. Arabic pages correctly switch to right-to-left alignment and use Arabic copy.

One confirmed visual concern is the tender list's loading state: it displays several large, featureless gray blocks rather than card-shaped content placeholders. During loading this can look like blank panels or a rendering failure. No other visual defect was confirmed in the screens that could be accessed.

Inspection of supplier and staff dashboards was limited by authentication. The employee route redirected to sign-in; no credentials were entered. Visual quality at those protected pages and for procurement, legal committee, and admin workflows is therefore not assessed here.

## 2. Visual Inspection Methodology

- Opened the running frontend in the Codex in-app browser.
- Captured screenshots at the requested widths: **375px**, **768px**, **1366px**, and **1920px**. Heights used were 812px, 1024px, 900px, and 1080px respectively.
- Inspected English tender list across all four widths; inspected Arabic tender list at 375px and 1366px.
- Inspected English tender detail, supplier signup, sign-in, and guest bid-submission notice at 375px. Also inspected Arabic sign-in at 375px.
- Interacted with public tender navigation, focused/opened the category selector, submitted the supplier form empty to observe validation, submitted sign-in empty to observe validation, and opened the guest bid route.
- Attempted `/employee/tenders`; the anonymous session was redirected to sign-in with a return path. Protected pages were not entered using credentials.
- No browser automation or screenshots from earlier runs were used as evidence. No tests were run.

**Limitations:** screenshots show visual states, not full WCAG conformance or keyboard/screen-reader behavior. No credentials were provided for the supplier/staff dashboards. The category selector was opened but no filter choice was made. No file was selected or uploaded. No dashboard table, pagination state, modal, or authenticated bid review screen could be inspected. Screenshots were inspected in the browser tool, but not saved as separate files because the task permits creating only this report file.

## 3. Pages and Viewports Inspected

| Page / state | Locale | Viewport | Result |
|---|---|---:|---|
| `/tenders` loaded list | English | 375 × 812 | Inspected; single-column cards and two-row header/navigation fit. |
| `/tenders` loaded list | English | 768 × 1024 | Inspected; content and header fit. |
| `/tenders` loaded list | English | 1366 × 900 | Inspected; content remains within a readable central width. |
| `/tenders` loaded list | English | 1920 × 1080 | Inspected; content stays centered with broad side margins. |
| `/tenders` loading state | English | 768 × 1024; 1366 × 900 | Inspected; large blank rectangular skeleton placeholders visible. |
| `/tenders/[tenderId]` | English | 375 × 812 | Inspected; sections stack vertically; document rows wrap. |
| `/supplier-application` | English | 375 × 812 | Inspected initial form and lower document controls. |
| `/supplier-application` empty-submit validation | English | 375 × 812 | Inline required messages and invalid outlines visible. |
| `/sign-in` | English | 375 × 812 | Inspected form layout. |
| `/sign-in` empty-submit validation | English | 375 × 812 | Inline field errors and form-level message visible. |
| `/sign-in` | Arabic | 375 × 812 | Inspected RTL alignment and translated controls. |
| `/tenders` | Arabic | 375 × 812; 1366 × 900 | Inspected RTL card/list layout and navigation. |
| `/tenders/[tenderId]/bid` guest state | English | 375 × 812 | Clear sign-in requirement and return link shown. |
| `/employee/tenders` anonymous redirect | English | 1366 × 900 | Redirected to sign-in; dashboard itself unavailable. |

## 4. Global Visual Issues

### V-01 — Tender list loading placeholders look like blank panels

- **Priority:** P2
- **Evidence:** screenshots V-03 and V-05 below; loading state on `/tenders` at 768px and 1366px.
- **Visible problem:** six tall, uniform pale-gray rectangles appear beneath the category selector. They contain no title, metadata, status, or action-shaped placeholder. The loaded list then replaces these blocks with tender cards.
- **Impact:** during initial loading, the large empty shapes provide little indication that tender cards are being fetched and can resemble blank or broken content panels.
- **Affected component:** `frontend/src/components/tenders/TenderList.tsx` (skeleton list).
- **Recommendation:** use card-shaped skeletons with short title, metadata, status, and action placeholders, preserving the current card dimensions and spacing.

### Confirmed strengths

- Public tender cards remain legible and single-column at 375px; the primary action expands to the card width on mobile.
- At 1920px the tender list stays centered with generous side margins; text and cards do not stretch to the full display width.
- English and Arabic public pages keep a consistent card, border, and button treatment. Arabic text aligns to the right and the category selector arrow moves to the left as expected for RTL.
- The mobile signup and sign-in forms fit within the viewport width. Labels remain above controls and validation messages appear next to invalid fields.
- The guest bid screen gives a concise explanation and a sign-in link that preserves the intended return route.

No other visual defect was confirmed in the available screenshots. This does not establish that protected pages or untested states are defect-free.

## 5. Page-by-Page Visual Review

### Public tender list — `/tenders`

- **What works:** strong heading/subtitle hierarchy; category filter sits before the result list; loaded cards separate title, category, deadline, status, and action. Mobile cards stack without apparent horizontal overflow. Desktop content remains constrained and centered.
- **Confirmed issue:** loading skeleton blocks are too featureless (V-01).
- **Unverified:** filter selection behavior, pagination, empty/error states, and dense result sets were not exercised.

### Public tender detail — `/tenders/[tenderId]`

- **What works:** at 375px the title and status are visible near the top, followed by distinct description, document, and deadline panels. Document labels and download actions wrap within the card; deadline rows are stacked.
- **Confirmed issue:** none.
- **Unverified:** long document names beyond the sample, downloads, and alternate tender states.

### Supplier signup — `/supplier-application`

- **What works:** single-column mobile form with clear separation between company details and legal documents. Upload controls and language fields have visible labels. Empty submission produces red invalid borders and inline required messages.
- **Confirmed issue:** none.
- **Unverified:** successful submission, retained values after server errors, real file names, and file-size feedback.

### Sign-in — `/sign-in`

- **What works:** centered card with clearly separated email/password fields and a full-width primary action at mobile width. Empty submission adds field-level messages and a form-level explanation; the card expands without clipping.
- **Confirmed issue:** none.
- **Unverified:** successful sign-in, failure states, focus movement, and password-manager behavior.

### Guest bid submission — `/tenders/[tenderId]/bid`

- **What works:** unauthenticated visitors see a clear sign-in requirement and an in-context sign-in link. The return route is preserved.
- **Confirmed issue:** none.
- **Unverified:** authenticated bid form, upload controls, deadline states, and review/replace flows.

### Supplier dashboard, employee, legal committee, procurement, and admin

- **Status:** not visually reviewed. The tested employee route redirected to sign-in in the anonymous session. Other role-specific dashboards require authentication and were not opened.
- **Recommendation:** repeat the visual review with authorized test accounts for supplier bids/profile, employee tender creation/editing, legal review queues, procurement management, and admin supplier/committee queues.

## 6. Responsive Design Findings

- **375px:** public list cards become one-column cards with full-width actions; signup and sign-in forms fit within the available width. Tender detail panels stack and document labels wrap. No horizontal overflow was visible in the inspected public screens.
- **768px:** the public tender list remains a simple, readable single-column layout. The tested loading state shows the featureless skeleton blocks described in V-01.
- **1366px:** public list content has comfortable margins and readable width. Arabic layout remains right-aligned and the card action is positioned on the opposite side of the text as expected.
- **1920px:** public list remains centered instead of expanding across the full screen. Large surrounding whitespace is appropriate for the short two-item dataset shown; no clipping was visible.
- **Not verified:** responsive navigation while signed in, staff/admin tables, 200% zoom, landscape phone, and smaller/larger content volumes.

## 7. Arabic/RTL Visual Findings

- At 375px and 1366px, the Arabic tender list uses right-aligned headings and card content. The category selector label and value align right, with the native dropdown indicator on the left.
- At 375px, Arabic sign-in labels, fields, and primary action align consistently to the right; the English locale switch remains readable.
- At 375px, Arabic signup fields and section headings also use RTL alignment and fit the viewport width.
- Tender cards containing Arabic titles while the page locale is English remain readable in the inspected sample.
- No RTL clipping or overlap was confirmed. Mixed-direction dates/identifiers and long Arabic content need broader data coverage before being considered verified.

## 8. Interaction and Usability Findings

- Opening the category selector gives it a visible focus ring. Selecting a category and checking URL/filter results was not completed.
- The supplier form's empty submit shows field-level errors beside required controls and leaves the form structure visible while the page scrolls to the validation region.
- The sign-in form's empty submit shows invalid outlines, field messages, and a summary-style message above the primary button.
- Opening a tender from the list reaches the detail view with a clear “All tenders” return link.
- A guest opening the bid route sees an explicit sign-in requirement and a return-aware sign-in link.
- An anonymous visit to the employee route redirects to sign-in with `returnTo` set. Supplier and staff role-specific interactions remain unverified.

## 9. Screenshot Evidence

The screenshots listed below were captured and visually inspected in this audit's in-app browser session. They are identified by capture reference because the task allows only the report to be created; no separate image files were written.

| Ref | Capture |
|---|---|
| V-01 | English `/tenders`, loaded list, 375 × 812. |
| V-02 | English `/tenders/[tenderId]`, loaded detail, 375 × 812. |
| V-03 | English `/tenders`, loading skeleton, 768 × 1024; then loaded list at same viewport. |
| V-04 | English `/tenders`, loaded list, 1366 × 900. |
| V-05 | English `/tenders`, loading skeleton and loaded list, 1920 × 1080 viewport (loading state captured at 1366 × 900; loaded state at 1920 × 1080). |
| V-06 | Arabic `/tenders`, loaded list, 375 × 812. |
| V-07 | Arabic `/sign-in`, loaded form, 375 × 812. |
| V-08 | Arabic `/tenders`, loading then loaded list, 1366 × 900. |
| V-09 | English `/supplier-application`, top of form and document controls, 375 × 812. |
| V-10 | English supplier signup after empty submit, inline validation, 375 × 812. |
| V-11 | English `/sign-in`, loaded form, 375 × 812. |
| V-12 | English sign-in after empty submit, inline validation, 375 × 812. |
| V-13 | English guest `/tenders/[tenderId]/bid` sign-in notice, 375 × 812. |
| V-14 | English `/employee/tenders` redirect to sign-in, 1366 × 900. |

## 10. Prioritized Recommendations

| ID | Priority | Location | Problem / impact | Recommendation |
|---|---|---|---|
| V-01 | P2 | Public `/tenders` loading state; `src/components/tenders/TenderList.tsx` | Large featureless blocks resemble blank panels and do not preview the card structure. | Shape placeholders like the loaded tender cards: title, metadata, status, and action. |

No P0 or P1 visual issue was confirmed in the pages available during this review.

## 11. Final Senior Designer Assessment

The accessible public pages have a consistent, restrained look and adapt well in the tested mobile and desktop captures. English and Arabic layouts both read coherently, and the two tested forms provide clear inline feedback. The visible tender-list skeleton is the only confirmed visual issue, and it is a modest but worthwhile polish item.

This is not a full visual sign-off for the application. Supplier and staff workflows account for much of the product and could not be viewed without an authorized session. Review those role-specific pages, tables, and action states at the same widths before making a production-wide design assessment.
