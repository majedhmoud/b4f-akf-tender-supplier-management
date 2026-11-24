# Frontend UI/UX Audit

Historical review evidence. The accepted response is in [ADR 0008](../05_ARCHITECTURE/ADR/0008_RESPONSIVE_ACCESSIBLE_WEB_PATTERNS.md).

- **Review date:** 2026-11-24
- **Evidence type:** Source inspection only; no rendered pages or viewport screenshots were reviewed.

## A. Executive Summary

The frontend has a clear, practical visual foundation: shared color tokens and controls, separate Latin and Arabic fonts, locale-driven direction, a role-aware sidebar, visible keyboard focus styling, and reusable loading, empty, and error patterns. The public tender and supplier signup paths, as well as staff queues, generally expose clear page headings, labels, and retry feedback.

The main weaknesses are incomplete visual verification at the requested breakpoints, inconsistent loading fallbacks (including a route Suspense boundary with no fallback), and a few small-screen or assistive-technology details that need confirmation in a rendered app. Tables are scroll-wrapped, which avoids forcing the full table width into narrow screens but can make columns less discoverable. Source code alone cannot establish final contrast, truncation, alignment, or actual keyboard/screen-reader behavior.

**UX maturity:** developing / coherent baseline, with meaningful shared patterns but uneven verification across the breadth of role-based workflows. **Production readiness:** not established by this source-only audit; complete the responsive and accessibility checks below before treating the UI as production-ready. No P0 issue is supported by the evidence inspected.

## B. Audit Methodology

- Enumerated `frontend/src/app` route, layout, error, not-found, and loading files. Traced page wrappers to feature components.
- Inspected shared shell/navigation/state components; representative public tender, employee tender, signup queue, bid list and managed tender list implementations; button and tab primitives; and `globals.css` tokens and base rules.
- Searched feature components for headings, form controls, labels, ARIA attributes, tables, state roles, and responsive utility classes. Generated API client files were excluded from UX evaluation.
- Reviewed locale/layout setup and route-to-role guarding to understand English/Arabic direction and role-specific navigation.
- **Viewports actually tested:** none. 375px, 768px, 1366px, and 1920px were not rendered or visually inspected. Browser/computer-use testing was prohibited by the repository instructions.
- **Tools:** read-only source inspection and text search. No tests were run; this is an audit, not product verification.
- **Limitations:** source evidence cannot prove actual contrast ratios after rendering, visual balance, zoom/reflow behavior, touch usability, live loading/error outcomes, keyboard order, or screen-reader announcements. API-dependent screens and realistic data were not exercised.

## C. Global Design Findings

### Strengths

- `src/app/globals.css` defines a restrained green/neutral palette, semantic colors, radius tokens, shared `.field-control` and `.panel` classes, and a visible `focus-visible` outline for links and form controls.
- `src/app/[locale]/layout.tsx` sets `lang`, `dir`, and distinct Latin/Arabic font variables, supporting locale-aware content rather than merely translating labels.
- `AppShell`, `SiteHeader`, and `AppSidebar` establish a shared signed-in/out shell. Sidebar links are role-aware and expose `aria-current="page"`; the compact sidebar has an expanded state and `aria-controls`.
- Common empty and error components exist, and many data views expose retry controls. Forms commonly pair visible labels with invalid state and inline feedback.

### Issues

- **Responsive behavior is not verified.** Several tables use `overflow-x-auto`; this contains wide content but does not itself explain to users that more columns are horizontally available. The authenticated shell also changes from a stacked layout to a fixed 15rem sidebar at `lg`, so both transition and content width need rendered checks.
- **Loading treatment varies.** Most route wrappers provide a sized skeleton, while the public tender list route uses `<Suspense>` without a fallback. Other shared shell Suspense boundaries use `null`, so initial content can be temporarily absent while session/language state resolves.
- **Small button variants are compact.** `components/ui/button.tsx` sets `sm` to `h-7` and `xs` to `h-6`; the audit cannot determine which instances are touch-critical or whether surrounding hit areas compensate. Check those usages on touch devices and enlarge controls where needed.
- **Design tokens are light-mode oriented.** `globals.css` defines a `.dark` token set, but this audit found no rendered dark-mode control or theme behavior. Do not count dark mode as a supported mode without verifying how it is activated and applied.
- **Translation completeness and real Arabic layout are unverified.** Both message files exist and the document direction switches by locale, but text expansion, mixed-direction identifiers, and translated error copy need a rendered RTL review.

