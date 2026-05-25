# Company Branding Module

`Settings -> Company Branding`

This module centralizes tenant-aware branding for the admin workspace and exposes a public read model so storefront, admin, checkout, invoice, favicon, and PWA consumers can refresh without a code deployment.

## Backend

- Collection: `company_branding`
- Version history: `company_branding_versions`
- Public endpoint: `GET /api/public/branding`
- PWA manifest: `GET /api/public/branding/manifest.webmanifest`
- Admin endpoints:
  - `GET /api/admin/company-branding`
  - `POST /api/admin/company-branding`
  - `PUT /api/admin/company-branding/:id`
  - `DELETE /api/admin/company-branding/logo/:id?slot=primary_logo`
  - `GET /api/admin/company-branding/:id/versions`
  - `POST /api/admin/company-branding/:id/rollback/:versionId`

## Permissions

- `branding.view`
- `branding.create`
- `branding.update`
- `branding.delete`

Legacy admin roles are mapped to the equivalent legacy permission catalog, while staff roles use the new `branding.*` keys in the staff permission matrix.

## Storage and Optimization

- Uploads are stored under `backend/uploads/branding/<tenantType>/<tenantKey>/`
- Accepted formats: `PNG`, `SVG`, `WEBP`, `ICO`
- Max size: `5 MB`
- WEBP and thumbnail derivation are generated when the optional `sharp` dependency is available at runtime
- The module remains functional without `sharp`, but production deployments should install it for full optimization coverage

## Caching

- Public branding responses use in-memory cache with short TTL
- Cache is invalidated on save, delete, and rollback
- Frontend consumers refresh instantly via the shared `BrandingContext` and `branding:updated` event

## Cross-application consumers

- Storefront header/footer
- Login and registration pages
- Admin workspace sidebar shell
- Checkout payment gateway branding
- Invoice rendering defaults and PDF output
- Browser favicon and generated PWA manifest

## Multi-tenant notes

The domain is scoped by `tenantType` and `tenantKey`. Current UI manages the default platform tenant, while the backend supports alternate tenants through optional request headers or query params:

- `x-tenant-type`
- `x-tenant-key`

## Operational notes

- Audit log actions: `branding.updated`, `branding.asset.uploaded`, `branding.asset.replaced`, `branding.asset.deleted`, `branding.restored`
- Version snapshots are created before each mutation so rollback is non-destructive
- Invoice settings still remain backward compatible; branding now acts as the fallback source for invoice logo and company identity
