# Influencer Registration Step 6 and Review Workflow

## Scope

This adds only Step 6, application submission, application tracking, and admin review workflows for the existing influencer registration wizard.

## Routes

- `/influencer/register/content-review`
- `/influencer/application-under-review/:applicationId`
- `/influencer/application-status/:applicationId`
- `/admin/influencers` now includes an influencer application queue.

## API

- `POST /api/influencer/content-review`
- `POST /api/influencer/submit`
- `GET /api/influencer/application-status`
- `GET /api/influencer/application-status/:applicationId`
- `GET /api/influencer/application/:applicationId`
- `GET /api/influencer/admin/applications`
- `GET /api/influencer/admin/application/:applicationId`
- `PATCH /api/influencer/admin/application/:applicationId/review`

## Workflow

Step 6 saves sample content, identity documents, optional portfolio details, and brand collaboration proof. Submit validates:

- Step 3 profile data exists
- Step 2 social verification has at least one verified or reviewable profile
- Step 4 business information exists
- Step 5 payment information exists
- At least 3 sample content files exist
- At least 1 identity document exists

On submit the application is locked into `submitted`, receives an application number, queues future AI review, creates a review audit record, and opens the under-review page.

## Admin Decisions

Admins can:

- Approve
- Reject
- Request changes
- Suspend
- Request documents
- Add notes

Approval creates or upgrades an influencer user account, activates the influencer profile, creates storefront-ready profile data, and enables the existing influencer dashboard path.

## Future Hooks

- Replace memory upload handling with resumable chunk uploads for large videos.
- Connect OCR and virus scanning workers to the queued document records.
- Connect notification dispatch for email, SMS, and in-app events.
- Connect AI review flags to the `contentReview.aiReview` object.
