# ⚡ VoltCart — Flash Sale E-Commerce Platform

A full-stack flash-sale storefront: limited units of selected products go on sale at a
special price for a fixed window. The hard part is not the UI — it is making sure that
when 300 people click "buy" on 15 units at the same millisecond, **exactly 15 orders
succeed**.

**Stack:** React (Vite) · Node.js (Express) · MongoDB (Mongoose) · Redis (ioredis + Lua + Streams)

---

## 1. Quick start

### Prerequisites
| Service | Check | Install (macOS) |
|---|---|---|
| Node 18+ | `node -v` | `brew install node` |
| MongoDB | `mongosh --eval "db.version()"` | `brew install mongodb-community && brew services start mongodb-community` |
| Redis | `redis-cli ping` → `PONG` | `brew install redis && redis-server --daemonize yes` |

### Run
```bash
cd VoltCart
npm run install:all          # installs server + client deps
cp server/.env.example server/.env
npm run seed                 # 12 products + a sale that starts 60s from now
npm run dev                  # API on :4000, web on :5173
```
Open <http://localhost:5173>.

### Useful commands
```bash
npm run seed                 # reset catalogue + sale (sale starts in 1 min)
npm run test:oversell        # 300 concurrent buyers vs 15 units - proves no overselling
```

> `npm run seed` is a **hard reset**: it clears products, sales, carts, the event ledger and
> the `orders` collection, drops every `fs:*` key in Redis and rebuilds the Mongo indexes
> from the current schemas. User accounts and addresses are kept.

---

## 2. What the customer sees

| Page | Route | Notes |
|---|---|---|
| Home | `/` | Banner + countdown, deal grid, regular grid. **Add-to-cart is hidden until the sale starts.** |
| Product detail | `/product/:slug` | Image, brand, highlights, live deal price + stock, description |
| Cart | `/cart` | Lines with ± quantity, subtotal / discount / free delivery / total |
| Checkout | `/checkout` | **Reservation timer**, address picker, order review, payment method |
| Payment | `/payment/:orderId` | Spinner ~2.5 s → "Order successful" (COD settles instantly) |
| Login / Register | `/login`, `/register` | Guest cart is merged into the account on login |
| Addresses | `/addresses`, `/addresses/new` | List, set default, delete, add |
| My Orders | `/orders` | Order taken → Out for delivery → Delivered tracker |
| My Profile | `/profile` | Edit name/phone, change password |

Guests can browse and build a cart (stored in `localStorage`). Checkout, orders,
addresses and profile require an account.

---

## 3. Architecture

```
                      ┌───────────────────────────┐
  React (Vite :5173)  │  /api proxied to :4000    │
  ───────────────────►│  httpOnly JWT cookie      │
                      └─────────────┬─────────────┘
                                    │
                        ┌───────────▼───────────┐
                        │   Express API :4000   │
                        └───┬───────────────┬───┘
      source of truth for   │               │  source of truth for
      *sale availability*   │               │  users / products / orders
                    ┌───────▼──────┐  ┌─────▼──────┐
                    │    REDIS     │  │  MONGODB   │
                    │ stock:*      │  │ users      │
                    │ reserved:*   │  │ products   │
                    │ sold:*       │  │ flashsales │
                    │ resv:* hash  │  │ carts      │
                    │ ZSET expiry  │  │ orders     │
                    │ STREAM       │──┼─► inventoryevents (idempotency ledger)
                    └──────────────┘  └────────────┘
                       Lua scripts        background workers:
                       (atomic)           sweeper · stream consumer · reconciler
```

**Why the split:** MongoDB is durable but a read-modify-write on a document is not fast
enough (nor atomic enough across documents) for a thundering herd. Redis is single-threaded,
so a Lua script is a *critical section* — no two buyers can interleave inside it.

---

## 4. The inventory model (the core of the project)

### 4.1 Keys
All keys of one sale share the hash tag `{sale:<saleId>}` so a script always touches one slot.

| Key | Type | Meaning |
|---|---|---|
| `fs:{sale:S}:state` | hash | `startAt`, `endAt`, `status` |
| `fs:{sale:S}:stock:<pid>` | string(int) | **units still buyable right now** |
| `fs:{sale:S}:reserved:<pid>` | string(int) | units held by open reservations |
| `fs:{sale:S}:sold:<pid>` | string(int) | units actually paid for |
| `fs:{sale:S}:meta:<pid>` | hash | `salePrice`, `totalQuantity`, `maxPerUser` |
| `fs:{sale:S}:uq:<uid>:<pid>` | string(int) | per-customer purchase counter (limit enforcement) |
| `fs:{sale:S}:resv:<rid>` | hash | one reservation: items, status, expiry |
| `fs:resv:expiry` | zset | `saleId\|resvId` scored by expiry timestamp |
| `fs:inventory:events` | stream | RESERVE / RELEASE / COMMIT events for MongoDB |

