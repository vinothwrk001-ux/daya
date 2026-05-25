# Company Branding Deployment Guide

## 1. Run the migration

```bash
cd backend
npm run migrate:company-branding
```

This creates the default `company_branding` document and syncs indexes.

## 2. Optional but recommended dependency

Install `sharp` in the backend environment for production-grade image optimization, thumbnail generation, and WEBP derivation:

```bash
cd backend
npm install sharp
```

Without `sharp`, uploads still work, but derived assets are limited to the original file.

## 3. Storage

- Ensure `backend/uploads` is writable
- For CDN deployments, map `/uploads` to your asset origin
- If you front assets with a CDN, preserve query-string cache busting and the generated file paths

## 4. Cache and rollout

- No app restart is required for branding content changes
- Admin saves invalidate branding cache automatically
- Storefront/admin pages refresh branding through the shared public endpoint

## 5. Validation checklist

- Upload each supported format at least once: `PNG`, `SVG`, `WEBP`, `ICO`
- Confirm favicon changes in a private window to bypass browser favicon caching
- Confirm invoice preview/PDF picks up the branding fallback
- Confirm checkout branding reflects company name/theme color
- Confirm rollback restores the earlier branding snapshot

## 6. Rollback strategy

- Use the version history panel in `Settings -> Company Branding`
- Select the desired snapshot and execute rollback
- The rollback itself creates a fresh version entry for auditability
