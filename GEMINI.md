# Master Project Blueprint: itsmadebyhand.com

## 1. Project Objective & Core Vibe
- **Domain**: itsmadebyhand.com
- **Target Audience**: Fans of genuine independent craftsmanship who appreciate handmade goods.
- **Visual Design**: Light, clean, organic aesthetic. Generous whitespace, warm neutral/earthy color palettes, high-contrast serif headings, and clean card-grid layouts framing high-res product photography.
- **Core Directive**: Absolute operational reliability. The site must be completely passive, requiring zero manual upkeep for ongoing catalog management.

## 2. Technical Stack
- **Framework**: Astro + TypeScript (chosen for minimal footprint and maximum static generation speed).
- **Database**: SQLite (`data/handmade.db`) for lightweight, server-local relational storage.
- **Version Control & Hosting**: Git repository tracked via GitHub, pulled and deployed automatically through Coolify. Environment variables (`AMAZON_TAG`, admin credentials) are injected via the Coolify UI.

## 3. Database Schema (`data/handmade.db`)
Create a robust SQLite schema capable of supporting item tracking, category filtering, and link-rot verification:
- `items`:
  - `id` (INTEGER, Primary Key, Auto-increment)
  - `asin` (TEXT, Unique, Not Null)
  - `title` (TEXT, Not Null)
  - `artisan_name` (TEXT)
  - `category` (TEXT)
  - `description` (TEXT)
  - `image_url` (TEXT, Not Null)
  - `price_approx` (REAL)
  - `affiliate_url` (TEXT, Not Null)
  - `is_active` (BOOLEAN, Default 1)
  - `last_checked_date` (DATETIME)
  - `created_at` (DATETIME DEFAULT CURRENT_TIMESTAMP)

## 4. Affiliate & Compliance Architecture
- **No Rogue Native Checkout**: To strictly adhere to Amazon Associates operating agreements, do not attempt to process payments or fake native pricing carts. 
- **Outbound Bag / Wishlist Drawer**: Implement a lightweight client-side session drawer where users can queue handmade items. When they click to proceed, provide clear multi-item routing or direct item-level click-throughs.
- **Affiliate Tag Injection**: Every outbound link must programmatically format using the tracking variable: `https://www.amazon.com/dp/{ASIN}?tag={AMAZON_TAG}`.
- **Fulfillment Transparency**: Include clear disclosures in the header/footer informing users that items are fulfilled directly by Amazon and that `itsmadebyhand.com` earns qualifying commissions.

## 5. Automated Background Workers & Maintenance
- **Monthly Ingestion Script**: A standalone TypeScript/Node worker designed to pull, vet, and add a fresh batch of verified handmade products into SQLite. The script must utilize strict filtering keywords to weed out mass-produced items or dropshippers, ensuring only authentic artisan goods make it into the database.
- **Weekly Link-Rot Checker**: An automated worker that runs weekly checks (HTTP HEAD requests or API pings) against every active ASIN in the database. If a product returns a 404 or goes out of stock, the script automatically toggles `is_active = 0` or flags it for pruning so users never hit dead links.

## 6. Admin Dashboard (`/admin`)
- A secure, password-protected route built into the Astro project.
- **Features**: 
  - Real-time traffic metrics and view counters.
  - Current active item count and category breakdown.
  - Timestamp of the last successful monthly ingestion run.
  - Manual action triggers to force a link-rot check scan or prune flagged items.

## 7. SEO & Performance Optimization
- Generate clean semantic HTML via Astro components.
- Implement automated dynamic sitemap generation (`astro:sitemap`) and OpenGraph metadata tags on product and category pages to capture organic search traffic effectively.
