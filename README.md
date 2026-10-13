# Shareen Jaya Abadi — Backend API

REST API for the Shareen Jaya Abadi website remake. Shareen is a B2B textile supplier in Bandung that sells fabric by the meter. The API covers the full shop flow (catalog, cart, shipping cost, checkout, payment), a blog, and everything the admin panel needs.

## Tech stack

Node.js · Express 5 · PostgreSQL · Prisma 7 · Zod · JWT in an httpOnly cookie · Passport (Google OAuth) · Directus (image storage) · RajaOngkir (shipping rates) · Midtrans Snap (payment)

## Features

- **Auth** — email/password and Google login, session in an httpOnly cookie, admin role
- **Catalog** — products with stock per color (in meters), category filter, search, sort, pagination
- **Blog** — posts with drafts, HTML sanitized on save, blog categories
- **Cart & checkout** — stock is checked and reserved in one database transaction; price, items and address are copied onto the order so history never changes
- **Shipping** — RajaOngkir area search and live rates (JNE, SiCepat, J&T, POS) based on cart weight
- **Payment** — Midtrans Snap token (reused for retries), signed and idempotent webhook, and a status check that asks Midtrans directly when a webhook is missed
- **Orders** — `PENDING → PROCESSING → SHIPPED (tracking number) → COMPLETED`; unpaid orders are cancelled after 24 hours and their stock returned
- **Admin** — dashboard stats; products, categories, colors, blog, image upload, orders, users
- **Security** — rate limits, ownership checks on every user resource, mass-assignment protection, protection against account takeover through Google account linking

## Project structure

```
src/features/<feature>/   routes → controller → service for each feature
src/shared/               config, middlewares, utils, Prisma client
prisma/                   schema, migrations, seed
test/api.test.js          end-to-end tests
```

## Run locally

Requirements: Node.js 20.19+ and PostgreSQL.

```bash
npm install            # also generates the Prisma client
cp .env.example .env   # then fill it in (see below)
npm run db:migrate
npm run db:seed        # initial product categories
npm run dev            # http://localhost:3000
```

To create an admin, register a normal account, then change its `role` to `ADMIN` in the database (`npm run db:studio`).

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection URL |
| `JWT_SECRET` | yes | Long random string used to sign the session token |
| `FRONTEND_URL` | yes | Frontend origin, used for CORS and redirects (no trailing slash) |
| `PORT` | no | Defaults to `3000` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | no | Google login is disabled when empty |
| `GOOGLE_CALLBACK_URL` | no | `<API URL>/api/auth/google/callback` |
| `DIRECTUS_URL`, `DIRECTUS_TOKEN` | for uploads | Directus instance and a token that may only create, read and delete files |
| `RAJAONGKIR_API_KEY`, `RAJAONGKIR_ORIGIN_ID` | for shipping | RajaOngkir (Komerce) key and the warehouse area ID |
| `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY` | for payment | Midtrans keys |
| `MIDTRANS_IS_PRODUCTION` | no | `true` for real payments, otherwise sandbox |

## Tests

```bash
npm test
```

The tests run against the dev database, Directus, RajaOngkir and the Midtrans sandbox, then delete their own data. One run uses about 5–7 of RajaOngkir's 100 daily requests.

## Deploy to Coolify

1. Database: the API shares the PostgreSQL database of the Directus service. In that service, enable **Connect To Predefined Network** and restart it, then build `DATABASE_URL` from its Postgres credentials: `postgresql://<user>:<password>@<postgres container name>:5432/<database>`.
   Table names don't clash (Directus tables start with `directus_`) and production only runs `prisma migrate deploy`. **Never** run `prisma migrate dev`, `prisma migrate reset` or `prisma db push` against this database — they can drop the Directus tables.
2. Add a new resource from this repository with build pack **Dockerfile** and port **3000**.
3. Set the domain to `http://api-shareen.grivilabs.my.id`. HTTPS is handled by Cloudflare Tunnel, which routes the hostname to `localhost:80`.
4. Fill in the environment variables with production values: `DATABASE_URL` from step 1, a new `JWT_SECRET`, `FRONTEND_URL=https://shareenjayaabadi.grivilabs.my.id`, and `GOOGLE_CALLBACK_URL=https://api-shareen.grivilabs.my.id/api/auth/google/callback`.
5. Deploy. The container runs `prisma migrate deploy` before the server starts.
6. Once, in the Coolify terminal: `npx prisma db seed`. Then create the admin account with a strong password.
7. Google Cloud Console: add the callback URL above as an authorized redirect URI.
8. Midtrans dashboard: set the Payment Notification URL to `https://api-shareen.grivilabs.my.id/api/payment/notification`.