Invariant at all times: `stock + reserved + sold == totalQuantity`.

### 4.2 Lifecycle

```
 cart ──► CHECKOUT ────────────► PAY ──────────────► order
            │  reserve.lua        │  commit.lua
            │  stock  -= q        │  reserved -= q
            │  reserved += q      │  sold     += q
            │  ZADD expiry        │  XADD COMMIT
            │  XADD RESERVE       │
            │                     └─ payment fails ─► release.lua
            └─ 3 min pass (sweeper) ─► release.lua ──► stock += q, item dropped from cart
```

### 4.3 `reserve.lua` — why it cannot oversell
1. Reads the sale window from `:state` — a reservation outside `[startAt, endAt)` is rejected
   (the *window*, not a cached status string, is the gate, so there is no ticker lag).
2. **Pass 1 validates every line** (in the sale? enough stock? within `maxPerUser`?) and
   returns an error without touching anything → a reservation is *all-or-nothing*.
3. **Pass 2 mutates** `stock`, `reserved` and the per-user counter.
4. Writes the reservation hash, schedules the expiry in the ZSET, and appends the event
   to the stream.

Because Redis executes the whole script as one single-threaded unit, steps 1–4 are atomic.
There is no check-then-act race — the classic source of overselling.

**Proof** (`npm run test:oversell`):
```
Product … | stock before: 15 | concurrent buyers: 300
elapsed        : 7 ms
successful buys: 15
rejected buys  : 285
stock after    : 0
sold counter   : 15
oversold?      : NO - 15 sold out of 15
```

### 4.4 Reservations (the 3-minute hold)
- Created when the customer opens **/checkout** (`POST /api/checkout/reserve`).
- TTL is `RESERVATION_TTL_SECONDS` (default 180). The UI shows *"Reservation ending in mm:ss"*.
- Expiry is driven by a **sorted set + 1 s sweeper**, not by keyspace notifications:
  notifications are fire-and-forget (lost on restart or disconnect), a ZSET is restart-safe
  and lets one sweep handle a batch.
- On expiry the sweeper: `release.lua` (units go back) → **pulls the items out of the
  customer's cart** → cancels the unpaid order.
- Opening checkout again replaces any previous hold, so the cart and the hold never drift.
- Committing is idempotent: a replayed payment call returns `ALREADY_COMMITTED`.

### 4.5 Regular (non-sale) stock
Products not in the sale are decremented in MongoDB with a conditional update:
```js
Product.updateOne({ _id, stock: { $gte: qty } }, { $inc: { stock: -qty } })
```
The filter makes check-and-decrement a *single atomic operation*. If any line fails, the
whole order aborts (inside a transaction when available, otherwise with compensating writes).

---

## 5. Redis → MongoDB sync ("how many times does it update?")

This was the open question in the original plan. The answer VoltCart implements is
**three layers, each with a different job**:

| Layer | Trigger | Writes | Purpose |
|---|---|---|---|
| 1. Stream consumer | every RESERVE / RELEASE / COMMIT event | `$inc` deltas on the sale item | near-real-time mirror (ms latency) |
| 2. Reconciler | every 15 s (configurable) | `$set` absolute values read from Redis | self-healing snapshot |
| 3. Order write | at order creation / payment | the order document itself | the durable business record |

So Mongo is **not** written once per click of a "+" button and **not** only at the end —
it is written once per inventory *event*, asynchronously, off the request path. The customer
never waits for Mongo during the sale.

**Why a consumer group:** `XREADGROUP` gives at-least-once delivery with a pending list, so
a crash mid-processing does not lose the event — it is redelivered on restart.

**Why an idempotency ledger:** at-least-once means an event can be applied twice, which
would corrupt counters. Before applying, the consumer inserts the stream message id into
`inventoryevents` (`_id` = message id). A duplicate raises `E11000` and is skipped, then
acked. Insert-first + unique index = exactly-once effect.

**Why the reconciler on top:** deltas drift if anything is ever lost or replayed outside the
ledger. The periodic snapshot copies the absolute Redis numbers into Mongo, so the system
converges no matter what. Redis stays the source of truth while the sale is live; Mongo is
the durable, queryable mirror.

---

## 6. Transactions & consistency

- `withTransaction()` detects at boot whether MongoDB is a replica set. On a replica set the
  order write + stock decrements run in a real multi-document transaction; on a standalone
  dev box it degrades gracefully to compensating writes (the log line tells you which).
- The money-critical sequence is ordered so failure is always safe:
  1. reserve in Redis (customer owns the units)
  2. create the order as `PENDING_PAYMENT`
  3. on success commit the hold; on failure/expiry release it
  A crash at any point leaves units held for at most 3 minutes, after which the sweeper
  returns them. **We never confirm an order whose units were not held.**

---

## 7. Security

- Passwords hashed with bcrypt (cost 12); login returns the same message for unknown email
  and wrong password (no user enumeration).