## D. Page-by-Page Review

Notes below are source-based. Routes are shown without the locale prefix; each is available under configured locales unless the route implementation says otherwise. Shared strengths: route wrappers use the common shell; most async pages render a skeleton; most data views have empty/error feedback. Accessibility and responsive observations are not claims of rendered verification.

| Route / page | Purpose and what works | Source-based concerns and recommended review |
|---|---|---|
| `/` | Redirects to the tender list, keeping the public entry focused. | No landing content by design. Verify redirect preserves locale in both languages. Source: `src/app/[locale]/page.tsx`. |
| `/tenders` | Browse/filter/paginate public tenders; labeled category filter, URL-backed query, cards, loading/error/empty states. | Suspense boundary has no fallback in the route wrapper; add a meaningful skeleton fallback. Test filter + page changes and narrow-width cards in rendered UI. `src/components/tenders/TenderList.tsx`. |
| `/tenders/[tenderId]` | Public tender overview and documents, with section headings and a skeleton. | Inspect long bilingual titles, document names, and download controls at mobile width; source uses responsive two-column content at `lg`. Confirm unavailable/deleted tender state is understandable. `src/components/tenders/TenderDetail.tsx`. |
| `/tenders/[tenderId]/bid` | Supplier bid submission. | Route is public but the form's auth/deadline states and multipart flow require rendered journey checks. Verify long form/error summary and file-control usability on mobile. `src/components/bids/BidSubmitForm.tsx`. |
| `/supplier-application` | Guest supplier signup with legal fields and supporting document upload. | Dense multi-field/upload flow; verify error-to-field association, retained values after rejection, and field grouping/scroll on mobile. `src/components/signup/SupplierApplicationForm.tsx`. |
| `/sign-in` | Authenticates users; labeled email/password fields and field-level invalid feedback. | Confirm focus placement after failed submit and that async session/submit feedback is announced in real screen readers. `src/app/[locale]/(auth)/sign-in/SignInForm.tsx`. |
| `/account-setup` | Supplier sets a password from setup link; explicit checking, expired, used, invalid, resent, and saved states. | Many state transitions; verify focus and announcement behavior and link recovery affordance for expired/invalid states. `src/components/account/AccountSetup.tsx`. |
| `/profile` | Displays signed-in account identity/profile. | Verify long email/name wrapping and distinguish read-only account fields from editable supplier information. `UserProfile.tsx`, `SupplierProfileForm.tsx`, `SupplierCertificates.tsx`. |
| `/my-bids` | Supplier's submitted bids and next deadline; list, status, pagination, empty/error. | Check status/deadline language at a glance and long tender-title wrapping. Route uses `StaffGuard`; verify access for supplier roles and sign-in return navigation. `src/components/bids/MyBids.tsx`. |
| `/my-bids/[bidId]` | Supplier reviews bid parts and can replace eligible parts. | Multi-part status and upload controls make this a high-density workflow; verify deadline/locked states are distinguishable, destructive replacement intent is clear, and mobile order is usable. `MyBidDetail.tsx`, `BidPartInputs.tsx`. |
| `/my-assignments` | Committee member sees assignments. | Confirm role-specific empty state explains how assignments are created and long tender names do not obscure stage/status. `src/components/committees/MyAssignments.tsx`. |
| `/status` | Local API/database health view. | Useful diagnostic view; confirm status is conveyed textually (not color alone) and failure state gives a useful next action. `src/components/system/ApiStatus.tsx`. |
| `/employee/tenders` | Employee drafts and views own tenders; create action, table, empty/error, pagination. | Table is horizontally scrollable at narrow widths; review discoverability and sticky/visible action context. `EmployeeTenderList.tsx`. |
| `/employee/tenders/new` | Create draft tender with localized content and fields. | Translation fields can produce a very long form; review grouping/progress, required-field cues, and mobile language-section navigation. `src/components/employee/DraftTenderForm.tsx`. |
| `/employee/tenders/[tenderId]` | Employee views tender details and tabs. | Verify tab labels and panels announce correctly, keyboard operation matches expected tab behavior, and content-specific direction is correct. `EmployeeTenderDetail.tsx`. |
| `/employee/tenders/[tenderId]/edit` | Edits the employee tender through the shared detail component. | Same tab/detail concerns plus verify unsaved changes and save/cancel feedback. `EmployeeTenderDetail.tsx`. |
| `/manage/tenders` | Procurement officer filters and reviews managed tenders. | Table scroll on mobile; status filter label is rendered by shared `ManagementField`, so inspect its label association and selected-state feedback. `ManagedTenderList.tsx`. |
| `/manage/tenders/[tenderId]` | Procurement officer reviews/accepts/edits/publishes tender. | High-impact state-changing actions; source has feedback patterns, but confirm decision consequences, pending/disabled states, and destructive confirmation in rendered interaction. `ManagedTenderDetail.tsx`, `ManagedTenderForm.tsx`. |
| `/manage/tenders/[tenderId]/bid-form` | Builds tender bid-part form. | Complex repeated field groups; verify accessible names and error association for dynamic inputs, and whether users can distinguish Legal/Technical/Financial sections on small screens. `BidFormEditor.tsx`. |
| `/signup-reviews` | Legal committee queue of supplier applications. | Table is horizontally scrollable; verify essential legal-name/registration/action columns remain discoverable at 375px. `ApplicationQueue.tsx`. |
| `/signup-reviews/[applicationId]` | Legal reviewer inspects application documents and decides. | Decision and reason/confirmation controls are business-critical; verify required-reason messaging, document preview/download affordances, and post-decision navigation. `ApplicationDetail.tsx`. |
| `/signup-requests` | Admin queue of raised supplier requests. | Shares queue table; add/verify context distinguishing raised requests from legal-review pending items, and mobile table usability. `ApplicationQueue.tsx`. |
| `/signup-requests/[applicationId]` | Admin inspects raised request and accepts it. | Acceptance creates a consequential account workflow; verify duplicate-submit feedback, success next-step explanation, and recovery after conflict/error. `ApplicationDetail.tsx`. |
| `/admin/suppliers` | Admin searches/views supplier directory. | Verify search/filter empty state and table/card usability at narrow width; inspect status actions for clear reversible/destructive meaning. `AdminSupplierDirectory.tsx`. |
| `/admin/committee-nominations` | Admin reviews committee nominations. | Queue and approval controls need visible role/member context and clear conflict/error feedback; verify at mobile width. `AdminNominationQueue.tsx`. |
| `/not-found` | Locale-level not-found message with route back to tenders. | Good recovery link; ensure it is visually obvious and keyboard reachable. `src/app/[locale]/not-found.tsx`. |
| `/(staff)/not-found` | Staff route fallback reuses locale-level not-found. | Shared recovery is consistent; confirm authenticated shell context does not make the public tender destination confusing. |
| `/error` | Generic error with retry action, avoiding raw error details. | Appropriate safe copy; verify retry focus/announcement behavior and preserve user-entered form data where possible. `src/app/[locale]/error.tsx`. |
| `/(staff)/error` | Staff error boundary reuses generic error. | Same retry concern; verify repeated failure offers a route back or support context. |
| `/(auth)/error` | Auth error boundary reuses generic error. | Same retry concern, especially on sign-in/account setup; ensure an accessible recovery path remains available. |
| `/(staff)/loading` | Shared staff skeleton. | Generic single block may not communicate the eventual page structure; use page-matched skeletons where loading is prolonged. |
| `/(auth)/loading` | Shared auth skeleton. | Skeleton size is fixed to a centered medium form; check all auth pages, especially profile and assignment views, against that shape. |
| Unknown `/:locale/*` | Catch-all invokes not-found. | Intentional 404 behavior; verify query strings and localized recovery in actual navigation. `src/app/[locale]/[...rest]/page.tsx`. |

