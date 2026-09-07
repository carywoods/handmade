import 'dotenv/config';
import { getDb, logSystemEvent } from '../src/lib/db.js';
import { evaluateProductPictureAndCraft } from '../src/lib/vision-evaluator.js';

interface ItemRow {
  id: number;
  asin: string;
  title: string;
  category: string;
  description: string | null;
  image_url: string;
  is_active: number;
}

export async function runCatalogAudit(options: { pruneDeleted?: boolean } = {}) {
  console.log('===============================================================');
  console.log('  itsmadebyhand.com — AI Vision & Picture Craft Catalog Audit');
  console.log('===============================================================');

  const db = getDb();
  const items = db.prepare('SELECT id, asin, title, category, description, image_url, is_active FROM items').all() as ItemRow[];

  console.log(`Auditing ${items.length} items currently in SQLite database...\n`);

  let verifiedCount = 0;
  let rejectedCount = 0;

  const updateItem = db.prepare(`
    UPDATE items
    SET is_active = @is_active,
        image_url = @image_url,
        category = @category,
        last_checked_date = @last_checked_date
    WHERE id = @id
  `);

  const deleteItem = db.prepare('DELETE FROM items WHERE id = ?');
  const now = new Date().toISOString();

  for (const item of items) {
    console.log(`[AUDITING] ${item.asin}: "${item.title.slice(0, 60)}..."`);

    const evalResult = await evaluateProductPictureAndCraft(
      item.image_url,
      item.title,
      item.description || undefined,
      item.category
    );

    if (!evalResult.has_valid_picture || !evalResult.is_handmade) {
      rejectedCount++;
      console.warn(`  ❌ REJECTED: ${evalResult.reason}`);

      if (options.pruneDeleted) {
        deleteItem.run(item.id);
        console.log(`  🗑️  Purged from database.`);
      } else {
        updateItem.run({
          id: item.id,
          is_active: 0,
          image_url: evalResult.enhanced_image_url || item.image_url,
          category: item.category,
          last_checked_date: now,
        });
        console.log(`  ⚠️  Deactivated in database (is_active = 0).`);
      }
    } else {
      verifiedCount++;
      console.log(`  ✅ VERIFIED GENUINE HANDMADE (${evalResult.category})`);
      console.log(`     Confidence: ${(evalResult.confidence * 100).toFixed(0)}% | ${evalResult.reason}`);

      updateItem.run({
        id: item.id,
        is_active: 1,
        image_url: evalResult.enhanced_image_url || item.image_url,
        category: evalResult.category || item.category,
        last_checked_date: now,
      });
    }

    // Small delay to be polite to vision API
    await new Promise((r) => setTimeout(r, 400));
  }

  const summary = `AI Vision Audit Completed: ${verifiedCount} genuine handmade items verified with valid pictures. ${rejectedCount} items flagged/deactivated.`;
  logSystemEvent('catalog_vision_audit', rejectedCount > 0 ? 'warning' : 'success', summary);

  console.log('\n================ AUDIT SUMMARY ================');
  console.log(`Total Inspected : ${items.length}`);
  console.log(`Genuine Handmade: ${verifiedCount}`);
  console.log(`Flagged/Removed : ${rejectedCount}`);
  console.log('================================================\n');

  return { total: items.length, verified: verifiedCount, rejected: rejectedCount };
}

// Run directly from CLI
if (process.argv[1] && process.argv[1].includes('audit-catalog.ts')) {
  const prune = process.argv.includes('--prune');
  runCatalogAudit({ pruneDeleted: prune }).catch((err) => {
    console.error('Audit fatal error:', err);
    process.exit(1);
  });
}
