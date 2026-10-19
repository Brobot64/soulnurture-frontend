# PNA 4 — backend requirements for frontend completion

Design: https://www.figma.com/design/DLJJvIrVSJfLLiuXeGrHXv/PNA-4?node-id=0-1

Reviewed 2026-10-19 against the sibling `natlas` backend. Backend code is unchanged. Paths below include the `/api` prefix; proposed contracts are explicitly marked and are not called by the frontend.

## Frontend delivery and current boundaries

| Design area | Frontend / existing integration | Remaining dependency |
| --- | --- | --- |
| A: check-in and reflection | Existing journey retained; resource navigation connected; consent actions fail closed | Immediate-intervention copy must depend on a confirmed handoff, not a mood or an AI suggestion |
| B: authentication | Existing email/password and first-password flow; password recovery/reset; unavailable-access state | School-link + Student ID activation is not equivalent to email login |
| C: human support | School chat request remains the creation path; separate own-request list/detail and status guide | Student-safe follow-up lifecycle, history and explicit check-in-sharing contract |
| D: safeguarding | Unavailable/role-denied screen and explanatory guide; no sensitive flag queries | School isolation and the professional review contract below |
| E: privacy/access | Server-sourced disclosure and agreement record; existing school administration retained; access-activity screen uses recorded school/account actions | School access generation, richer registration and authentication audit events |
| Resources | Authenticated catalogue, category/search, saved toolbox and metadata details | Production content, resource detail payload and removal from toolbox |

No sample students, placeholder media, fabricated status transitions or successful review messages should substitute for these dependencies. The older resources section (`85:411`) is hidden in Figma; the active header and A4 still link to resources, so the frontend uses the active brand system without treating hidden layouts as authoritative.

## P0 — secure existing APIs before expanding clinical access

### School-scoped safeguarding and reviews

Evidence: `natlas/src/support-flags/support-flags.service.ts:13` ignores the caller in its list; acknowledge/in-review mutations update by flag ID. `natlas/src/dashboard/dashboard.service.ts:13` aggregates globally. `natlas/src/support-requests/support-requests.service.ts:225` writes a review before checking the staff school.

Required changes to existing endpoints:

- `GET /api/v1/support-flags`, its acknowledge/in-review POSTs, and `GET /api/v1/dashboard/counsellor`: derive school scope from the authenticated account, including counts; never accept a client school ID as authority.
- `PATCH /api/v1/support-requests/:id`: check school/role/ownership before any write, audit entry, notification or chat creation.
- Validate filter enums with DTOs. Define whether `SUPPORT_STAFF` has clinical-indicator access; Figma D6 specifies authorised counsellors and psychologists, not school/platform administrators.
- Follow-up mutations need the same resource-level scope; role checks alone do not establish access to a student.

Acceptance: school A cannot list, count, read or mutate school B's records, including guessed IDs; denied operations have no side effects. Deactivated accounts/schools are rejected. Add two-school integration tests for each route and role. The new indicators page intentionally performs no flag/dashboard fetches until this is resolved.

### Safe student request routing and attachments

Evidence: `natlas/src/support-requests/support-requests.service.ts:36–77` lists global active people and accepts a support person/check-in/conversation without school/ownership checks.

- Scope support people to the student's school and verify eligibility server-side, or provide a school-queue request API that does not require the student to choose a global recipient.
- Validate `personType` against the stored person, not just the submitted enum.
- Validate that attached check-in and conversation belong to the authenticated student and that their relationship is correct.
- Treat including a check-in as an explicit, recorded sharing choice; omission must not silently attach the latest check-in.

The frontend retains the existing school chat creation path instead of exposing the global people picker. It does not manufacture a support-request record from a chat thread.

### Consent and resource ownership

- `GET /api/v1/resources/tailored?checkInId=...` must verify check-in ownership (`resources.service.ts:49`). The frontend does not call it with a check-in ID until this is fixed.
- Toolbox reads must exclude resources that are no longer approved/active; the frontend also filters them but is not the security boundary.
- Generic `POST /api/v1/consent/accept` must not accept reserved AI-disclosure versions without the required agreement checklist. Use the dedicated disclosure acknowledgement route.

