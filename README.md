# Courier & Logistics Management Platform — Backend

A REST API for a multi-organization courier/logistics platform: shipment
creation, pickup scheduling, courier assignment, hub-to-hub transfers,
delivery, failed-delivery/return workflows, courier earnings, pricing,
and an ops/admin analytics dashboard.

Built with Node.js, TypeScript, Express, PostgreSQL + Prisma, Zod, and an
optional Redis layer — following the modular `route / controller /
service / interface / validation` pattern per feature.

## 1. Getting started

```bash
cp .env.example .env      # fill in DATABASE_URL at minimum
npm install
npm run prisma:generate   # generates the Prisma client into src/generated/prisma
npm run prisma:migrate    # creates tables from the schema (prompts for a migration name)
npm run prisma:seed       # creates a demo organization, hubs, zones, staff, a courier, a customer
npm run dev                # starts the API on http://localhost:5000
```

> **Note on this environment:** the sandbox this was built in blocks
> outbound access to Prisma's binary CDN (`binaries.prisma.sh`), so
> `prisma generate` could not be run here to produce a compiled
> `@prisma/client`. On your own machine with normal internet access this
> is a completely standard step and will work as expected. Everything
> that imports from `../generated/prisma` will resolve correctly once
> you run `npm run prisma:generate` locally.

Demo accounts after seeding (password for all: `Password123!`):

| Role | Email |
|---|---|
| ADMIN | admin@swiftline.example |
| OPS_MANAGER | ops@swiftline.example |
| HUB_MANAGER | hub.dhaka@swiftline.example |
| COURIER | courier1@swiftline.example |
| CUSTOMER | customer@swiftline.example |

Redis is optional — without `REDIS_URL` set, the app runs fine; caching,
courier-assignment race protection, and rate limiting degrade to safe
no-ops (see `src/app/lib/redis.ts`).

## 2. Project structure

```
prisma/
  schema/            # split Prisma schema (enums, organization, user, hub, shipment, courier, pricing)
  seed.ts
src/
  app.ts             # Express app: middleware pipeline + route mounting
  server.ts           # bootstrap, env checks, graceful shutdown
  app/
    config/           # single source of truth for env vars
    lib/              # prisma client singleton, redis wrapper
    middleware/       # checkAuth, validateRequest, globalErrorHandler, notFound
    utils/            # ApiError, catchAsync, sendResponse, jwt, pick
    routes/           # aggregates all module routers under /api/v1
    module/
      auth/
      organization/
      zone/
      hub/
      shipment/       # the state machine + transaction-safe transitions
      courier/        # assignment strategy, leg lifecycle, earnings
      pricing/
      payment/        # pluggable provider interface (Mock/Stripe/SSLCommerz/bKash)
      notification/
      manifest/       # hub-to-hub batch transfers
      analytics/
```

Each module follows: `*.route.ts` → `*.controller.ts` → `*.service.ts`,
with `*.validation.ts` (Zod) and `*.interface.ts` (types) alongside.

## 3. The shipment state machine

`shipment/shipment.constant.ts` defines `ALLOWED_TRANSITIONS` as an
explicit adjacency list — the only place that says which status can move
to which. Every status change in the app (shipment creation, courier
actions, hub scans, manifest dispatch/arrival, cancellation) is required
to go through `shipment/shipment.transition.ts`'s `transitionStatusInTx`,
which:

1. Checks the transition against `ALLOWED_TRANSITIONS` (rejects illegal
   jumps with `409 Conflict`).
2. Updates `Shipment.status` **conditioned on an unchanged `version`
   column** (optimistic locking) — if two requests race to update the
   same shipment, the loser's `updateMany` affects 0 rows and gets a
   clear "please retry" error instead of silently clobbering the winner.
3. Inserts one row into `ShipmentEvent` in the same transaction — this
   table **is** the tracking timeline customers see.

```
CREATED → PICKUP_SCHEDULED → COURIER_ASSIGNED → PICKED_UP
  → AT_ORIGIN_HUB → IN_TRANSIT → AT_DESTINATION_HUB
  → OUT_FOR_DELIVERY → DELIVERED

Branches:
  PICKUP_FAILED  (retry assignment, or cancel)
  DELIVERY_FAILED → RETURN_INITIATED → RETURN_IN_TRANSIT → RETURNED_TO_SENDER
  CANCELLED       (only while still with the customer)
```

## 4. Courier assignment

`courier/courier.assignment-strategy.ts` defines a small
`IAssignmentStrategy` interface (`LeastLoadedInZoneStrategy`, falling
back to `AnyAvailableCourierStrategy`). `courier.service.ts`'s
`assignCourierToShipment`:

1. Gets an ordered list of candidate couriers from the strategy.
2. Tries to atomically **claim** each one in order with a conditional
   `updateMany({ where: { id, isAvailable: true }, data: { activeParcelCount: { increment: 1 } } })`
   — if two ops users try to assign the same courier at the same instant,
   only one `updateMany` affects a row; the other falls through to the
   next candidate. No row-level lock or Redis needed for correctness —
   the conditional update *is* the lock.
3. Creates the `CourierAssignment` and advances the shipment's status in
   the same transaction.

Swapping the matching algorithm later (distance/ETA-aware, ML-ranked,
whatever) only means writing a new object satisfying
`IAssignmentStrategy` — nothing else changes.

**Earnings are paid on hub/customer confirmation, not the courier's own
claim**: a pickup leg's earning is only created when the *hub* scans the
parcel in (`confirmArrivalAtOriginHub`), and a delivery leg's earning
when the courier completes delivery (final leg, no further check
needed). This prevents a courier from "completing" a pickup they never
made.

