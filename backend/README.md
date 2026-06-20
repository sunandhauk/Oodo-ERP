# Oodo ERP Backend

NestJS backend for the Mini ERP demand-to-delivery flow.

## Stack

- NestJS
- Supabase Postgres
- Supabase Storage
- Middleware/guard-based prevention for auth, rate limits, idempotency, tenant resolution, and request tracking

## Setup

1. Copy `.env.example` to `.env`.
2. Apply `supabase/migrations/0001_init.sql` to your Supabase Postgres database.
3. Set `DATABASE_URL` to your Supabase Postgres connection string, plus `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
4. Start the app with `npm run start:dev` after installing dependencies.

## Key Endpoints

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/demands`
- `POST /api/demands`
- `POST /api/demands/:id/approve`
- `POST /api/procurements/from-demand/:demandId`
- `POST /api/procurements/:id/receive`
- `POST /api/inventory/movements`
- `POST /api/fulfillments/from-demand/:demandId`
- `POST /api/fulfillments/:id/dispatch`
- `POST /api/fulfillments/:id/deliver`
- `POST /api/files/upload`
- `GET /api/requests/:requestId`

## Request Envelope

Every controller response is normalized into:

- `status`: `progress | success | failure`
- `requestId`
- `data`
- `error`
- `timestamp`

Long-running actions return `progress` immediately and update `app_request_jobs` until they finish.
