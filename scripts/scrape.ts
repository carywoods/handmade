import 'dotenv/config';
import { scrapeAndUploadCatalog, CATEGORY_SEARCH_QUERIES } from '../src/lib/scraper.js';

async function main() {
  const args = process.argv.slice(2);
  let customQuery: string | undefined;
  let customCategory: string | undefined;
  let customAsins: string[] | undefined;
  let maxPerCategory = 4;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--query' && args[i + 1]) {
      customQuery = args[i + 1];
      i++;
    } else if (args[i] === '--category' && args[i + 1]) {
      customCategory = args[i + 1];
      i++;
    } else if (args[i] === '--asin' && args[i + 1]) {
      customAsins = args[i + 1].split(',').map((s) => s.trim().toUpperCase());
      i++;
    } else if (args[i] === '--limit' && args[i + 1]) {
      maxPerCategory = parseInt(args[i + 1], 10) || 4;
      i++;
    }
  }

  console.log('---------------------------------------------------------');
  console.log('   itsmadebyhand.com — Amazon Handmade Scraper & Loader');
  console.log('---------------------------------------------------------');

  let categoriesToRun: string[] | undefined;
  if (customCategory) {
    const matched = Object.keys(CATEGORY_SEARCH_QUERIES).find(
      (c) => c.toLowerCase() === customCategory?.toLowerCase()
    );
    if (matched) {
      categoriesToRun = [matched];
    } else {
      console.warn(`Category "${customCategory}" not recognized. Available: ${Object.keys(CATEGORY_SEARCH_QUERIES).join(', ')}`);
      categoriesToRun = [customCategory];
    }
  }

  const result = await scrapeAndUploadCatalog({
    categories: categoriesToRun,
    customQuery,
    customAsins,
    maxPerCategory,
  });

  console.log('\n================ SCRAPE SUMMARY ================');
  console.log(`Total Inspected : ${result.totalScraped}`);
  console.log(`Uploaded to DB  : ${result.approved}`);
  console.log(`Screened Out    : ${result.rejected}`);
  console.log('================================================\n');
}

main().catch((err) => {
  console.error('Fatal scrape error:', err);
  process.exit(1);
});