## E. Component-Level Findings

| Component / file | Current problem | Why it matters | Recommended solution |
|---|---|---|---|
| Public tenders route wrapper — `src/app/[locale]/(public)/tenders/page.tsx` | `<Suspense>` has no explicit fallback. | During a suspended render, there is no route-level loading UI supplied by this wrapper. | Supply the same sized skeleton pattern used by neighboring async routes. |
| `Button` — `src/components/ui/button.tsx` | `sm` and `xs` heights are 28px and 24px. | Compact targets may be difficult to activate by touch when used as standalone actions. | Audit all small-size instances; reserve compact variants for noncritical/closely grouped controls and provide at least 40–44px hit areas for touch-critical actions. |
| `AppShell` / `AppSidebar` — `src/components/layout/AppShell.tsx`, `AppSidebar.tsx` | At large widths the shell fixes sidebar at 15rem; at smaller widths navigation becomes a disclosure above content. | The change in navigation position and available content width affects every signed-in flow; source classes do not prove it fits at tablet/zoom widths. | Check 375/768/1366/1920px and 200% zoom; ensure disclosure, active link, and current content remain easy to locate. |
| Queue/list tables — `src/components/signup/ApplicationQueue.tsx`, `src/components/employee/EmployeeTenderList.tsx`, `src/components/manage/ManagedTenderList.tsx` | Tables rely on `overflow-x-auto` at all sizes. | Horizontal scroll can hide decision/action columns with little indication. | Test with keyboard and touch; consider mobile row cards or add a visible scroll cue while retaining table semantics. |
| `SiteHeader` — `src/components/layout/SiteHeader.tsx` | Header can wrap several controls and shows the full account email as a profile link. | Long email addresses and translated labels may compete for width on narrow screens. | Render with long addresses and Arabic labels at 375px; allow predictable wrapping/truncation with a full accessible name. |
| Loading boundaries — route `loading.tsx` files and `src/app/[locale]/layout.tsx` | Skeleton shapes differ, and root fallback is an animated blank block with `aria-busy` but no status text. | Screen-reader users may receive no useful loading announcement; visual skeletons may not indicate the expected content. | Add a concise visually hidden loading status and match skeleton shapes to route content; verify reduced-motion behavior. |
| `TabsList` / `TabsContent` — `src/components/ui/tabs.tsx` | Tabs are intentionally compact and depend on primitive behavior; caller direction defaults to LTR. | RTL tab order and keyboard behavior may vary by usage if callers omit locale direction. | Ensure each RTL caller passes `dir="rtl"`; test arrow-key movement and selected panel announcements in both locales. |

