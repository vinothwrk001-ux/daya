# Influencer Registration Step 1

Route aliases:

- `/register/influencer`
- `/influencer/register`

This page is the first step of the future six-step influencer registration wizard. It collects account information only and intentionally does not implement Social Profiles, Creator Profile, Payment Details, Verification, or Review & Submit.

## Frontend

- Page: `frontend/src/pages/InfluencerRegistrationStepOnePage.jsx`
- API service: `frontend/src/services/influencerRegistrationService.js`
- Validation and draft helpers: `frontend/src/utils/influencerRegistrationStep1.js`
- Type contracts: `frontend/src/types/influencerRegistration.d.ts`

Draft behavior:

- Local and session draft storage use `grm_influencer_register_step_1`.
- Password and confirm password are not persisted locally.
- Auto-save runs every 30 seconds.
- `Save Draft` persists locally immediately and attempts server draft save only when the current form validates.

## Backend

Endpoints are mounted under the existing influencer commerce gate:

- `GET /api/influencer/register/check-email`
- `GET /api/influencer/register/check-username`
- `POST /api/influencer/register/save-draft`
- `POST /api/influencer/register/step-1`

Model:

- `InfluencerApplication`
- Collection: `influencer_applications`
- Status values: `draft`, `submitted`, `under_review`, `approved`, `rejected`, `suspended`

Step 1 stores an application draft with `currentStep: 1`, hashes the password server-side, and returns `nextStep: 2` plus the future wizard path.

## Validation Coverage

Focused tests live in `frontend/src/utils/__tests__/influencerRegistrationStep1.test.js` and cover email/username/password rules, password strength, password match, and draft sanitization.
