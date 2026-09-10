import * as cheerio from 'cheerio';
import { upsertItem, logSystemEvent } from './db.js';
import { formatAffiliateUrl } from './affiliate.js';
import { isValidAsin, normalizeAsin } from './asin.js';
import { evaluateProductPictureAndCraft, enhanceImageUrl } from './vision-evaluator.js';

export interface ScrapedProduct {
  asin: string;
  title: string;
  artisan_name: string;
  category: string;
  description: string;
  image_url: string;
  price_approx: number | null;
  approved: boolean;
  reject_reason?: string;
}

const BROWSER_PROFILES = [
  {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"macOS"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  },
  {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.8',
    'Sec-Ch-Ua': '"Chromium";v="125", "Google Chrome";v="125", "Not-A.Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  }
];

function getRandomHeaders() {
  return BROWSER_PROFILES[Math.floor(Math.random() * BROWSER_PROFILES.length)];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const CATEGORY_SEARCH_QUERIES: Record<string, string[]> = {
  'Woodworking': [
    'handmade cutting board artisan wood',
    'handmade wooden salad bowl artisan',
    'handmade live edge serving tray wood',
  ],
  'Pottery & Ceramics': [
    'handmade stoneware coffee mug',
    'wheel thrown pottery vase ceramic',
    'handmade ceramic ramen bowl artisan',
  ],
  'Leather Goods': [
    'handmade leather bifold wallet full grain',
    'handmade leather journal cover refillable',
    'handmade leather tote bag artisan',
  ],
  'Textiles': [
    'handmade woven linen throw blanket',
    'handmade wool knit blanket throw',
    'handmade cotton table runner handwoven',
  ],
  'Home & Living': [
    'handmade pure beeswax taper candles pair',
    'hand forged iron coat hook blacksmith',
    'handmade soy scented candle amber jar artisan',
  ],
};

/**
 * Scrapes Amazon Handmade search results for a given query
 */
export async function scrapeSearchQuery(
  query: string,
  targetCategory?: string,
  maxItems = 10
): Promise<ScrapedProduct[]> {
  const encodedQuery = encodeURIComponent(query);
  const results: ScrapedProduct[] = [];
  let page = 1;
  const maxPages = Math.min(5, Math.ceil(maxItems / 10) + 1);

  while (results.length < maxItems && page <= maxPages) {
    const searchUrl = `https://www.amazon.com/s?k=${encodedQuery}&i=handmade${page > 1 ? `&page=${page}` : ''}`;
    console.log(`[SCRAPER] Querying Amazon Handmade: "${query}" (Page ${page})...`);

    try {
      const res = await fetch(searchUrl, {
        headers: getRandomHeaders(),
      });

      if (res.status === 503 || res.status === 429) {
        console.warn(`[SCRAPER] Amazon rate limited/challenged (${res.status}) on query "${query}" page ${page}`);
        break;
      }

      if (!res.ok) {
        console.warn(`[SCRAPER] Amazon search returned status ${res.status} for query "${query}" page ${page}`);
        break;
      }

      const html = await res.text();
      const $ = cheerio.load(html);
      const items = $('[data-asin]').toArray();

      if (items.length === 0) {
        console.log(`[SCRAPER] No more items found on page ${page}.`);
        break;
      }

      let itemsOnThisPage = 0;
      for (const el of items) {
        if (results.length >= maxItems) break;

        const asin = normalizeAsin($(el).attr('data-asin'));
        if (!asin) continue;
        if (results.some((r) => r.asin === asin)) continue;

        // Extract title
        const title =
          $(el).find('h2 span').text().trim() ||
          $(el).find('.a-text-normal').text().trim() ||
          $(el).find('h2 a').text().trim();

        if (!title || title.length < 5) continue;

        // Extract image
        const image_url = $(el).find('img.s-image').attr('src');
        if (!image_url || !image_url.startsWith('http')) continue;

        // Extract price
        const priceText = $(el).find('.a-price .a-offscreen').first().text().trim();
        let price_approx: number | null = null;
        if (priceText) {
          const num = parseFloat(priceText.replace(/[^0-9.]/g, ''));
          if (!isNaN(num) && num > 0) {
            price_approx = num;
          }
        }

        // Extract artisan / brand
        let artisan_name = $(el)
          .find('.a-row.a-size-base.a-color-secondary span, .s-line-clamp-1, h5 span')
          .first()
          .text()
          .trim();

        if (!artisan_name || artisan_name.toLowerCase().includes('prime') || artisan_name.length < 2) {
          artisan_name = 'Independent Artisan';
        }

        // Quality & Picture Evaluation via Multimodal Vision
        const enhancedImageUrl = enhanceImageUrl(image_url);
        const evalResult = await evaluateProductPictureAndCraft(
          enhancedImageUrl,
          title,
          undefined,
          targetCategory
        );

        const isApproved = evalResult.has_valid_picture && evalResult.is_handmade;
        const finalCategory = (evalResult.category && evalResult.category !== 'Rejected') ? evalResult.category : (targetCategory || 'Home & Living');

        results.push({
          asin,
          title,
          artisan_name,
          category: finalCategory,
          description: `Authentic handcrafted ${finalCategory.toLowerCase()} piece made by independent artisans. Verified for genuine craftsmanship and fulfilled securely by Amazon.`,
          image_url: evalResult.enhanced_image_url || enhancedImageUrl,
          price_approx,
          approved: isApproved,
          reject_reason: isApproved ? undefined : evalResult.reason,
        });

        itemsOnThisPage++;
        await sleep(100);
      }

      console.log(`[SCRAPER] Parsed ${itemsOnThisPage} items from page ${page}. Total collected: ${results.length}/${maxItems}`);
      page++;
      await sleep(600);
    } catch (err: any) {
      console.error(`[SCRAPER] Search error on query "${query}":`, err?.message || err);
      break;
    }
  }

  return results;
}

/**
 * Scrapes a single product's detail page for deeper story / specs
 */
export async function scrapeProductDetails(asin: string): Promise<Partial<ScrapedProduct> | null> {
  const productUrl = `https://www.amazon.com/dp/${asin}`;

  try {
    const res = await fetch(productUrl, {
      headers: getRandomHeaders(),
    });

    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    const title = $('#productTitle').text().trim();
    const artisan_name = $('#bylineInfo, #handmade-artisan-profile-link, .author')
      .first()
      .text()
      .replace(/^Brand:\s*/i, '')
      .trim();

    const bullets: string[] = [];
    $('#feature-bullets ul li span.a-list-item').each((_, el) => {
      const text = $(el).text().trim();
      if (text && !text.includes('Make sure this fits')) {
        bullets.push(text);
      }
    });

    const description = bullets.length > 0 ? bullets.join(' ') : $('#productDescription').text().trim();
    const image_url = $('#landingImage, #imgBlkFront').attr('src') || $('img.a-dynamic-image').attr('src');

    return {
      title: title || undefined,
      artisan_name: artisan_name || undefined,
      description: description || undefined,
      image_url: image_url || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * High-level function: Scrapes and uploads handmade items directly to SQLite
 */
export async function scrapeAndUploadCatalog(options: {
  categories?: string[];
  maxPerCategory?: number;
  customQuery?: string;
  customAsins?: string[];
} = {}): Promise<{ totalScraped: number; approved: number; rejected: number; items: ScrapedProduct[] }> {
  const {
    categories = Object.keys(CATEGORY_SEARCH_QUERIES),
    maxPerCategory = 5,
    customQuery,
    customAsins,
  } = options;

  console.log('=== Starting Amazon Handmade Catalog Scraper & Importer ===');
  const now = new Date().toISOString();

  let totalScraped = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  const processedItems: ScrapedProduct[] = [];

  // If specific ASINs are supplied
  if (customAsins && customAsins.length > 0) {
    for (const rawAsin of customAsins) {
      const asin = normalizeAsin(rawAsin);
      if (!asin) {
        console.warn(`[SCRAPER] Skipping invalid ASIN format: "${rawAsin}"`);
        continue;
      }
      await sleep(500);
      const details = await scrapeProductDetails(asin);
      if (details && details.title && details.image_url) {
        const evalResult = await evaluateProductPictureAndCraft(
          details.image_url,
          details.title,
          details.description
        );

        totalScraped++;

        if (evalResult.has_valid_picture && evalResult.is_handmade) {
          const product: ScrapedProduct = {
            asin,
            title: details.title,
            artisan_name: details.artisan_name || 'Independent Artisan',
            category: evalResult.category !== 'Rejected' ? evalResult.category : 'Home & Living',
            description: details.description || 'Authentic artisan handmade creation.',
            image_url: evalResult.enhanced_image_url || details.image_url,
            price_approx: null,
            approved: true,
          };

          upsertItem({
            asin: product.asin,
            title: product.title,
            artisan_name: product.artisan_name,
            category: product.category,
            description: product.description,
            image_url: product.image_url,
            price_approx: product.price_approx,
            affiliate_url: formatAffiliateUrl(product.asin),
            is_active: 1,
            last_checked_date: now,
          });

          approvedCount++;
          processedItems.push(product);
          console.log(`[APPROVED ASIN] ${asin} -> "${product.title}" (${product.category})`);
        } else {
          rejectedCount++;
          console.warn(`[REJECTED ASIN] ${asin} -> "${details.title}" (${evalResult.reason})`);
        }
      }
    }
  }

  // If custom query is supplied
  if (customQuery && customQuery.trim().length > 0) {
    const candidates = await scrapeSearchQuery(customQuery.trim(), undefined, maxPerCategory);
    for (const cand of candidates) {
      totalScraped++;
      if (cand.approved) {
        approvedCount++;
        upsertItem({
          asin: cand.asin,
          title: cand.title,
          artisan_name: cand.artisan_name,
          category: cand.category,
          description: cand.description,
          image_url: cand.image_url,
          price_approx: cand.price_approx,
          affiliate_url: formatAffiliateUrl(cand.asin),
          is_active: 1,
          last_checked_date: now,
        });
        console.log(`[APPROVED & UPLOADED] ${cand.asin}: ${cand.title} (${cand.category})`);
      } else {
        rejectedCount++;
        console.log(`[REJECTED FILTER] ${cand.asin}: ${cand.title} (${cand.reject_reason})`);
      }
      processedItems.push(cand);
    }
  }

  // Default: Scrape through configured categories
  if (!customQuery && (!customAsins || customAsins.length === 0)) {
    for (const cat of categories) {
      const queries = CATEGORY_SEARCH_QUERIES[cat] || [`handmade ${cat}`];
      let approvedForCategory = 0;
      const targetPerQuery = Math.max(10, Math.ceil(maxPerCategory / queries.length));

      console.log(`\n>>> [CATEGORY] Commencing ingest for: ${cat} (Target: ${maxPerCategory} items) <<<`);

      for (const query of queries) {
        if (approvedForCategory >= maxPerCategory) break;

        const needed = maxPerCategory - approvedForCategory;
        const queryLimit = Math.min(needed, targetPerQuery);

        await sleep(800); // Polite backoff
        const candidates = await scrapeSearchQuery(query, cat, queryLimit);

        for (const cand of candidates) {
          if (approvedForCategory >= maxPerCategory) break;
          totalScraped++;

          if (cand.approved) {
            approvedCount++;
            approvedForCategory++;
            upsertItem({
              asin: cand.asin,
              title: cand.title,
              artisan_name: cand.artisan_name,
              category: cand.category,
              description: cand.description,
              image_url: cand.image_url,
              price_approx: cand.price_approx,
              affiliate_url: formatAffiliateUrl(cand.asin),
              is_active: 1,
              last_checked_date: now,
            });
            console.log(`[APPROVED & UPLOADED] [${cat}] (${approvedForCategory}/${maxPerCategory}) ${cand.asin}: ${cand.title.slice(0, 60)}...`);
          } else {
            rejectedCount++;
            console.log(`[REJECTED FILTER] [${cat}] ${cand.asin}: ${cand.title.slice(0, 60)}... (${cand.reject_reason})`);
          }
          processedItems.push(cand);
        }
      }
    }
  }

  const logMessage = `Scraper run finished: ${totalScraped} items inspected. Uploaded ${approvedCount} verified artisan goods, filtered ${rejectedCount} non-handmade/mass-produced items.`;
  logSystemEvent('catalog_scraper', 'success', logMessage);
  console.log(`=== ${logMessage} ===`);

  return {
    totalScraped,
    approved: approvedCount,
    rejected: rejectedCount,
    items: processedItems,
  };
}
