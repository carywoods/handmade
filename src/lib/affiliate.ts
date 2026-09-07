/**
 * Affiliate & Compliance helpers for itsmadebyhand.com
 */

export function getAmazonTag(): string {
  // Use environment variable with safe fallback across Vite and Node
  // @ts-ignore
  return (typeof import.meta !== 'undefined' && import.meta.env?.AMAZON_TAG) || process.env.AMAZON_TAG || 'itsmadebyha0a-20';
}

/**
 * Returns formatted Amazon direct product link with tracking tag
 */
export function formatAffiliateUrl(asin: string): string {
  const cleanAsin = asin.trim().toUpperCase();
  const tag = getAmazonTag();
  return `https://www.amazon.com/dp/${cleanAsin}?tag=${encodeURIComponent(tag)}`;
}

/**
 * Generates local click tracking redirect URL
 */
export function formatTrackedClickUrl(asin: string): string {
  return `/api/click?asin=${encodeURIComponent(asin)}`;
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
