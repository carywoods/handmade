# itsmadebyhand.com — Curated Artisan Marketplace

A high-performance, operationally passive curation platform showcasing genuine independent craftsmanship (woodworking, pottery, leather craft, textiles, and home goods). Built with **Astro SSR**, **TypeScript**, **Tailwind CSS**, and **SQLite**.

---

## 🌿 Core Architecture

- **Engine**: Astro SSR (Standalone Node Adapter via `@astrojs/node`)
- **Database**: SQLite (`data/handmade.db`) with WAL mode for fast, lightweight local relational storage
- **Aesthetic**: Warm, organic, earthy aesthetic with editorial serif typography (*Playfair Display*) and tactile whitespace
- **Affiliate & Compliance**: Strict Amazon Associates Operating Agreement compliance. No native cart checkout; direct outbound referral tracking via `/api/click?asin=...` with programmatic `AMAZON_TAG` injection
- **Multimodal AI Vision & Heuristic Shield**: Two-tier craft verification pipeline (`gemini-2.5-flash` + hardened heuristic regex) rejecting tools, machinery, kits, factory multi-packs, and commercial brands
- **Client-Side Wishlist Drawer**: Slide-over session drawer allowing users to queue handmade items and review direct Amazon links
- **Automated Workers & CLI Utilities**:
  - `npm run db:audit` — Multimodal AI vision audit inspecting all catalog items and imagery
  - `npm run db:purge` — Purges non-handmade, factory, or duplicate items from SQLite
  - `npm run scrape` — Live Amazon Handmade crawler with two-tier vision filtering
  - `npm run worker:check-rot` — Automated link-rot checker to flag 404s and de-list unavailable products
- **Operator Dashboard (`/admin`)**: Password-protected suite showing real-time traffic, outbound affiliate click counters, category breakdowns, logs, and manual worker triggers

---

## 📁 Directory Structure

```text
handmade/
├── data/
│   ├── handmade.db               # Local SQLite database (135 verified artisan goods)
│   └── verified-catalog.json     # Backup snapshot of verified authentic items
├── public/                       # Static assets & favicon
├── scripts/
│   ├── seed.ts                   # Seeds 135 verified artisan goods from snapshot
│   ├── seed-data.json            # Pristine catalog dataset for initial deployments
│   ├── audit-catalog.ts          # AI Vision audit script
│   ├── purge-non-handmade.ts     # Curated cleanup script
│   ├── scrape.ts                 # Amazon Handmade crawler & evaluator
│   ├── ingest.ts                 # Product ingestion worker
│   └── check-rot.ts              # Link-rot checker worker
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

### Live Amazon Handmade Scraper & Loader
Crawls live Amazon Handmade search results, inspects product photography, pricing, and maker attributes, runs our authenticity filter to reject mass-produced items, and loads verified goods directly into SQLite:
```bash
# Scrape top items across all 5 organic categories
npm run scrape

# Scrape a specific category with limit
npm run scrape -- --category "Pottery & Ceramics" --limit 5

# Scrape by custom search query
npm run scrape -- --query "handmade walnut cutting board" --limit 6

# Import specific ASINs directly
npm run scrape -- --asin "B0BW4LD35T,B00PMF383O"
```

### AI Vision Catalog Audit & Purge Utilities
Verify catalog craft authenticity using multimodal vision (`gemini-2.5-flash`) and remove commercial stragglers:
```bash
# Audit entire active catalog with Gemini Vision + HD image checks
npm run db:audit

# Purge any non-artisan, commercial brand, or duplicate listings from SQLite
npm run db:purge
```

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
