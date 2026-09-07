import 'dotenv/config';
import { getDb, logSystemEvent } from '../src/lib/db.js';

interface ItemToCheck {
  id: number;
  asin: string;
  title: string;
  affiliate_url: string;
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function checkItemStatus(item: ItemToCheck): Promise<{ active: boolean; reason: string }> {
  // Direct Amazon product URL
  const targetUrl = `https://www.amazon.com/dp/${item.asin}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 404 indicates product was purged or ASIN invalid
    if (res.status === 404) {
      return { active: false, reason: `HTTP 404 (ASIN Removed: ${item.asin})` };
    }

    // Amazon bot challenge or server transient issues (503 / 429) -> don't prematurely deactivate without certainty
    if (res.status === 503 || res.status === 429) {
      return { active: true, reason: `Temporary rate limit/challenge (${res.status}); preserved` };
    }

    // Inspect HTML content for dead link markers
    const bodySnippet = (await res.text()).slice(0, 15000);
    if (
      bodySnippet.includes("Looking for something? We're sorry. The Web address you entered is not a functioning page") ||
      bodySnippet.includes("The page you're looking for doesn't exist") ||
      bodySnippet.includes("dogsofamazon")
    ) {
      return { active: false, reason: 'Amazon 404 / Dead Product page detected' };
    }

    return { active: true, reason: 'Active and verified reachable' };
  } catch (err: any) {
    // Timeout or network glitch shouldn't wipe active status
    return { active: true, reason: `Network check exception (${err?.name || 'unknown'}); preserved` };
  }
}

export async function runLinkRotChecker() {
  console.log('--- Starting Weekly Link-Rot & Availability Scan ---');
  const db = getDb();
  const items = db.prepare('SELECT id, asin, title, affiliate_url FROM items WHERE is_active = 1').all() as ItemToCheck[];

  console.log(`Found ${items.length} active items to verify.`);
  const now = new Date().toISOString();

  let okCount = 0;
  let deadCount = 0;

  const updateStatus = db.prepare('UPDATE items SET is_active = ?, last_checked_date = ? WHERE id = ?');

  for (const item of items) {
    // Rate limit delay between checks to respect servers
    await sleep(250);

    const result = await checkItemStatus(item);

    if (!result.active) {
      deadCount++;
      updateStatus.run(0, now, item.id);
      console.warn(`[DEACTIVATED] ${item.asin} ("${item.title}") -> ${result.reason}`);
    } else {
      okCount++;
      updateStatus.run(1, now, item.id);
      console.log(`[OK] ${item.asin} -> ${result.reason}`);
    }
  }

  const summary = `Link-rot check completed. Verified ${okCount} active items; deactivated ${deadCount} dead/removed items.`;
  logSystemEvent('link_rot_check', deadCount > 0 ? 'warning' : 'success', summary);
  console.log(`--- ${summary} ---`);
}

// Run only when invoked directly from CLI
if (process.argv[1] && process.argv[1].includes('check-rot.ts')) {
  runLinkRotChecker().catch((err) => {
    console.error('Link rot worker error:', err);
    logSystemEvent('link_rot_check', 'error', String(err));
    process.exit(1);
  });
}
