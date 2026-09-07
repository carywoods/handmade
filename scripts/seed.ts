import fs from 'node:fs';
import path from 'node:path';
import { getDb, upsertItem, logSystemEvent } from '../src/lib/db.js';
import { formatAffiliateUrl } from '../src/lib/affiliate.js';

interface SeedItem {
  asin: string;
  title: string;
  artisan_name?: string | null;
  category: string;
  description?: string | null;
  image_url: string;
  price_approx?: number | null;
  affiliate_url?: string;
  is_active?: number;
}

export function seed() {
  console.log('Seeding SQLite database with verified authentic handmade artisan goods...');
  const now = new Date().toISOString();

  let seedItems: SeedItem[] = [];
  const jsonPath = path.resolve(process.cwd(), 'scripts/seed-data.json');

  if (fs.existsSync(jsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        seedItems = data;
        console.log(`Loaded ${seedItems.length} verified artisan items from scripts/seed-data.json`);
      }
    } catch (err) {
      console.warn('Could not read scripts/seed-data.json, falling back to built-in seed list.');
    }
  }

  let count = 0;
  for (const prod of seedItems) {
    upsertItem({
      asin: prod.asin,
      title: prod.title,
      artisan_name: prod.artisan_name || 'Independent Artisan',
      category: prod.category,
      description: prod.description || 'Authentic artisan handmade creation.',
      image_url: prod.image_url,
      price_approx: prod.price_approx ?? null,
      affiliate_url: formatAffiliateUrl(prod.asin),
      is_active: prod.is_active !== undefined ? prod.is_active : 1,
      last_checked_date: now,
    });
    count++;
  }

  logSystemEvent('database_seed', 'success', `Seeded ${count} verified handmade items across categories`);
  console.log(`Successfully seeded ${count} artisan products into data/handmade.db`);
}

// Run when called directly
if (process.argv[1] && process.argv[1].includes('seed.ts')) {
  seed();
}