## 5. Hub-to-hub transfers (manifests)

Rather than moving each shipment between hubs one at a time,
`manifest/manifest.service.ts` models a transfer as a batch: a
`HubManifest` (one truck/route, `fromHub → toHub`) with many
`ManifestItem`s. `dispatch()` and `arrive()` each open **one transaction**
that advances every included shipment's status together — the whole
truckload moves forward, or none of it does. This also naturally covers
the return-to-sender path (a manifest can carry `RETURN_INITIATED`
shipments back toward the origin hub).

## 6. Pricing

`pricing/pricing.service.ts` resolves a quote via a fallback chain:
exact zone-pair + service-level rule → organization's catch-all default
→ platform default from `.env` (`BASE_DELIVERY_FEE` / `PRICE_PER_KG`).
Resolved quotes are cached in Redis for 5 minutes since this lookup runs
on every shipment-creation request and pricing rules change rarely.

## 7. Payments

`payment/payment.interface.ts` defines `IPaymentProvider`
(`initiate`/`verify`/`refund`). Two providers are fully working:

- **`MockPaymentProvider`** — always-succeeds, no external dependency.
  Good for automated tests and quick local runs.
- **`StripePaymentProvider`** — real Stripe Checkout Session integration.
  `initiate()` creates a Checkout Session and returns its redirect URL;
  `payment.webhook.ts` (mounted at `POST /api/v1/payments/webhook/stripe`
  in `app.ts`, registered **before** `express.json()` since Stripe's
  signature check needs the raw body) marks the payment `PAID` when
  Stripe calls back on `checkout.session.completed`. `refund()` reverses
  the underlying PaymentIntent. Set `PAYMENT_PROVIDER=STRIPE` and fill in
  `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` in `.env`. For local
  testing, run `stripe listen --forward-to localhost:5000/api/v1/payments/webhook/stripe`
  so Stripe's test-mode events reach your machine.

`local-gateways.provider.ts` (SSLCommerz/bKash) is left as a documented
stub — same interface, just needs merchant credentials and a decision on
each gateway's specific session/callback flow.

`POST /api/v1/payments/initiate` lets a customer retry a failed/expired
online payment on an existing shipment, or switch an existing COD
shipment to an online method (`{ "shipmentId": "...", "method": "CARD" }`)
— separate from the automatic payment creation that happens inside
`POST /api/v1/shipments`.

## 8. What's deliberately out of scope / left as extension points

- **Real email/SMS/push delivery** — `notification.service.ts` logs and
  records notifications; wiring Nodemailer/Resend, Twilio, or FCM is a
  `dispatch()` implementation away.
- **File uploads** (proof-of-delivery photos, etc.) — the stack calls for
  Multer + Cloudinary; not wired into a specific endpoint here since no
  particular upload flow was specified. Add a `multer` middleware +
  Cloudinary upload call to `completeDeliveryLeg`'s route when you're
  ready.
- **Multi-hop routing** — the manifest system assumes a single hop
  between a shipment's origin and destination hub. A hub network with
  intermediate transfer points would need a small routing table.
- **Social login** — the tech stack mentions it as an option; base
  email/password auth is implemented, and Better Auth/Clerk can replace
  `auth.service.ts` wholesale if you'd rather not hand-roll it.

## 9. Example end-to-end flow (manual testing)

1. `GET /api/v1/organizations/public` → confirm `swiftline` exists (from the seed).
2. `POST /api/v1/auth/register` with `{ "name", "email", "password", "organizationSlug": "swiftline" }`,
   or just `POST /api/v1/auth/login` as the seeded customer
   (`customer@swiftline.example` / `Password123!`) → get an access token.
2. `POST /api/v1/shipments` with sender/receiver addresses (`zoneId`s from
   `GET /api/v1/zones`), weight, and `paymentMethod: "COD"`.
3. `PATCH /api/v1/shipments/:id/schedule-pickup`.
4. Log in as `ops@swiftline.example`; `POST /api/v1/couriers/shipments/:id/assign`
   with `{ "legType": "PICKUP" }` — shipment moves to `COURIER_ASSIGNED`.
5. Log in as the courier; `POST /api/v1/couriers/assignments/:assignmentId/accept`,
   then `.../complete-pickup` — shipment moves to `PICKED_UP`.
6. As ops/hub manager: `POST /api/v1/couriers/shipments/:id/confirm-origin-hub-arrival`
   with `{ "hubId": "..." }` — shipment moves to `AT_ORIGIN_HUB`, pickup
   earning is created.
7. Create a manifest: `POST /api/v1/manifests` (`fromHubId`, `toHubId`),
   add the shipment via `POST /api/v1/manifests/:id/items`, then
   `.../dispatch` (shipment → `IN_TRANSIT`) and `.../arrive`
   (shipment → `AT_DESTINATION_HUB`).
8. Assign a delivery courier: `POST /api/v1/couriers/shipments/:id/assign`
   with `{ "legType": "DELIVERY" }` — shipment → `OUT_FOR_DELIVERY`.
9. Courier: `.../complete-delivery` — shipment → `DELIVERED`, delivery
   earning created.
10. Anyone: `GET /api/v1/shipments/track/:trackingId` for the public
    timeline.

## 10. Notes on things worth deciding as you go further

- Courier commission split (`courier/courier.constant.ts`) is a flat
  30%/40%/60% placeholder — move this to per-organization settings once
  you have real unit economics.
- The optimistic-locking `version` column is enough for this scale; if
  you later see heavy write contention on hot shipments, Redis-based
  per-shipment locks (`cache.acquireLock` is already implemented and
  unused) are the natural next step.
