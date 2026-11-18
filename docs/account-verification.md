# Afrixa account verification

## Verification levels

- **Identity verified (blue badge):** voluntary request, government-issued identity document, manual Afrixa review, decision and notification.
- **Business/store verified:** separate voluntary request, legal business name and supporting registration/tax/trade documents, manual Afrixa review, distinct business badge.

## Proposed fees and service levels

| Request | Fee | Target review time |
|---|---:|---|
| Identity verification | 1,500 FCFA (XOF) | 3–5 business days |
| Business/store verification | 5,000 FCFA (XOF) | 5–7 business days |

These are the proposed launch prices. The migration validates the fee snapshot on submission, but payment is intentionally **not marked as paid**: a trusted payment checkout/webhook must be integrated before collecting fees. Do not approve a request based only on a client-side payment claim. An administrator may later waive or refund through a trusted server action.

## Security model

- Documents are stored in the private `account-verification-private` bucket (10 MiB per file; JPEG, PNG, WebP, PDF).
- Object paths must begin with the authenticated user's UUID. Applicants can upload/read their own objects only.
- Applicants can insert a request and read their own request. They cannot update or delete submitted requests.
- Review queue, reviewer decisions, event history, badge writes, and temporary signed document links are reserved for the admin-only Edge Function using `service_role`.
- Submission, review-start, approval, and rejection each create an in-app notification. Existing notification delivery hooks may also send push notifications when configured.
- Profile badge columns are public display metadata, but a trigger rejects attempts by ordinary users to change them.
- Never put identity documents, document URLs, rejection notes, or personal identifiers in public profile rows.

## Request lifecycle

`pending -> in_review -> approved | rejected`

A request can be cancelled only through a future trusted server action. A user may have at most one active request per verification type. Rejected users may submit a new request after the current request is closed.

## Remaining implementation before production

1. Build the user application screen (type selection, required fields, private uploads, progress/status).
2. The applicant screen, admin review screen, review Edge Function, signed document access, approve/reject, and audit trail are implemented in this branch. A trusted cancellation action remains to be added.
3. Integrate FedaPay/SaaSPay checkout and verify payment only from signed provider webhooks.
4. Add notifications for submission, in-review, approval, rejection, and payment state.
5. Run migration in staging, verify RLS and Storage access with two distinct users plus service_role, and add end-to-end tests.
6. Obtain legal/privacy review for identity-document retention, access logs, retention period, and deletion requests before launch.

Do not enable automatic approval or public access to the bucket.
