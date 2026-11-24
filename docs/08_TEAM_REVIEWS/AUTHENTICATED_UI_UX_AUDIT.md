# Authenticated UI/UX Visual Audit

Historical review evidence. The accepted response is in [ADR 0008](../05_ARCHITECTURE/ADR/0008_RESPONSIVE_ACCESSIBLE_WEB_PATTERNS.md).

- **Review date:** 2026-11-24
- **Environment:** Local frontend at `http://localhost:3000`
- **Review type:** Visual and interaction audit; no application data or source code was changed.

## 1. Executive Summary

The authenticated product keeps a consistent visual identity and uses readable cards, status badges, and labeled forms on desktop. The clearest confirmed defects are mobile table layouts: important status and action columns sit outside the viewport in employee, procurement, legal-review, and supplier-administration lists. The employee and procurement tender lists are especially hard to use at phone width because the visible columns do not reveal all available information or actions.

The audit used the documented local demo accounts for supplier, employee, legal reviewer, procurement officer, administrator, and committee member roles. Screens were opened and visually reviewed in English and Arabic where access and the fixture state allowed. Consequential decisions, publication, account suspension, nominations, saves, uploads, and bid submissions were not submitted.

Five confirmed findings are listed in Section 10. The seeded state limited some workflows: supplier bid parts were locked, the standing legal reviewer had no tender assignments, and the committee-member assignments showed “Waiting for bids.” As a result, bid-part replacement and live bid-evaluation screens could not be reviewed.

## 2. Visual Inspection Methodology

- Read [UI_UX_AUDIT.md](UI_UX_AUDIT.md) and [VISUAL_UI_UX_AUDIT.md](VISUAL_UI_UX_AUDIT.md) first. This report records only issues visually confirmed in authenticated UI.
- Used the local frontend in the Codex in-app browser and the repository’s documented test accounts. No authentication or authorization behavior was bypassed.
- Captured and reviewed screenshots at 375×812, 768×1024, 1366×900, and 1920×1080 where listed below. Screenshots were captured from rendered pages, not generated from source.
- Opened representative list, detail, and form pages; inspected navigation, tabs, status filters, review controls, and bid-form fields. No consequential action was submitted.
- No automated tests were run. Empty or loading states were noted only where actually observed; validation, success, and error outcomes were not forced by submitting data.

### Evidence reference convention

References such as `EMP-LIST-375-EN` identify browser screenshots captured during this audit. They point to the corresponding screenshot in the Codex browser interaction history; separate image files were not created because the only permitted new repository file is this report.

## 3. Pages and Viewports Inspected

| Role | Pages and workflow surfaces opened | Viewport and locale coverage | Limits |
|---|---|---|---|
| Supplier | Profile; My Bids; Bid Details; bid-part states | Profile: 375, 768, 1366, 1920 EN; 375 AR. My Bids: 375 EN/AR. Bid Details: 375 and 1366 EN. | No separate supplier dashboard was exposed in the account navigation. Bid-part replacement was unavailable because every displayed part was locked under evaluation. |
| Employee | My tenders; Create Tender Draft; draft detail; Edit Draft | My tenders: 375, 768, 1366, 1920 EN; 375 and 1366 AR. Create/edit: 375 and 1366 EN; edit at 375 AR. Draft detail at 1366 EN. | Draft creation and editing were viewed without saving. Employee assignment page was not independently reviewed for this account. |
| Legal committee | Legal review queue; application details; Legal decision controls; My Assignments | Queue: 375, 768, 1366 EN. Application detail: 375 and 1366 EN. The Arabic detail route was attempted at 375 but did not visually finish loading during the capture. | The standing legal reviewer had no tender assignments. Decision controls were inspected but not submitted. |
| Committee member | My Assignments | 375, 768, 1366, 1920 EN; Arabic page text was checked in the accessibility tree, without a visually confirmed capture. | All three assignments displayed “Waiting for bids.” Cards exposed no visible links or action buttons, so no evaluation detail opened. |
| Procurement officer | Managed Tenders; tender detail; Accept/edit scoring; Terms of Reference; Supplier Bid Form editor | Managed list: 375, 768, 1366, 1920 EN; 375 and 1366 AR. Tender details and editor: 375 and 1366 EN where captured. | Draft acceptance/scoring, publishing, committee nominations, and form saves were not submitted. The under-evaluation fixture was read-only. |
| Admin | Supplier Directory; Committee Nominations; Raised Signup Requests; request details | Supplier directory: 375, 768, 1366 EN; Arabic desktop. Committee nominations: 375 and desktop EN; 375 AR. Signup list/details: 375 and desktop EN; request detail 375 AR. | Suspend/reactivate, nomination approval/rejection, and supplier-account acceptance were not submitted. |

