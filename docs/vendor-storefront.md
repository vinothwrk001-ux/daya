# Vendor Storefront

## Database Design

MongoDB collections used by the module:

- `vendors`: canonical vendor profile, store slug, logo, banner, description, theme, SEO, visibility, featured and verification state.
- `vendor_followers`: unique `(vendorId, customerId)` relationship with notification preferences and `followedAt`.
- `vendor_store_views`: event stream for page views, unique visitors, product clicks, wishlist adds, cart adds, conversions, and revenue.
- `vendor_collections`: vendor-owned featured, seasonal, category, and custom product collections.
- `product_reviews`: existing verified review collection, queried by `vendorId`.
- `products`: existing marketplace catalog, scoped by `sellerId`.
- `orders`: existing platform order system, queried only for aggregated vendor analytics.
- `user_notifications`: customer alerts for followed-store updates.

ER summary:

```text
User 1 ── * VendorFollower * ── 1 Vendor
Vendor 1 ── * Product
Vendor 1 ── * ProductReview
Vendor 1 ── * VendorStoreView
Vendor 1 ── * VendorCollection
User 1 ── * Order * ── 1 Vendor
```

## API Contracts

Public:

- `GET /api/vendor-stores/:slug`
- `GET /api/vendor-stores/:slug/products`
- `GET /api/vendor-stores/:slug/reviews`
- `GET /api/vendor-stores/:slug/followers`
- `POST /api/vendor-stores/:slug/events`

Customer:

- `POST /api/vendor-stores/:slug/follow`
- `DELETE /api/vendor-stores/:slug/follow`
- `GET /api/user/followed-stores`

Vendor:

- `GET /api/vendor/storefront/analytics`
- `PATCH /api/vendor/settings/storefront`

Admin:

- `GET /api/admin/sellers/:id/store-analytics`
- `PATCH /api/admin/sellers/:id/store-moderation`

All public vendor payloads are sanitized. They never include vendor phone, vendor email, support contact, business address, website, WhatsApp, social handles, customer phone, customer email, customer address, or direct payment data.

## Frontend Routes

- `/vendor/:vendorSlug`
- `/vendor/:vendorSlug/products`
- `/vendor/:vendorSlug/reviews`
- `/vendor/:vendorSlug/followers`
- `/followed-stores`

The store product grid uses responsive density: 8 columns on desktop, 4 on tablet width, 2 on mobile. Product actions remain marketplace actions only: quick view affordance, wishlist, add to cart, compare affordance, rating, discount, and stock status.

## Order And Privacy Model

Customer purchase flow remains:

```text
Marketplace Cart -> Marketplace Checkout -> Marketplace Payment Gateway
-> Platform Order Management -> Vendor Fulfillment Dashboard -> Shipment
```

Vendors never receive customer contact information from this module. Customers never receive vendor contact information from this module. Direct customer-vendor communication and direct vendor payment are intentionally absent from the API and UI.

## Caching And Scale

- Storefront reads use short-lived service cache with a Redis-ready boundary.
- Product and follower queries are index-backed by `sellerId`, `status`, `isActive`, `vendorId`, and `customerId`.
- Product listing uses server-side pagination with a hard limit cap.
- Images remain URL-based and CDN compatible.
- Frontend product media uses lazy loading through existing product cards.
- Analytics are append-only event writes and aggregate reads, suitable for later rollup jobs.

## Analytics Engine

Tracked events:

- `PAGE_VIEW`
- `UNIQUE_VISITOR`
- `PRODUCT_CLICK`
- `WISHLIST_ADD`
- `CART_ADD`
- `CONVERSION`
- `REVENUE`

Vendor analytics expose store visits, unique visitors, followers, product views, wishlist adds, cart adds, conversions, revenue, top products, top categories, average order value, and customer retention.

## Recommendation Engine

Following a vendor is represented as durable first-party preference data in `vendor_followers`. The recommendation layer can boost followed vendors across homepage containers, search, recommendation rails, email campaigns, and push notifications by joining customer id to followed vendor ids and applying a positive ranking boost to matching `Product.sellerId`.

## Notification System

When a customer follows a vendor, they receive a confirmation notification. When a product is created directly by admin or approved by admin for a followed vendor, followers receive a product alert. The same `notifyFollowersForProduct` pathway supports price drop, back-in-stock, flash sale, and collection notifications.

## SEO

Store pages set document title and meta description from `vendor.storeSeo`. API payloads include canonical URL, Open Graph image source, meta title, meta description, and schema type. XML sitemap generation should include approved, visible `vendors.storeSlug` values at `/vendor/:slug`.

## Security

- Public APIs use optional auth and return sanitized fields only.
- Follow and followed-store APIs require `user` role.
- Vendor analytics/settings require `vendor` role and existing vendor module permissions.
- Admin moderation requires existing vendor admin permissions.
- Platform API rate limiting and Helmet security headers remain active.
- Analytics hashes IP and user agent instead of storing raw identifiers.

## Testing Strategy

- Unit test storefront service sanitization and follow idempotency.
- Integration test public store, products, reviews, follow, unfollow, and followed stores.
- Authorization test customer-only follow, vendor-only analytics, admin-only moderation.
- Privacy regression test that no email, phone, address, external URL, or social contact fields appear in public payloads.
- Frontend route smoke tests for desktop, tablet, and mobile product grid layouts.

## Deployment Guide

1. Deploy backend models and routes.
2. Ensure MongoDB creates new indexes for `vendor_followers`, `vendor_store_views`, and `vendor_collections`.
3. Configure CDN image domains for vendor logos and banners.
4. Optionally replace in-process storefront cache with Redis using the service cache boundary.
5. Deploy frontend and verify `/vendor/:slug` for an approved visible vendor.
6. Add sitemap generation for visible vendor store URLs.
7. Monitor event volume and move analytics aggregates to scheduled rollup jobs when traffic grows.
