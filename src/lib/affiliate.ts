/**
 * Affiliate & Compliance helpers for itsmadebyhand.com
 */

export function getAmazonTag(): string {
  // Use environment variable with safe fallback across Vite and Node
  // @ts-ignore
  return (typeof import.meta !== 'undefined' && import.meta.env?.AMAZON_TAG) || process.env.AMAZON_TAG || 'itsmadebyha0a-20';
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