## 4. Global Visual Issues

### AU-05 — Authenticated header consumes substantial mobile height

- **Role and page:** Shared authenticated shell; supplier, employee, legal, procurement, and admin pages.
- **Viewport:** 375×812, English and Arabic.
- **Screenshot evidence:** `SUP-PROFILE-375-EN`, `EMP-LIST-375-EN`, `PROC-LIST-375-EN`, `ADMIN-NOM-375-AR`.
- **Problem:** Brand, locale and account controls, sign-out, and the collapsed navigation occupy several stacked rows. On inspected protected pages, the page content begins around 220px from the top of the viewport.
- **User impact:** Users see little task content on initial mobile view and must scroll sooner, particularly in administrative workflows with long lists and forms.
- **Recommendation:** Keep the brand and essential account control in a compact header; make the navigation disclosure a single compact row and reduce repeated vertical padding on narrow screens.
- **Priority:** P2.
- **Estimated effort:** S (1–2 days).
- **Affected source:** Shared shell component not identified during this visual pass.

## 5. Page-by-Page Visual Review

### Supplier

- **Profile:** Form card and fields remain legible at the reviewed widths. Arabic right alignment is clear; Latin company and email values remain legible in the RTL form.
- **My Bids:** Two bid cards show tender title, status, and locked-part state in English and Arabic. Card layout remains readable at 375px.
- **Bid Details:** Legal, technical, and financial parts appear as distinct cards, with status, deadline, submitted filename, and download action. All three were locked in the available water-pumps fixture. No replacement control was displayed, so the replacement workflow could not be audited.
- **Dashboard:** No distinct supplier dashboard was exposed through the account navigation during this review; profile and bid surfaces were inspected instead.

### Employee

- **My tenders:** Desktop rows clearly distinguish title, created date, status badge, and View tender action. At 375px, the table is clipped horizontally; the status and action columns are outside the visible area. See AU-01.
- **Create/Edit Draft:** The form is split into Basic information and Title and description tabs. Category, estimated balance, currency, and paired English/Arabic title and description fields are visible. On desktop, the title/description fields are arranged side by side; at mobile they stack. The save action is clearly placed near the heading. No values were saved.
- **Draft detail:** Status and edit action are prominent, and the content is grouped by tabs. Committee cards clearly state that committees cannot be staffed while the tender remains a draft.

### Legal committee

- **Review queue:** One pending application appears in a table. At 375px, the action column falls outside the initial view and requires horizontal scrolling. See AU-03.
- **Application details:** Legal name, registration number, contact email, preferred language, submission date, and document downloads are grouped in readable cards. The decision form places the decision selector, optional note, irreversible-decision acknowledgement, and disabled submit button in a clear sequence. No decision was selected or submitted.
- **My Assignments:** The standing legal reviewer account displayed an empty state (“You have no committee assignments yet”). The member account displayed three populated assignment cards, all with “Waiting for bids.” Those cards did not expose a visible detail link or evaluation action; no bid-evaluation interface was available to inspect.

### Procurement officer

