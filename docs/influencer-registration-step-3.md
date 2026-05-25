# Influencer Registration Step 3

Route:

- `/influencer/register/profile-information`

This page is Step 3 of the influencer registration wizard. It collects public profile and storefront-ready information only. It does not implement Payment Information, Identity Verification, or Review & Submit.

## Frontend

- Page: `frontend/src/pages/InfluencerProfileInformationPage.jsx`
- Draft and validation helpers: `frontend/src/utils/influencerProfileInformation.js`
- API service additions: `frontend/src/services/influencerRegistrationService.js`
- Type contracts: `frontend/src/types/influencerRegistration.d.ts`

Capabilities:

- Live influencer profile preview.
- Profile picture upload with preview, zoom, rotate, replace, and remove controls.
- Cover banner upload with responsive preview controls.
- Dynamic active categories from `/api/categories`.
- `Other` category flow with custom category validation.
- Secondary category multi-select with a maximum of 5.
- Store name and URL slug generation from display name.
- Slug availability check.
- SEO fields and social sharing image upload.
- Local draft save and auto-save every 30 seconds.
- Server draft save through `/api/influencer/profile/save-draft`.

## Backend

Endpoints:

- `GET /api/influencer/profile/draft`
- `GET /api/influencer/profile/check-slug`
- `POST /api/influencer/profile/save-draft`
- `POST /api/influencer/profile`

The draft is stored on `InfluencerApplication.profileDraft` until the later review/submission steps create or activate the final `InfluencerProfile`.

## Continue Requirements

Continue to Step 4 is allowed only when:

- Profile picture is uploaded.
- Cover banner is uploaded.
- Display name is valid.
- Short bio is between 20 and 160 characters.
- Primary category is selected.
- Store slug is available.

## Category Integration

Categories are loaded dynamically from the existing marketplace Categories module. New active categories created by admins become available without code changes.