## F. User Journey & Workflow Issues

1. **Guest to supplier:** `/supplier-application` → legal review queue/detail → admin raised queue/detail → `/account-setup` → profile. The structure aligns with the described workflow and status feedback exists. Verify whether each success screen clearly states who acts next and whether the supplier should expect a setup email versus a completed account; this is a source-driven journey check, not a confirmed defect.
2. **Tender creation to publication:** employee list → create/edit draft → procurement management list/detail → bid form. Several route hops and separate role ownership are expected. Ensure each detail view has a clear return-to-queue action and keeps the tender title visible for orientation.
3. **Supplier bid lifecycle:** public tender detail → bid submission → my bids → bid detail/part replacement. Make deadlines and locked parts prominent and persistent; verify current source UI against real boundary states, especially when parts have different deadlines.
4. **Role navigation:** role-aware links reduce irrelevant options, but route guards render a skeleton until session/role resolution and then redirect. Test direct links and return-to-origin behavior for every role; users should receive a clear access outcome instead of a confusing loading pause.

## G. Accessibility Findings

- **Positive source evidence:** shared focus-visible styling; explicit labels on many inputs; `aria-invalid`/`aria-describedby` used in several forms; semantic page headings, lists, navigation landmarks, table headers, live status/error roles, and locale `lang`/`dir` are present.
- **P2: loading announcements are inconsistent.** Root loading fallback only exposes `aria-busy` on a blank container, and several `Suspense` fallbacks are visual skeletons. Provide an assistive-technology status label, and apply busy state to the actual region where appropriate.
- **P2: touch target sizing needs instance-level review.** Button `sm`/`xs` variants are 28px/24px high. Check any standalone interactive controls and enlarge where practical; confirm 24px minimum target size exceptions/spacing are satisfied for WCAG 2.2 AA.
- **P2: RTL tabs need caller verification.** The shared tab root defaults `dir` to `ltr`; ensure every Arabic tab set passes direction and verify keyboard navigation order.
- **P2: horizontally scrollable tables need keyboard and discoverability checks.** Confirm users can reach off-screen columns and understand overflow, including at 200% zoom.
- **Unverified, not asserted as defects:** WCAG contrast ratios, focus order, labels for every dynamic input, screen-reader reading order, zoom/reflow, file input usability, and all translated strings require rendered manual or automated accessibility testing.

## H. Prioritized Recommendations

