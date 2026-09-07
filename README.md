# itsmadebyhand.com — Curated Artisan Marketplace

A high-performance, operationally passive curation platform showcasing genuine independent craftsmanship (woodworking, pottery, leather craft, textiles, and home goods). Built with **Astro SSR**, **TypeScript**, **Tailwind CSS**, and **SQLite**.

---

## 🌿 Core Architecture

- **Engine**: Astro SSR (Standalone Node Adapter via `@astrojs/node`)
- **Database**: SQLite (`data/handmade.db`) with WAL mode for fast, lightweight local relational storage
- **Aesthetic**: Warm, organic, earthy aesthetic with editorial serif typography (*Playfair Display*) and tactile whitespace
- **Affiliate & Compliance**: Strict Amazon Associates Operating Agreement compliance. No native cart checkout; direct outbound referral tracking via `/api/click?asin=...` with programmatic `AMAZON_TAG` injection
- **Client-Side Wishlist Drawer**: Slide-over session drawer allowing users to queue handmade items and review direct Amazon links
- **Automated Workers**:
  - `npm run worker:ingest` — Monthly ingestion script with artisan keyword and mass-production weed-out filter
  - `npm run worker:check-rot` — Weekly automated link-rot checker to flag 404s and de-list unavailable products
- **Operator Dashboard (`/admin`)**: Password-protected suite showing real-time traffic, outbound affiliate click counters, category breakdowns, logs, and manual worker triggers

---

## 📁 Directory Structure

```text
handmade/
├── data/
│   └── handmade.db               # Local SQLite database (persisted via Docker volume)
├── public/                       # Static assets & favicon
├── scripts/
│   ├── seed.ts                   # Seeds 19 authentic artisan goods across 5 categories
│   ├── ingest.ts                 # Monthly product ingestion worker with quality filter
│   └── check-rot.ts              # Weekly link-rot checker worker
├── src/
│   ├── components/
│   │   ├── Header.astro          # Site header with category navigation & wishlist trigger
│   │   ├── Footer.astro          # Site footer with full Amazon Associates disclosure
│   │   ├── ProductCard.astro     # Clean card grid framing product photography
│   │   └── WishlistDrawer.astro  # Client-side sliding bag / review drawer
│   ├── layouts/
│   │   └── Layout.astro          # Global layout with SEO, OpenGraph, fonts, & view tracker
│   ├── lib/
│   │   ├── db.ts                 # SQLite connection, schema migrations, and queries
│   │   ├── affiliate.ts          # Amazon tag formatting and compliance text
│   │   └── auth.ts               # Admin session cookie authentication
│   ├── pages/
│   │   ├── index.astro           # Homepage with hero, category pills, search & sorting
│   │   ├── about.astro           # Philosophy, curation manifesto & compliance details
│   │   ├── category/
│   │   │   └── [category].astro  # Dynamic category landing pages with OpenGraph tags
│   │   ├── item/
│   │   │   └── [asin].astro      # Product detail page with maker story & related crafts
│   │   ├── admin/
│   │   │   ├── index.astro       # Operator control panel (metrics, logs, actions)
│   │   │   └── login.astro       # Secure passphrase authentication form
│   │   └── api/
│   │       ├── click.ts          # Outbound affiliate click tracking redirect
│   │       ├── view.ts           # Page view logging endpoint
│   │       └── admin/
│   │           ├── auth.ts       # Admin session login/logout
│   │           └── action.ts     # Triggers for workers, pruning, and item toggles
│   └── styles/
│       └── global.css            # Tailwind theme with warm neutral & clay colors
├── Dockerfile                    # Multi-stage production container for Coolify
├── .dockerignore
├── .env.example
├── astro.config.mjs
└── package.json
```

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default local settings:
```env
AMAZON_TAG=itsmadebyhand-20
ADMIN_PASSWORD=artisan-secret-2026
PORT=4321
HOST=127.0.0.1
```

### 3. Initialize & Seed Database
```bash
npm run db:seed
```

### 4. Start Development Server
```bash
npm run dev
```
Open `http://localhost:4321` in your browser.

---

## 🛠️ Background Workers

### Monthly Ingestion Worker
Pulls incoming artisan candidates, executes heuristic quality filters to weed out mass-produced items and wholesale dropshippers, classifies them into the 5 core organic categories, and registers them in SQLite:
```bash
npm run worker:ingest
```

### Weekly Link-Rot Checker
Verifies live reachability against Amazon for all active ASINs with realistic headers and backoff. Deactivates (`is_active = 0`) any listings that return 404 or show out-of-stock notices:
```bash
npm run worker:check-rot
```

---

## 🔐 Operator Dashboard (`/admin`)

Access `/admin` and authenticate with your configured `ADMIN_PASSWORD`.
Features include:
- Real-time page view impressions & 24h delta
- Outbound Amazon affiliate click conversions
- Active vs. inactive product ratio
- Category distribution breakdown
- Interactive worker controls:
  - **Trigger Monthly Ingestion**: executes artisan import script
  - **Run Weekly Link-Rot Scan**: scans active inventory
  - **Prune Inactive**: purges dead listings
  - **Item Status Toggles**: manually activate or deactivate items

---

## 🐳 Coolify Deployment Guide

1. **Repository**: Push this directory to your GitHub repository.
2. **Coolify Service**:
   - Create a new service from your Git repository in Coolify.
   - Build Pack: **Dockerfile**.
3. **Persistent Volume**:
   - Mount a persistent storage volume to `/app/data` to ensure the SQLite database (`handmade.db`) persists across redeployments.
4. **Environment Variables**:
   In the Coolify UI, set:
   - `AMAZON_TAG`: Your Amazon Associates tracking ID (e.g. `yourtag-20`)
   - `ADMIN_PASSWORD`: Strong administrator passphrase
   - `NODE_ENV`: `production`
   - `PORT`: `3000`
5. **Scheduled Tasks (Cron) in Coolify**:
   Configure Coolify's built-in Scheduled Tasks:
   - **Weekly Link-Rot Check**: `0 3 * * 0` (Every Sunday at 3:00 AM) -> `tsx scripts/check-rot.ts`
   - **Monthly Ingestion**: `0 4 1 * *` (1st day of month at 4:00 AM) -> `tsx scripts/ingest.ts`