Acceptance: another student's check-in cannot affect recommendations; withdrawn resources cannot be retrieved through saved-item APIs; generic consent cannot bypass the AI gate.

## P1 — D1–D5: professional indicator review

Figma nodes: `257:583`, `258:585`, `259:586`, `260:588`, `260:679`.

Existing flag data (`triggerLabel`, `source`, `severity`, `aiContextSummary`) is real; a duplicate generic indicators API is unnecessary. Current OPEN/IN_REVIEW/ACKNOWLEDGED states do not represent the full Figma review/follow-up workflow.

Proposed extensions after P0:

- `GET /api/v1/support-flags/:id`: school-authorised detail including safe student identity, source/trigger explanation, authorised check-in context, current state/version, related support request and recorded reviews.
- Extend flag list with validated search, pagination and server-derived review counts. Clearly define the date window for “completed this week.”
- `POST /api/v1/support-flags/:id/reviews`: `{ decision: "NO_FURTHER_ACTION" | "FOLLOW_UP" | "SAFEGUARDING_PROCEDURE", note?: string, expectedVersion: number }`; decision names are proposed, not current enums.
- Return `{ reviewId, flagId, status, decision, recordedAt, recordedBy, version }` only after durable persistence. Include a student-visible-notification outcome if one actually occurred.
- Record author/time and previous state in an audit trail. Define assignment, resolution, permitted transitions, and repeat/concurrent-review behavior. Return `409` for stale versions.

Acceptance: D3 appears only after a durable review. The UI must never infer notification, referral, safeguarding action or follow-up completion from an acknowledgement. Approved staff must sign off trigger descriptions; example Figma thresholds are not production rules.

## P1 — C2–C6: student request lifecycle

Figma nodes: `252:562`, `253:566`, `253:654`, `254:574`, `254:690`, `343:4973`.

Existing owner endpoints `GET /api/v1/support-requests` and `GET /api/v1/support-requests/:id` are integrated. They return raw request states but no student-safe follow-up records or status history. The staff queue's `queueStatus` must not be inferred from chat PENDING/ACTIVE/CLOSED.

Extend the existing owner response, rather than duplicating it:

- Preserve `id`, submitted `note`, `createdAt`, `updatedAt`, schedule and recipient identity.
- Add server-derived `queueStatus`, `followUp: { status, dueAt, completedAt } | null` and `timeline: [{ id, status, occurredAt, publicMessage? }]`.
- Return an explicit, authorised `sharedCheckIn` projection only when the student chose to share it. Include the sharing timestamp/scope, not a claim that all AI history is shared.
- Add an authorised `chatThreadId` when a review actually opens a conversation, allowing request-to-chat navigation without guesses.
- Remove internal `reviewNote`, indicator context and professional-only notes from student projections; use a separate deliberate `publicMessage` for visible updates.
- Define pagination and whether students can cancel a queued request. Do not add a cancellation button until supported.

Acceptance: a student sees only their own requests, real persisted timestamps and genuine transitions; cancelled/escalated states remain distinct; no clinical notes leak. Request sent, staff reviewed and chat connected are separate facts. No guaranteed response time or emergency dispatch unless the service provides it.

## P1 — resources and content delivery

Existing catalogue/filter, toolbox GET and idempotent toolbox POST are implemented, not missing APIs.

- Proposed `GET /api/v1/resources/:id`: approved/active metadata plus structured content, accessibility metadata/transcript and a safe production media URL as appropriate to the resource type. Missing/unapproved resources return `404`.
- Proposed `DELETE /api/v1/resources/toolbox/:resourceId`: idempotently remove the caller's saved resource and return the updated count or `204`.
- Populate reviewed production content. Existing seed media under `cdn.example.com` is not playable content; metadata alone is not an article or exercise.
- Declare valid media kinds and allowlisted delivery origins. Do not return executable HTML as trusted frontend markup.