- **Managed Tenders:** The status filter is easy to identify and status badges are consistent. At 375px and 768px the table extends beyond the viewport, leaving later columns, including status, offscreen. See AU-02.
- **Tender detail:** The Overview, Accept/edit, and Terms of Reference sections are clearly separated. On a draft, the scoring form explains that weights must total 100 and that values lock at publication. No acceptance or publication action was activated.
- **Supplier Bid Form:** Legal, Technical, and Financial parts are grouped separately. The read-only published fixture displays fixed standard inputs and custom fields in a clear hierarchy. The page explains that publication locks the form. No fields could be edited for the selected published tender.
- **Publication and approval:** The draft acceptance/scoring interface was visually inspected. The workflow was not submitted; a published tender’s detail and bid-form editor were read-only.

### Admin

- **Supplier Directory:** Search and status filter precede the supplier table. Desktop actions are visible. At 375px, status and row actions require horizontal scrolling. See AU-04.
- **Committee Nominations:** Each nomination is presented as a card with nominee, tender, committee, account status, language selector, and distinct Approve/Reject buttons. The card stacks cleanly at mobile width in English and Arabic. No decision was submitted.
- **Raised Signup Requests:** The queue is a four-column table. Request detail separates applicant information from the accepted legal review and presents the final Accept action. At mobile width, table fields require horizontal scrolling. The acceptance action was not activated.

## 6. Responsive Design Findings

The authenticated mobile shell changes navigation into a disclosure control, and content cards generally stack cleanly. Forms such as the employee tender draft and legal application decision remain usable in a single column. The primary responsive weakness is administrative tables that retain desktop column structures and rely on horizontal scrolling. The visible scrollbar on some tables provides a cue, but it does not keep the most important action/status columns in view.

| Viewport | Confirmed observations |
|---|---|
| 375×812 | Employee, procurement, legal-review, and admin supplier tables extend beyond the initial viewport. Authenticated navigation occupies multiple header rows. Card-based nomination, detail, and assignment views remain readable. |
| 768×1024 | Employee list fits all columns in the captured view. Procurement managed-tender table still clips later columns; the legal queue fits its four columns. |
| 1366×900 | Employee and procurement tables display their full column sets; form and detail layouts use available width without observed clipping. |
| 1920×1080 | Employee and procurement list layouts remain centered and readable; no confirmed overflow issue was observed in those captures. |

## 7. Arabic/RTL Visual Findings

- Arabic navigation and page direction were right-aligned on the inspected authenticated routes.
- Employee draft fields and profile values were readable in RTL. Latin names, email addresses, account identifiers, and currency values remained legible within Arabic layouts.
- Arabic admin committee nomination cards kept buttons and the account-language selector visible at 375px.
- Some tender names remain in English in Arabic management lists when the displayed record has no Arabic title. This appears to be source-content fallback; it is recorded as a content observation, not a confirmed layout defect.
- Arabic coverage was not complete for every detail route or viewport. See Section 8.

## 8. Interaction and Usability Findings

### Confirmed interaction observations

- Employee Create/Edit tabs switch between basic fields and bilingual title/description fields.
- Procurement status filter and detail tabs were opened. Accept/edit reveals scoring fields and a primary acceptance action; Terms of Reference clearly reports that the inspected draft has no attached documents and is read-only.
- Legal decision selector exposes Accept and raise to admin / Reject application options. Submit remains disabled until required prerequisites are met. No choice or submission was made.
- Admin supplier status selector exposes Active and Suspended choices; search is visibly separate. No search query or status change was submitted.
- Admin committee nomination cards expose language selection and Approve/Reject actions. No decision was submitted.
- Supplier bid detail showed Download actions for submitted documents, but no part-replacement control because the parts were locked.

### Unverified states and workflow limits

