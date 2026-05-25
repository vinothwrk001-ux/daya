# Influencer Registration Step 2

Route:

- `/influencer/register/social-verification`

This page is Step 2 of the influencer registration wizard. It verifies creator presence through social profiles only. It does not implement Creator Profile, Payment Information, Identity Verification, or Review & Submit.

## Frontend

- Page: `frontend/src/pages/InfluencerSocialVerificationPage.jsx`
- Draft and validation helpers: `frontend/src/utils/influencerSocialVerification.js`
- API service additions: `frontend/src/services/influencerRegistrationService.js`
- Type contracts: `frontend/src/types/influencerRegistration.d.ts`

Capabilities:

- Unlimited platform cards.
- Default cards for Instagram, YouTube, and TikTok.
- Instagram metric auto-fetch after a valid profile URL is entered.
- Additional platforms include Facebook, Twitter/X, LinkedIn, Pinterest, Telegram, Snapchat, Twitch, and Other.
- Ownership code generation.
- Manual screenshot fallback for admin review.
- Auto-save every 30 seconds to local storage.
- Server draft save through `/api/influencer/social/save-draft`.
- Continue only when one account is verified, under review, or has manual proof submitted.

## Instagram Auto-Fetch

The endpoint `GET /api/influencer/social/fetch-metrics` extracts the username from the profile URL and attempts to fetch public Instagram creator metrics through Meta Graph API when these environment variables are configured:

- `META_GRAPH_ACCESS_TOKEN` or `INSTAGRAM_GRAPH_ACCESS_TOKEN`
- `INSTAGRAM_BUSINESS_ACCOUNT_ID`

Without those credentials, the endpoint returns a manual fallback message instead of scraping Instagram. This keeps the flow production-safe and lets users manually enter followers or upload proof.

## Backend

Endpoints:

- `POST /api/influencer/social`
- `POST /api/influencer/social/save-draft`
- `POST /api/influencer/social/verify`
- `GET /api/influencer/social/status`

Collections:

- `influencer_social_accounts`
- `influencer_social_verifications`

Screenshot uploads:

- PNG, JPG, WEBP
- Maximum 10MB
- Saved through the existing upload pipeline with local fallback or Cloudinary when configured.

## Admin Review Integration

The backend stores verification rows with statuses suitable for a queue:

- `pending`
- `verified`
- `rejected`
- `under_review`
- `manual_review_required`

Future admin screens can query these records to review profile URLs, uploaded proof, metrics, and creator score.