Acceptance: catalogue, details and toolbox agree on approval state; removed content is unavailable; saving twice is safe; removal cannot affect another account. Until then, resource detail displays metadata and an honest content-unavailable message, and Saved is not an unsupported toggle.

## P1 — B1–B3 and E5–E8: school access and student activation

Figma nodes: `146:481`, `146:528` / `264:606`, `146:575`, `329:1021`, `329:1123`, `330:1021`, `330:1114`.

Current school creation, enrolment and suspension work, but short codes/email provisioning do not implement the designed school-link + Student ID activation flow.

Proposed contract, to be reconciled with existing school/auth modules:

- School access resolution: a public endpoint takes a school access slug and returns only safe display name and availability. Unknown, expired and suspended links reveal no student data.
- Student activation: server-validated school + authorised Student ID plus approved proof of ownership; rate limited and enumeration resistant. A Student ID or QR link alone must not grant an account.
- One-time activation exchange creates the student's private password and session; returning users follow the authenticated sign-in flow. Specify expiry, replay prevention and recovery.
- Administrative access details return a stable/rotatable school URL and code; QR is rendered from that URL, not guessed in the client. Rotating/suspending access invalidates the intended links without deleting audit history.
- Extend school registration with agreed DTO fields for school type/address/contact/representative/pilot authorisation; define validation and who may edit them.
- Provide authorised-student import with validation preview, per-row results and replay behavior. Preserve real school-issued IDs; do not generate replacements silently.

Acceptance: unknown IDs never confirm enrolment; paused/withdrawn students cannot activate; suspension applies across existing sessions and links; imports cannot cross schools. Existing email/password login and forced first-password change must continue working during rollout.

Password recovery is **already supported** through Better Auth `POST /api/auth/request-password-reset` and `/reset-password`, with a configured mail callback. It is integrated by the frontend; deployment must allow the frontend reset URL as a trusted origin and deliver mail.

## P1 — E9: complete access audit log

Figma node `331:1021`.

Existing `GET /api/v1/admin/activity?kind=schools|people&limit=100` supplies recorded school/account administration. The frontend uses those records and explicitly does not call them successful/blocked sign-ins.

Proposed `GET /api/v1/admin/access-log` (or extend activity with a dedicated access projection):

- Query: cursor/limit, schoolId, date range and action/result filters.
- Response: `{ items: [{ id, occurredAt, action, school, actor, result }], nextCursor }`.
- Persist school-access changes, activation completion and sign-in outcomes from server authentication hooks. Define `ALLOWED`, `BLOCKED`, `RECORDED` precisely; result cannot be inferred from action name.
- Platform administrators only, with school-admin scope explicitly defined if later required. No check-in, chat, consent content, passwords, reset tokens or unredacted request bodies.
- Define retention and audit-log export authorization; timestamps must be server-generated.

Acceptance: auth events are durable and filterable; denied access does not reveal whether a student exists; wellbeing content never enters the access projection. Empty log and failed load remain distinct states.

## P2 — consent version consistency

Existing disclosure read/status/acknowledge endpoints support E1–E4 and are integrated. Add the displayed disclosure `version` to acknowledgement input and reject stale versions with `409`, returning the current instrument for re-reading. The client must not record agreement to a different version than the one displayed.

Privacy preference persistence exists, but the sharing/parent-notification/peer-companion fields are not connected to downstream behavior. Do not present those toggles as effective safeguards or delivered services until their semantics and enforcement are implemented.

## Backend acceptance checklist

- Two-school and role-matrix tests cover every sensitive read/mutation, including denied side effects.
- API DTOs and OpenAPI describe the actual responses; frontend contracts updated together.
- Missing IDs, unauthorised IDs, validation failures, stale writes and unavailable services have consistent error envelopes.
- Browser acceptance covers request creation/review, consent/version mismatch, recovery links, approved resource playback and suspended-school access with real APIs.
- No fake patient/student fixtures, production media placeholders, frontend-only authorisation or inferred successful handoffs ship as completed functionality.