- No success, server-error, or validation outcome was forced by submitting forms.
- Bid-part replacement could not be inspected because the supplier fixture’s legal, technical, and financial parts were locked under evaluation, with deadlines already passed.
- The legal reviewer account had no tender assignments. The committee-member account had three assignments, all marked “Waiting for bids”; its assignment cards exposed no visible navigation to bid scoring or review.
- Tender publication, bid submission, supplier suspension, nomination decisions, and legal/admin acceptance or rejection were not performed. Their post-action states and any confirmation dialogs remain unverified.
- No pagination controls were present in the small seeded queues, so pagination behavior could not be assessed.

## 9. Screenshot Evidence

Screenshot references below identify actual browser captures from the audit session. They are descriptive references, not persisted image files.

| Reference | Page and locale | Viewport |
|---|---|---:|
| `SUP-PROFILE-375-EN` | Supplier profile, English | 375×812 |
| `SUP-PROFILE-1920-EN` | Supplier profile, English | 1920×1080 |
| `SUP-BIDS-375-EN` / `SUP-BIDS-375-AR` | Supplier My Bids, English / Arabic | 375×812 |
| `SUP-BID-DETAIL-375-EN` | Supplier bid details, English | 375×812 |
| `EMP-LIST-375-EN` | Employee My tenders, English | 375×812 |
| `EMP-LIST-768-EN` | Employee My tenders, English | 768×1024 |
| `EMP-LIST-1366-EN` / `EMP-LIST-1920-EN` | Employee My tenders, English | 1366×900 / 1920×1080 |
| `EMP-LIST-375-AR` / `EMP-LIST-1366-AR` | Employee My tenders, Arabic | 375×812 / 1366×900 |
| `EMP-FORM-375-EN` / `EMP-FORM-1366-EN` | Employee Create/Edit Draft, English | 375×812 / 1366×900 |
| `EMP-EDIT-375-AR` | Employee Edit Draft, Arabic | 375×812 |
| `PROC-LIST-375-EN` | Procurement Managed Tenders, English | 375×812 |
| `PROC-LIST-768-EN` | Procurement Managed Tenders, English | 768×1024 |
| `PROC-LIST-1366-EN` / `PROC-LIST-1920-EN` | Procurement Managed Tenders, English | 1366×900 / 1920×1080 |
| `PROC-LIST-375-AR` / `PROC-LIST-1366-AR` | Procurement Managed Tenders, Arabic | 375×812 / 1366×900 |
| `PROC-DRAFT-SCORING-1366-EN` | Draft detail, Accept/edit scoring tab | 1366×900 |
| `PROC-BID-FORM-375-EN` | Supplier Bid Form, read-only tender | 375×812 |
| `LEGAL-QUEUE-375-EN` | Legal review queue, English | 375×812 |
| `LEGAL-QUEUE-768-EN` / `LEGAL-QUEUE-1366-EN` | Legal review queue, English | 768×1024 / 1366×900 |
| `LEGAL-DETAIL-375-EN` / `LEGAL-DETAIL-1366-EN` | Legal application details and decision form | 375×812 / 1366×900 |
| `MEMBER-ASSIGNMENTS-375-EN` | Committee member My Assignments | 375×812 |
| `MEMBER-ASSIGNMENTS-1366-EN` / `MEMBER-ASSIGNMENTS-1920-EN` | Committee member My Assignments | 1366×900 / 1920×1080 |
| `ADMIN-SUPPLIERS-375-EN` | Admin Supplier Directory | 375×812 |
| `ADMIN-SUPPLIERS-768-EN` / `ADMIN-SUPPLIERS-1366-EN` | Admin Supplier Directory | 768×1024 / 1366×900 |
| `ADMIN-NOM-375-EN` / `ADMIN-NOM-1366-EN` | Admin Committee Nominations | 375×812 / 1366×900 |
| `ADMIN-NOM-375-AR` | Admin Committee Nominations, Arabic | 375×812 |
| `ADMIN-REQUESTS-375-EN` / `ADMIN-REQUESTS-1366-EN` | Admin Raised Signup Requests | 375×812 / 1366×900 |
| `ADMIN-REQUEST-DETAIL-375-EN` / `ADMIN-REQUEST-DETAIL-375-AR` | Admin Raised Request Details | 375×812 |

