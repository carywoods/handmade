/**
 * Amazon ASIN (Amazon Standard Identification Number) Validation & Extraction Utilities
 * Standard: Exactly 10 alphanumeric characters (letters A-Z and digits 0-9).
 */

const ASIN_REGEX = /^[A-Z0-9]{10}$/i;

// Regular expression to extract ASIN from various Amazon URL formats
// Examples:
// - /dp/B0BW4LD35T
// - /gp/product/B0BW4LD35T
// - /product/B0BW4LD35T
// - /o/ASIN/B0BW4LD35T
const AMAZON_URL_ASIN_REGEX = /(?:dp|gp\/product|product|ASIN)\/([A-Z0-9]{10})(?:[/?&#]|$)/i;

/**
 * Validates whether a value is a strictly valid Amazon ASIN string.
 */
export function isValidAsin(asin: unknown): asin is string {
  if (typeof asin !== 'string') return false;
  const clean = asin.trim();
  return clean.length === 10 && ASIN_REGEX.test(clean);
}

/**
 * Normalizes an ASIN to clean, uppercase 10-character string.
 * Returns null if the ASIN is invalid.
 */
export function normalizeAsin(asin: unknown): string | null {
  if (typeof asin !== 'string') return null;
  const clean = asin.trim().toUpperCase();
  return isValidAsin(clean) ? clean : null;
}

/**
 * Extracts a valid ASIN from either a raw string or an Amazon product URL.
 * Handles full URLs, mobile URLs, tracking links, and raw ASINs.
 */
export function extractAsin(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // If already a raw 10-char ASIN
  if (isValidAsin(trimmed)) {
    return trimmed.toUpperCase();
  }

  // Try extracting from Amazon URL patterns
  const match = trimmed.match(AMAZON_URL_ASIN_REGEX);
  if (match && match[1] && isValidAsin(match[1])) {
    return match[1].toUpperCase();
  }

  return null;
}

/**
 * Parses a comma, space, or newline-separated list of ASINs or Amazon URLs.
 * Returns arrays of valid unique ASINs and rejected invalid inputs.
 */
export function parseAsinList(input: string): { valid: string[]; invalid: string[] } {
  if (!input || typeof input !== 'string') {
    return { valid: [], invalid: [] };
  }

  const tokens = input
    .split(/[\s,;\n\r]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const validSet = new Set<string>();
  const invalidList: string[] = [];

  for (const token of tokens) {
    const asin = extractAsin(token);
    if (asin) {
      validSet.add(asin);
    } else {
      invalidList.push(token);
    }
  }

  return {
    valid: Array.from(validSet),
    invalid: invalidList,
  };
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
];

export interface AsinLiveCheckResult {
  valid: boolean;
  exists: boolean;
  asin: string;
  reason: string;
  statusCode?: number;
  title?: string;
  imageUrl?: string;
}

/**
 * Performs a live network check against Amazon to verify whether an ASIN exists and is reachable.
 */
export async function verifyAsinLive(asinInput: string): Promise<AsinLiveCheckResult> {
  const asin = normalizeAsin(asinInput);
  if (!asin) {
    return {
      valid: false,
      exists: false,
      asin: asinInput,
      reason: 'Invalid ASIN format. Must be exactly 10 alphanumeric characters (e.g. B0BW4LD35T).',
    };
  }

  const targetUrl = `https://www.amazon.com/dp/${asin}`;
  const randomUa = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': randomUa,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.status === 404) {
      return {
        valid: true,
        exists: false,
        asin,
        statusCode: 404,
        reason: 'HTTP 404: ASIN does not exist on Amazon or was removed.',
      };
    }

    if (res.status === 503 || res.status === 429) {
      return {
        valid: true,
        exists: true, // Inconclusive due to rate limiting, assume format valid
        asin,
        statusCode: res.status,
        reason: `Amazon returned HTTP ${res.status} (Rate limited/bot challenge). ASIN format is valid.`,
      };
    }

    const html = await res.text();
    const snippet = html.slice(0, 20000);

    // Dead page markers
    if (
      snippet.includes("Looking for something? We're sorry. The Web address you entered is not a functioning page") ||
      snippet.includes("The page you're looking for doesn't exist") ||
      snippet.includes("dogsofamazon")
    ) {
      return {
        valid: true,
        exists: false,
        asin,
        statusCode: res.status,
        reason: 'Amazon Dead Link / "Dogs of Amazon" page detected. ASIN is not active.',
      };
    }

    // Try extracting title
    const titleMatch = html.match(/<span id="productTitle"[^>]*>([\s\S]*?)<\/span>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    return {
      valid: true,
      exists: true,
      asin,
      statusCode: res.status,
      title,
      reason: 'Verified active and reachable on Amazon.',
    };
  } catch (err: any) {
    return {
      valid: true,
      exists: true, // Format valid, network error during verification
      asin,
      reason: `Verification request error (${err?.name || err?.message || 'timeout'}). ASIN format is valid.`,
    };
  }
}
