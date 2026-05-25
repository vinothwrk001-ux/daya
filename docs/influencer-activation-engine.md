# Influencer Activation Engine

## Trigger

Activation runs only after an admin approves an influencer application. The admin review endpoint delegates to the activation engine, so approval is idempotent and auditable.

## Backend Capabilities

- Creates or upgrades the user account to the `influencer` role.
- Creates and activates the influencer profile.
- Generates an `INF########` influencer code.
- Issues an active influencer badge.
- Creates the public creator storefront at `/influencer/{slug}`.
- Enables affiliate settings and tracking-code generation.
- Creates the default Creator Favorites collection.
- Creates and activates the commission wallet.
- Writes activation audit records for account, role, badge, storefront, affiliate, and wallet actions.
- Emits the existing influencer activated domain event for future queue/notification processing.

## API

- `POST /api/influencer/approve`
- `GET /api/influencer/activation/welcome`
- `GET /api/influencer/storefront?slug={slug}`
- `POST /api/influencer/generate-affiliate-link`
- `GET /api/influencer/analytics`

## Frontend

- `/influencer/welcome` shows the post-approval success experience and first-time setup checklist.
- `/influencer/{slug}` renders the public creator storefront.
- `/influencer/affiliate-links` generates tracking URLs.
- `/influencer/analytics` exposes creator commerce metrics.
- `/influencer/collections` is ready for the collection builder/product tagging module.

## Future Production Hooks

- Move activation side effects into a background queue for very high throughput.
- Add Redis caches for storefronts, analytics, dashboards, and affiliate settings.
- Connect email, SMS, and in-app notification workers to activation audit events.
- Expand fraud detection and suspicious activity monitoring from affiliate clicks and wallet behavior.
