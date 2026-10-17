# WIZZYMONEY Olamileken Electronics

Storefront and admin dashboard for an electronics shop in Ogunpa, Ibadan.

- **Frontend:** plain HTML, CSS and JavaScript modules in `public/` (no build step).
- **Backend:** Node.js + Express in `server/`, data in SQLite via `@libsql/client`: a local file in development, a hosted [Turso](https://turso.tech) database in production.

## Run it

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env      # then set ADMIN_PASSWORD
npm start                 # http://localhost:3000
```

`npm run dev` restarts the server whenever you edit a file. On first start the database (`server/data/store.db`) is created and filled with the catalog from `server/data/seed-products.json`. `npm run seed` wipes the products and reloads that file. Orders, messages and subscribers are kept.

## Pages

| URL | What it does |
| --- | --- |
| `/` | Home: categories, featured products, store info |
| `/shop` | Full catalog with category filters, search and sorting (`?category=fans&q=qasa`) |
| `/cart` | Cart and checkout. Customer sends the order; pay on delivery or at pickup |
| `/about`, `/contact` | Company info, and a contact form that saves messages to the database |
| `/admin` | Password-protected dashboard |

## Admin dashboard

Log in at `/admin` with `ADMIN_PASSWORD`. From there you can:

- add, edit and delete products, upload photos, and set prices, stock, "new" and "featured" flags;
- see orders and move them through *pending → confirmed → delivered / cancelled*;
- read and delete contact-form messages;
- copy the newsletter subscriber list.

Products with no price show **Ask for price**. Customers can still order them, and the order is marked as needing a price confirmation.

## How ordering works

1. The cart lives in the customer's browser.
2. On checkout the server looks up the current price of every item. Prices sent by the browser are never trusted. The server then saves the order and returns a reference such as `OE-3F9A1C`.
3. The confirmation screen offers a pre-filled WhatsApp message to the shop's number (`WHATSAPP_NUMBER`) so the customer can follow up straight away.

## API

Public:

- `GET  /api/categories`
- `GET  /api/products?category=&q=&sort=price-asc|price-desc|name|newest&featured=1&new=1`
- `GET  /api/products/:id`
- `POST /api/orders` — `{ name, phone, email?, deliveryMethod: "delivery"|"pickup", address?, note?, items: [{ productId, quantity }] }`
- `POST /api/messages` — `{ name, phone?, email?, subject?, message }`
- `POST /api/subscribe` — `{ email }`

Admin (send `Authorization: Bearer <token>` from `POST /api/admin/login`):

- `GET /api/admin/stats`
- `POST`, `PUT /:id` and `DELETE /:id` on `/api/admin/products` (multipart form, `image` field)
- `GET /api/admin/orders?status=`, `PATCH /api/admin/orders/:id` — `{ status }`
- `GET /api/admin/messages`, `PATCH /api/admin/messages/:id` — `{ isRead }`, `DELETE /api/admin/messages/:id`
- `GET /api/admin/subscribers`

## Project layout

```
public/            static site served by Express
  css/styles.css   shared design system
  js/common.js     header/footer, cart, API helper, product cards & modal
  js/*.js          per-page scripts (home, shop, cart, admin)
  images/          product photos (new-arrival/, store/, stock/)
  uploads/         images uploaded from the admin dashboard
server/
  app.js           Express app, security headers, error handling
  index.js         starts the app locally (api/index.js exports it for Vercel)
  db.js            schema, seeding, database helpers
  storage.js       product image uploads (Vercel Blob or local disk)
  catalog.js       categories and order statuses
  routes/          public and admin API routes
  data/            seed catalog (and the SQLite database at runtime)
_old-site/         the previous static site, kept for reference
```

## Deploying to Vercel

Vercel serves `public/` from its CDN and runs the Express app as a serverless function (`api/index.js`). `vercel.json` sends `/api/*` to the function and lets `/shop` load `shop.html`. Vercel functions have no permanent disk, so production data lives in hosted services:

| What | Service | Environment variables |
| --- | --- | --- |
| Database | [Turso](https://turso.tech) (hosted SQLite, free tier) | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` |
| Product photos you upload | Vercel Blob (free tier) | `BLOB_READ_WRITE_TOKEN` |

One-time setup in the Vercel dashboard for the project:

1. **Storage → Create Database → Turso** (Marketplace). Connect it to this project. This adds the `TURSO_*` variables.
2. **Storage → Create → Blob**. Connect it to this project. This adds `BLOB_READ_WRITE_TOKEN`.
3. **Settings → Environment Variables**: add `ADMIN_PASSWORD`, `SESSION_SECRET` (a long random string) and `WHATSAPP_NUMBER`.
4. **Deployments → Redeploy**, or push a commit.

On the first request the app creates its tables and loads the catalog automatically. To reset the live catalog from your computer, put the two `TURSO_*` values in `.env` and run `npm run seed`. Remove them from `.env` afterwards so local testing doesn't touch live data.

## Before going live

- Set a strong `ADMIN_PASSWORD`.
- Add real prices in the dashboard.
- On another host instead of Vercel, back up `server/data/store.db` and `public/uploads/`, or set the Turso and Blob variables there too.
