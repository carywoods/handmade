/**
 * Affiliate & Compliance helpers for itsmadebyhand.com
 */

export function getAmazonTag(): string {
  return process.env.AMAZON_TAG || 'itsmadebyha0a-20';
}

// Fail loudly at boot when running without a configured tag, instead of silently
// serving the fallback (silence here = $0 attributed commissions).
if (process.env.NODE_ENV === 'production' && !process.env.AMAZON_TAG) {
  console.warn(
    '[affiliate] AMAZON_TAG is NOT set in production. Clicks will use the fallback tag. ' +
    'Verify it matches your registered Amazon Associates tracking ID or set AMAZON_TAG.'
  );
}

import { isValidAsin, normalizeAsin, extractAsin } from './asin.js';
export { isValidAsin, normalizeAsin, extractAsin } from './asin.js';

/**
 * Returns formatted Amazon direct product link with tracking tag.
 * Validates ASIN format before formatting.
 */
export function formatAffiliateUrl(asin: string): string {
  const cleanAsin = normalizeAsin(asin);
  if (!cleanAsin) {
    throw new Error(`Invalid Amazon ASIN: "${asin}". Must be a 10-character alphanumeric string.`);
  }
  const tag = getAmazonTag();
  return `https://www.amazon.com/dp/${cleanAsin}?tag=${encodeURIComponent(tag)}`;
}

/**
 * Generates local click tracking redirect URL.
 * Validates ASIN format before formatting.
 */
export function formatTrackedClickUrl(asin: string): string {
  const cleanAsin = normalizeAsin(asin);
  if (!cleanAsin) {
    return '#';
  }
  return `/api/click?asin=${encodeURIComponent(cleanAsin)}`;
}

/**
 * Standard compliance disclosure texts required by Amazon Operating Agreement
 */
export const COMPLIANCE = {
  shortDisclosure: 'As an Amazon Associate, itsmadebyhand.com earns from qualifying purchases.',
  fullDisclosure:
    'itsmadebyhand.com is an independent curation platform dedicated to authentic craftsmanship. As an Amazon Associate, we earn from qualifying purchases at no additional cost to you. Every product featured is crafted by genuine artisans and fulfilled directly through Amazon Handmade.',
  fulfillmentNotice: 'Fulfilled safely & securely by Amazon. Crafted by independent artisans.',
};
