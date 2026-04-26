# GIT Yarn

GIT Yarn (Get It Together) is a TanStack Start app for crocheters and knitters to organize personal inventory, maintain a yarn catalog, and map barcodes to yarn records.

## Stack

- TanStack Start + TanStack Router
- Turso (libSQL) with Drizzle ORM
- In-house auth (email/password + DB-backed sessions)
- Cloudflare R2 S3-compatible storage client
- Lucide icons
- Progressive Web App support (`manifest.json` + service worker)

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

## Environment variables

Set these in `.env` for local development and in Vercel project settings for production:

- `SESSION_SECRET`
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `ADMIN_EMAILS` (comma-separated list for admin role assignment on sign-up)

## Database workflow (Turso + Drizzle)

```bash
npm run db:generate
npm run db:push
```

If you recently pulled role/profile changes, run `npm run db:push` to add the `users.role` column.

Schema file: `src/lib/db/schema.ts`

## Authentication endpoints

- `POST /api/auth/sign-up`
- `POST /api/auth/sign-in`
- `POST /api/auth/sign-out`
- `GET /api/auth/me`

## Scraper workflow

1. Configure manufacturer source pages and selectors in `data/sources/manufacturers.json`.
   - Selector format supports text or attribute extraction:
     - `.product-title` -> text content
     - `a|attr:href` -> attribute extraction
     - `:self|attr:data-upc` -> attribute on the card root itself
   - Use `detailSelectors` to scrape product detail pages (when `productUrl` exists).
   - Use `detailRecordSelectors` when one product detail page contains many color variants/cards.
     This is useful for sites like Premier Yarns where listing cards do not expose all colorways.
   - Use `productFeed.urlTemplate` when collection pages are JS-rendered. For Shopify stores,
     `.../collections/<collection>/products.json?page={page}&limit=250` is usually the most reliable source.
   - Use `productJson.template` for Shopify-style product JSON endpoints (`/products/{handle}.js`) to extract variants robustly.
2. Run scraper to generate normalized catalog JSON:

```bash
npm run scrape:yarn
```

Optional flags:

```bash
npm run scrape:yarn -- --verbose
npm run scrape:yarn -- --source=example-yarn-co
npm run scrape:yarn -- --limit-pages=2
```

3. Optional: seed Turso from scraped results:

```bash
npm run scrape:yarn -- --seed
```

Outputs are saved to `data/catalog/latest.json`, `data/catalog/latest.meta.json`, and timestamped snapshots.

Current source status in `data/sources/manufacturers.json`:

- Enabled feed-based sources: Premier Yarns, Lion Brand, Hobbii, Yarnspirations, Darn Good Yarn, Gorgeous Alpacas
- Added but disabled pending selector tuning / anti-bot handling: Red Heart, Knit Picks, Berroco, James C. Brett, Malabrigo Yarn, Scheepjes

## Deploying on Vercel

- Framework preset: `Other` (or auto-detected Vite)
- Build command: `npm run build`
- Output: managed by TanStack Start build process
- Add all environment variables in Vercel before first deployment

Connect domain `gityarn.com` in Vercel and point DNS when deployment is ready.