## 10. Prioritized Recommendations

### Confirmed visual defects

| ID | Role and page | Exact viewport | Screenshot evidence | Problem and user impact | Recommendation | Priority | Effort |
|---|---|---:|---|---|---|---|---|
| AU-01 | Employee — My tenders | 375×812 | `EMP-LIST-375-EN` | Status and action columns are clipped outside the viewport. Employees cannot quickly verify a tender’s state or discover its detail action from the initial view. | At phone widths, replace the wide row with stacked tender cards or prioritize title, status, and action in a responsive row. If horizontal scrolling remains, show a clear cue and keep the action discoverable. Component: `frontend/src/components/employee/EmployeeTenderList.tsx`. | P1 | S (2–3 days) |
| AU-02 | Procurement — Managed Tenders | 375×812 and 768×1024 | `PROC-LIST-375-EN`, `PROC-LIST-768-EN` | The table continues past the viewport; status and other later columns are not visible without horizontal movement. This slows draft triage and status-based management. | Use responsive cards or a compact column layout that keeps tender title and status visible; move secondary details into the row detail. Preserve an explicit scroll affordance if a wide table is retained. Component: `frontend/src/components/manage/ManagedTenderList.tsx`. | P1 | M (3–5 days) |
| AU-03 | Legal committee — Review queue | 375×812 | `LEGAL-QUEUE-375-EN` | The Action column / View application link sits beyond the initial viewport. The visible horizontal scrollbar is the only cue that a decision task is offscreen. | Use compact cards with legal name, submitted date, and View application action visible together, or pin the action column on small screens. Component: `frontend/src/components/signup/ApplicationQueue.tsx`. | P2 | S (1–2 days) |
| AU-04 | Admin — Supplier Directory | 375×812 | `ADMIN-SUPPLIERS-375-EN` | Status and Suspend actions are offscreen to the right, separated from the supplier name. The core admin action is difficult to discover at phone width. | Convert each supplier row to a mobile card with status and action directly under the legal name; keep search and status filters stacked above. Component: `frontend/src/components/suppliers/AdminSupplierDirectory.tsx`. | P1 | M (2–4 days) |
| AU-05 | Shared authenticated shell | 375×812 | `EMP-LIST-375-EN`, `PROC-LIST-375-EN`, `ADMIN-NOM-375-AR` | Multiple stacked header/control rows push the start of page content to about 220px from the top, reducing the usable first-screen area across protected workflows. | Reduce mobile header height and vertical gaps; keep brand/account controls compact and navigation disclosure on one compact row. Component not identified during the visual pass. | P2 | S (1–2 days) |

### Suggestions and unverified concerns

- On the committee-member assignment list, keep the “Waiting for bids” status visible and provide an obvious route into the assignment when a review becomes available. The inspected fixture offered no action and all three entries were waiting; whether that is expected for this role/state is unverified.
- Validate the full legal, procurement, and admin decision flows with disposable test data before assessing confirmation dialogs, success feedback, and error recovery. Those outcomes were not exercised here.
- Revisit bid-part replacement with a supplier bid whose part is editable and before its deadline; the locked fixture cannot establish whether the replacement affordance is clear in the eligible state.

## 11. Final Senior Designer Assessment

The product’s authenticated pages have a coherent visual language, and card-based forms and detail views generally remain readable across narrow layouts. The main design debt is the use of desktop-width tables for high-frequency staff tasks. On mobile, hidden status and action columns turn simple review into a discovery problem. Prioritize AU-01, AU-02, and AU-04, followed by the legal queue and shared header refinements.

The audit confirms the supplier, employee, legal, procurement, and admin surfaces listed above, but it does not establish the complete bid-replacement or bid-evaluation experience. Those workflows need eligible fixture data before their visual design can be assessed.