| ID | Priority | Page/Component | File Path | Problem | Impact | Recommendation | Effort |
|---|---|---|---|---|---|---|---|
| UX-01 | P1 | Tender list loading | `frontend/src/app/[locale]/(public)/tenders/page.tsx` | Suspense boundary has no explicit fallback. | Initial suspended content may have no page-specific loading cue. | Add a sized skeleton fallback and verify it appears during delayed API/render. | Low |
| UX-02 | P1 | Responsive coverage | All routes | No rendered viewport review is available; key shell/table behaviors are breakpoint-dependent. | Layout overflow, clipped controls, and navigation failures remain unknown across required widths. | Render all major page families at 375, 768, 1366, and 1920px; record issues by route family. | Medium |
| UX-03 | P1 | Staff/admin tables | `frontend/src/components/signup/ApplicationQueue.tsx`; `EmployeeTenderList.tsx`; `ManagedTenderList.tsx` | Tables use horizontal scrolling without a visible overflow cue. | Users may miss action/status columns on mobile or zoom. | Validate touch/keyboard discoverability; use responsive row layout or clear scroll affordance if needed. | Medium |
| UX-04 | P2 | Button size variants | `frontend/src/components/ui/button.tsx` | `sm`/`xs` controls are only 28px/24px high. | Standalone touch targets may be hard to activate. | Audit usages and increase hit areas for consequential/isolated actions. | Low |
| UX-05 | P2 | Loading boundaries | `frontend/src/app/[locale]/layout.tsx`; auth/staff `loading.tsx`; route wrappers | Loading UI is inconsistent and some boundaries have no informative accessible label. | Users may perceive blank content or not receive status announcements. | Standardize skeletons and add a concise loading status for assistive technology. | Low |
| UX-06 | P2 | RTL tab callers | `frontend/src/components/ui/tabs.tsx` and callers | Shared direction defaults to LTR. | Arabic keyboard navigation or visual order could be incorrect if a caller omits `dir`. | Audit every tab use and pass locale direction; verify with keyboard in RTL. | Low |
| UX-07 | P2 | Header at mobile widths | `frontend/src/components/layout/SiteHeader.tsx` | Header items wrap; account email is displayed in full. | Small screens and long identifiers may crowd or destabilize header layout. | Test long email and Arabic labels at 375px; set predictable wrapping/truncation and accessible full name. | Low |
| UX-08 | P2 | Signup, bid, and decision workflows | `SupplierApplicationForm.tsx`; `BidSubmitForm.tsx`; `ApplicationDetail.tsx`; `MyBidDetail.tsx` | Complex consequential forms require state-by-state interaction review beyond source inspection. | Missing focus, summary, or recovery behavior could block high-value workflows. | Exercise invalid, pending, success, conflict, expired, and deadline states with keyboard and screen reader. | Medium |
| UX-09 | P3 | Dark theme tokens | `frontend/src/app/globals.css` | Dark token set exists, but theme activation/support was not established. | Unused or inconsistently applied theme styles can create false expectations and unverified contrast. | Confirm whether dark mode is supported; if not, remove/avoid exposing it in product expectations; if yes, test all semantic tokens. | Low |

## I. Quick Wins

- Add an explicit skeleton fallback to the `/tenders` route boundary.
- Audit usages of `size="sm"` and `size="xs"`; increase hit area for standalone actions.
- Add an accessible loading status to the shared root fallback.
- Check every shared `Tabs` caller for RTL direction.
- Run a focused 375px review of the header and queue tables before broad polish.

## J. Recommended Implementation Roadmap

1. **Critical fixes:** none confirmed at P0. Resolve any P0/P1 blockers discovered during rendered testing before release.
2. **High-impact improvements:** add public tender loading fallback; render key journeys at all four requested widths; validate tables, shell navigation, and long forms.
3. **Design system improvements:** define a consistent loading pattern and review compact button variants and header wrapping against existing tokens.
4. **Accessibility improvements:** verify touch targets, announce loading states, test keyboard and screen-reader flows, and check RTL tabs and table overflow.
5. **Final visual polish:** after the above, compare spacing, typography, and component alignment across public, supplier, employee, legal, procurement, and admin screens in both locales.

## K. Senior Designer Final Assessment

The codebase shows deliberate product design work rather than a collection of unrelated screens: the palette is restrained, common controls and states are reused, and role-specific tender/signup/bid tasks have explicit route structure. The accessible foundations are promising, especially labels, focus rings, status feedback, and Arabic direction support.

The evidence does not support a visual-quality verdict at the requested viewport sizes because no UI was rendered. The most important next step is a real responsive/accessibility pass over the tender, signup, bid, and admin decision journeys. Resolve the loading inconsistency and establish that tables, header/navigation, touch targets, and RTL interactions remain usable before making a production-readiness claim.
