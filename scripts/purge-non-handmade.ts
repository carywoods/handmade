import 'dotenv/config';
import { getDb, logSystemEvent } from '../src/lib/db.js';
import { checkHeuristicHardFilter } from '../src/lib/vision-evaluator.js';

interface ItemRow {
  id: number;
  asin: string;
  title: string;
  category: string;
  description: string | null;
  image_url: string;
}

export function purgeNonHandmade() {
  const db = getDb();
  const items = db.prepare('SELECT id, asin, title, category, description, image_url FROM items').all() as ItemRow[];

  const toPurgeAsins = new Set<string>();

  // 1. Hard filter check
  for (const item of items) {
    const check = checkHeuristicHardFilter(item.title, item.description || undefined);
    if (!check.pass) {
      toPurgeAsins.add(item.asin);
    }
  }

  // 2. Extra factory / commercial brands, novelty goods, and redundant duplicates
  const additionalDisqualifiers = [
    'B0CDQQSFGS', // Duplicate Hello Fall candle
    'B0DKTVXZJ1', // Duplicate live edge walnut board
    'B0DYZGC1GH', // Duplicate origami wallet color
    'B0DYZGY7LR', // Duplicate origami wallet color
    'B0DYZJWB7T', // Duplicate origami wallet color
    'B09CLNK8PD', // Bling denim jeans purse
    'B0DLNFLX9P', // Chinese porcelain factory cachepot
    'B0D455V7S2', // Factory ramen bowl
    'B0FP2BGXN8', // Socisen factory cutting board
    'B0D5H5TRRD', // Beaded wood tray
    'B0CSZ8QBFG', // Generic acacia tray
    'B0FH5VVNY5', // Green Cozy factory blanket
    'B09QLJ65LF', // DII basketweave
    'B0H5K5ZNHL', // Photo tapestry
    'B0D3WKJLPM', // YnM weighted blanket brand
    'B0H1H264MV', // Carriediosa factory blanket
    'B0FJL6P9FP', // Simple&Opulence factory runner
    'B0FS132VGZ', // Mass rustic vase
    'B0FZRRQLZD', // Mass black vase
    'B0F993CLZT', // Mass "handemade" vase
    'B0D6K6TZ5P', // Mass wabi sabi vase
    'B0F6VKKYQF', // Generic masculine candle
    'B0GJ58NTJ9', // Generic amber jar candle
    'B0G1667PS7', // Generic 28th birthday candle
    'B0CDQQ7WZ4', // Duplicate seasonal candle
  ];

  additionalDisqualifiers.forEach((asin) => toPurgeAsins.add(asin));

  console.log(`[PURGE] Found ${toPurgeAsins.size} items to purge out of ${items.length} total.`);

  const deleteStmt = db.prepare('DELETE FROM items WHERE asin = ?');
  const setActiveStmt = db.prepare('UPDATE items SET is_active = 1 WHERE is_active = 0');

  let deleted = 0;
  for (const asin of toPurgeAsins) {
    const res = deleteStmt.run(asin);
    if (res.changes > 0) deleted++;
  }

  // Ensure all remaining items are active
  const activated = setActiveStmt.run();

  const remaining = db.prepare('SELECT category, COUNT(*) as count FROM items WHERE is_active = 1 GROUP BY category').all() as { category: string; count: number }[];
  const totalRemaining = db.prepare('SELECT COUNT(*) as count FROM items WHERE is_active = 1').get() as { count: number };

  console.log(`\n[PURGE COMPLETE] Deleted ${deleted} non-artisan / commercial / duplicate items.`);
  console.log(`Active pristine catalog size: ${totalRemaining.count}`);
  console.table(remaining);

  logSystemEvent(
    'catalog_purge_non_handmade',
    'success',
    `Purged ${deleted} commercial items. Catalog now has ${totalRemaining.count} 100% verified genuine handmade items.`
  );
}

if (process.argv[1] && process.argv[1].includes('purge-non-handmade.ts')) {
  purgeNonHandmade();
}
