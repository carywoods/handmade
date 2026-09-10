import 'dotenv/config';
import { getDb, upsertItem, logSystemEvent } from '../src/lib/db.js';
import { formatAffiliateUrl } from '../src/lib/affiliate.js';
import { isValidAsin } from '../src/lib/asin.js';

/**
 * Filter to weed out mass-produced goods, dropshippers, and factory resellers.
 */
const FORBIDDEN_KEYWORDS = [
  'factory made',
  'mass-produced',
  'mass produced',
  'wholesale lot',
  'pack of 50',
  'pack of 100',
  'polyresin',
  'plastic injection',
  'oem generic',
  'dropship',
  'drop ship',
  'bulk cheap',
  'aliexpress',
  'temu',
  'synthetic polyester faux',
];

const ARTISAN_POSITIVE_SIGNALS = [
  'handcrafted',
  'handmade',
  'wheel-thrown',
  'hand-carved',
  'hand-stitched',
  'hand-forged',
  'vegetable-tanned',
  'full-grain',
  'solid wood',
  'natural beeswax',
  'pure linen',
  'artisan studio',
  'small batch',
];

interface RawProductInput {
  asin: string;
  title: string;
  artisan_name?: string;
  category?: string;
  description?: string;
  image_url: string;
  price_approx?: number;
}

/**
 * Ingestion Quality Filter (combines keyword scrutiny and artisan validation)
 */
export function evaluateArtisanAuthenticity(product: RawProductInput): {
  approved: boolean;
  reason: string;
  inferredCategory: string;
} {
  // Validate ASIN format first
  if (!isValidAsin(product.asin)) {
    return {
      approved: false,
      reason: `Invalid ASIN format: "${product.asin}". Must be a 10-character alphanumeric string.`,
      inferredCategory: 'Unassigned',
    };
  }

  const content = `${product.title} ${product.description || ''} ${product.artisan_name || ''}`.toLowerCase();

  // Check against blacklisted mass-produced terms
  for (const forbidden of FORBIDDEN_KEYWORDS) {
    if (content.includes(forbidden)) {
      return {
        approved: false,
        reason: `Flagged mass-production keyword: "${forbidden}"`,
        inferredCategory: 'Unassigned',
      };
    }
  }

  // Check positive artisan craftsmanship signals
  const hasArtisanSignal = ARTISAN_POSITIVE_SIGNALS.some((term) => content.includes(term));
  if (!hasArtisanSignal && !product.artisan_name) {
    return {
      approved: false,
      reason: 'Lacks verifiable artisan craftsmanship attributes or maker attribution',
      inferredCategory: 'Unassigned',
    };
  }

  // Infer or validate organic category
  let category = product.category || 'Home & Living';
  if (content.includes('wood') || content.includes('walnut') || content.includes('oak') || content.includes('maple') || content.includes('cedar') || content.includes('timber')) {
    category = 'Woodworking';
  } else if (content.includes('pottery') || content.includes('ceramic') || content.includes('stoneware') || content.includes('clay') || content.includes('earthenware') || content.includes('porcelain')) {
    category = 'Pottery & Ceramics';
  } else if (content.includes('leather') || content.includes('wallet') || content.includes('hide') || content.includes('journal') || content.includes('horween')) {
    category = 'Leather Goods';
  } else if (content.includes('linen') || content.includes('textile') || content.includes('cotton') || content.includes('wool') || content.includes('knit') || content.includes('woven') || content.includes('blanket')) {
    category = 'Textiles';
  } else {
    category = 'Home & Living';
  }

  return {
    approved: true,
    reason: 'Passed artisan verification criteria',
    inferredCategory: category,
  };
}

/**
 * Candidate pool used by the worker (can be augmented by Amazon PA-API when keys are supplied)
 */
const DISCOVERY_CANDIDATES: RawProductInput[] = [
  {
    asin: 'B09ARTISAN01',
    title: 'Solid Cherry Wood Hand-Carved Dumpling & Pastry Board',
    artisan_name: 'Hearth & Chisel',
    description: 'Carved from single block Pennsylvania cherry wood with traditional relief carved edges and food-safe walnut oil finish.',
    image_url: 'https://images.unsplash.com/photo-1590736704728-f4730bb30770?auto=format&fit=crop&w=900&q=80',
    price_approx: 62.00,
  },
  {
    asin: 'B09ARTISAN02',
    title: 'Terracotta Hand-Pressed Wall Planter with Drainage Hole',
    artisan_name: 'Mud & Petal Clay Studio',
    description: 'Hand-shaped from unglazed terracotta with sunburst textured motif. Porous earthenware breathable planter for succulents and herbs.',
    image_url: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=900&q=80',
    price_approx: 34.00,
  },
  {
    asin: 'B09DROPSHIP01',
    title: 'Generic Wholesale Pack of 100 Plastic Molded Mugs Dropship',
    artisan_name: 'Factory Reseller Wholesale',
    description: 'Factory made cheap mass-produced wholesale plastic injection cups.',
    image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=80',
    price_approx: 9.99,
  },
  {
    asin: 'B09ARTISAN03',
    title: 'Hand-Forged Damascus Steel EDC Pocket Knife with Walnut Scales',
    artisan_name: 'Iron Peak Bladesmiths',
    description: 'Folded 1095 and 15N20 high-carbon steel handcrafted by bladesmiths. Brass bolsters and hand-rubbed walnut handle scales.',
    image_url: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=900&q=80',
    price_approx: 115.00,
  },
  {
    asin: 'B09ARTISAN04',
    title: 'Hand-Spun Alpaca Wool Cable Beanie in Natural Fawn',
    artisan_name: 'Andean Mountain Fibers',
    description: 'Undyed pure Peruvian baby alpaca hand-spun and knit on circular needles. Incredibly soft, featherlight, and non-itchy warmth.',
    image_url: 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?auto=format&fit=crop&w=900&q=80',
    price_approx: 45.00,
  }
];

export async function runIngestion() {
  console.log('--- Starting Monthly Artisan Product Ingestion Run ---');
  const now = new Date().toISOString();

  let accepted = 0;
  let rejected = 0;

  for (const candidate of DISCOVERY_CANDIDATES) {
    const evaluation = evaluateArtisanAuthenticity(candidate);

    if (evaluation.approved) {
      upsertItem({
        asin: candidate.asin,
        title: candidate.title,
        artisan_name: candidate.artisan_name || 'Independent Artisan',
        category: evaluation.inferredCategory,
        description: candidate.description || 'Authentic artisan crafted goods.',
        image_url: candidate.image_url,
        price_approx: candidate.price_approx || null,
        affiliate_url: formatAffiliateUrl(candidate.asin),
        is_active: 1,
        last_checked_date: now,
      });
      accepted++;
      console.log(`[ACCEPTED] ${candidate.title} -> Category: ${evaluation.inferredCategory}`);
    } else {
      rejected++;
      console.log(`[REJECTED] ${candidate.title} (Reason: ${evaluation.reason})`);
    }
  }

  const logMessage = `Ingested ${accepted} verified artisan products. Screened out ${rejected} unverified/mass-produced candidates.`;
  logSystemEvent('monthly_ingestion', 'success', logMessage);
  console.log(`--- Ingestion Finished: ${logMessage} ---`);
}

// Run only when invoked directly from CLI
if (process.argv[1] && process.argv[1].includes('ingest.ts')) {
  runIngestion().catch((err) => {
    console.error('Ingestion worker error:', err);
    logSystemEvent('monthly_ingestion', 'error', String(err));
    process.exit(1);
  });
}