- JWT in an **httpOnly, sameSite** cookie — not reachable from JavaScript, so XSS cannot
  steal the session. Vite proxies `/api`, keeping everything same-origin in dev.
- All input validated with zod at the boundary; `helmet`, CORS allow-list, 100 kB body cap.
- Rate limits on auth (30 / 15 min) and checkout/payment (30 / min) — also a cheap defence
  against inventory-hoarding bots, on top of the per-user `maxPerUser` limit enforced in Lua.
- Ownership checks on every reservation, order and address read.

---

## 8. Demo script (for the presentation)

1. `npm run seed` → sale starts 60 s later. Show the homepage: countdown, no add-to-cart.
2. Need a different timing? Align the sale to your slot:
   ```bash
   curl -X POST localhost:4000/api/sale/schedule \
     -H 'Content-Type: application/json' -d '{"startInSeconds":90,"durationMinutes":30}'
   ```
3. Timer hits zero → the banner flips to **SALE IS LIVE**, prices drop, MRP is struck
   through, stock bars appear, add-to-cart unlocks.
4. Add an item → cart → checkout → point at **"Reservation ending in 02:59"** and at the
   stock counter on the homepage in a second tab, which already dropped.
5. Let the timer run out on purpose: the item disappears from the cart and the stock counter
   goes back up. That is the sweeper.
6. Do it again and pay → spinner → *Order successful* → My Orders shows the tracker.
7. Finish with `npm run test:oversell` — 300 buyers, 15 units, 15 orders.
8. Reset between runs: `curl -X POST localhost:4000/api/sale/reset`.

---

## 9. API reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` \| `/login` \| `/logout` | – | session (guest cart merges on login) |
| GET | `/api/auth/me` | – | current user or `null` |
| PATCH | `/api/auth/profile` \| `/password` | ✔ | edit profile / password |
| GET | `/api/products` \| `/api/products/:slug` | – | catalogue + live sale data |
| GET | `/api/sale` | – | sale window, status, live stock, server time |
| POST | `/api/sale/schedule` \| `/api/sale/reset` | – | demo controls |
| POST | `/api/cart/price` | – | price a guest cart |
| GET/PUT/DELETE | `/api/cart`, `/api/cart/items` | ✔ | server cart |
| GET/POST/PUT/PATCH/DELETE | `/api/addresses…` | ✔ | address book |
| POST | `/api/checkout/reserve` | ✔ | **hold flash-sale units** |
| GET/POST | `/api/checkout/reservations/:id[/cancel]` | ✔ | inspect / release a hold |
| POST | `/api/orders` | ✔ | create `PENDING_PAYMENT` order |
| GET | `/api/orders`, `/api/orders/:id` | ✔ | order history |
| POST | `/api/payments/:orderId/confirm` | ✔ | settle payment (commit or release) |

---

## 10. Project layout

```
VoltCart/
├── server/
│   ├── src/
│   │   ├── config/        env, mongo (+transaction helper), redis
│   │   ├── models/        User, Product, FlashSale, Cart, Order, InventoryEvent
│   │   ├── redis/
│   │   │   ├── keys.js    key naming with {sale:id} hash tags
│   │   │   ├── scripts.js registers the Lua scripts as ioredis commands
│   │   │   └── lua/       reserve.lua · release.lua · commit.lua  ← the critical section
│   │   ├── services/      saleService · inventoryService · pricing
│   │   │                  reservationSweeper · streamConsumer · reconciler · orderSimulator
│   │   ├── controllers/   auth · catalog · cart · address · checkout · order · payment
│   │   ├── middleware/    auth (JWT cookie) · errorHandler
│   │   ├── routes/        one router, rate limits applied here
│   │   └── seed/seed.js   12 products, 6 of them in the sale
│   └── scripts/oversell-test.js
└── client/
    └── src/
        ├── context/       Auth · Cart (guest+server) · Sale (server-clock countdown) · Toast
        ├── components/    Header · Footer · SaleBanner · Countdown · ProductCard · QuantityStepper
        ├── pages/         Home · Product · Cart · Checkout · Payment · Login · Register
        │                  Addresses · AddAddress · Orders · Profile
        └── styles.css
```

---

## 11. Design decisions worth defending in a viva

| Decision | Why |
|---|---|
| Lua instead of `WATCH`/`MULTI` | optimistic locking retries under contention; a script never retries and is one round trip |
| Decrement stock **at reservation**, not at payment | the only way a "3-minute hold" can be honest |
| ZSET sweeper instead of key-expiry events | restart-safe, batched, deterministic |
| Stream + consumer group + ledger | at-least-once delivery turned into exactly-once effect |
| Reconciler snapshot | converges the mirror even if an event is ever lost |
| Sale window checked inside Lua | no dependence on a background ticker; zero-lag start |
| Per-user counters in Redis | `maxPerUser` enforced atomically, not in application code |
| Server clock offset on the client | every customer's countdown agrees, whatever their system clock says |
