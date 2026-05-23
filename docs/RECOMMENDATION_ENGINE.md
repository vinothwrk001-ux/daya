# Recommendation Engine Operations Guide

## Architecture

Recommendation rebuilds do not run inside HTTP requests. Admin actions create a `recommendation_jobs` document, enqueue work on the Bull `recommendation-engine` queue when Redis is available, and fall back to an in-process background runner when queue submission is unavailable.

Flow:

1. Admin clicks `Run Rebuild`.
2. API creates a `recommendation_jobs` row with `status=queued` and `progress=0`.
3. API returns `202` immediately.
4. Worker updates progress through `running`, `25`, `75`, `90`, and `100`.
5. Admin UI polls `/api/recommendations/admin/jobs/{id}`.
6. Worker stores computed relationships and clears recommendation cache.

## Endpoints

- `GET /api/recommendations/product/:productId`
- `GET /api/recommendations/fbt/:productId`
- `GET /api/recommendations/frequently-bought?productId=...`
- `GET /api/recommendations/featured`
- `GET /api/recommendations/trending`
- `GET /api/recommendations/related?productId=...`
- `POST /api/recommendations/admin/rebuild`
- `POST /api/recommendations/admin/cache/clear`
- `GET /api/recommendations/admin/jobs/:id`

Backward-compatible admin aliases remain available under the existing `/admin/*` paths.

## Cache

Redis is preferred. If Redis is unavailable or `REDIS_DISABLED=true`, the module uses an in-memory fallback for fast local operation. Recommendation Mongo cache documents remain the database fallback cache. Cache clear only targets recommendation cache prefixes and does not trigger rebuilds.

Recommended production TTL: 24 hours for featured cache, existing per-engine TTLs for related, bundle, trending, personalized, upsell, and cross-sell.

## Permissions

New recommendation permissions are supported and normalized to colon form:

- `recommendation.view`
- `recommendation.manage`
- `recommendation.rebuild`
- `recommendation.cache.clear`

Existing `analytics:read` and `settings:update` permissions remain accepted for backward compatibility.

## Deployment

1. Ensure MongoDB is reachable; Mongoose creates the `recommendation_jobs` collection and indexes.
2. Configure Redis for queue processing:
   - `REDIS_HOST`
   - `REDIS_PORT`
   - `REDIS_PASSWORD` when required
3. Start the backend normally. `initializeRecommendationJobs()` registers queue processors and scheduled jobs.
4. Start at least one backend process with queue access for background processing.
5. Run `npm.cmd run build` in `frontend` and deploy the generated `dist` output.

## Failure Handling

Failed jobs are marked `status=failed`, retain `error_message`, and are visible to the admin progress panel. Retrying is done by clicking `Run Rebuild` again, creating a fresh job without mutating previous job history.
