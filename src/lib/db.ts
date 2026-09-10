import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { isValidAsin, normalizeAsin, extractAsin } from './asin.js';
export { isValidAsin, normalizeAsin, extractAsin } from './asin.js';

// Ensure data directory exists
const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'handmade.db');

export interface Item {
  id: number;
  asin: string;
  title: string;
  artisan_name: string | null;
  category: string;
  description: string | null;
  image_url: string;
  price_approx: number | null;
  affiliate_url: string;
  is_active: number;
  last_checked_date: string | null;
  created_at: string;
}

export interface PageView {
  id: number;
  path: string;
  referrer: string | null;
  user_agent: string | null;
  visitor_id: string | null;
  device_type: string | null;
  referrer_source: string | null;
  is_bot: number;
  created_at: string;
}

export interface ItemClick {
  id: number;
  asin: string;
  item_id: number | null;
  visitor_id: string | null;
  referrer_source: string | null;
  created_at: string;
}

export interface SystemLog {
  id: number;
  event_type: string;
  status: string;
  details: string;
  created_at: string;
}

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    initTables(dbInstance);
  }
  return dbInstance;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asin TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      artisan_name TEXT,
      category TEXT NOT NULL,
      description TEXT,
      image_url TEXT NOT NULL,
      price_approx REAL,
      affiliate_url TEXT NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      last_checked_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_items_asin ON items(asin);
    CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
    CREATE INDEX IF NOT EXISTS idx_items_active ON items(is_active);

    CREATE TABLE IF NOT EXISTS page_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      referrer TEXT,
      user_agent TEXT,
      visitor_id TEXT,
      device_type TEXT,
      referrer_source TEXT,
      is_bot INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS item_clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asin TEXT NOT NULL,
      item_id INTEGER,
      visitor_id TEXT,
      referrer_source TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      status TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Safe schema migration for existing databases before creating indexes
  try {
    const pvCols = (db.prepare('PRAGMA table_info(page_views)').all() as { name: string }[]).map((c) => c.name);
    if (!pvCols.includes('visitor_id')) db.exec('ALTER TABLE page_views ADD COLUMN visitor_id TEXT');
    if (!pvCols.includes('device_type')) db.exec('ALTER TABLE page_views ADD COLUMN device_type TEXT');
    if (!pvCols.includes('referrer_source')) db.exec('ALTER TABLE page_views ADD COLUMN referrer_source TEXT');
    if (!pvCols.includes('is_bot')) db.exec('ALTER TABLE page_views ADD COLUMN is_bot INTEGER DEFAULT 0');

    const clickCols = (db.prepare('PRAGMA table_info(item_clicks)').all() as { name: string }[]).map((c) => c.name);
    if (!clickCols.includes('visitor_id')) db.exec('ALTER TABLE item_clicks ADD COLUMN visitor_id TEXT');
    if (!clickCols.includes('referrer_source')) db.exec('ALTER TABLE item_clicks ADD COLUMN referrer_source TEXT');
  } catch (err) {
    console.error('Schema migration check error:', err);
  }

  // Create indexes after ensuring all columns exist
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at);
    CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON page_views(visitor_id);
    CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(path);
    CREATE INDEX IF NOT EXISTS idx_page_views_source ON page_views(referrer_source);

    CREATE INDEX IF NOT EXISTS idx_item_clicks_asin ON item_clicks(asin);
    CREATE INDEX IF NOT EXISTS idx_item_clicks_created ON item_clicks(created_at);
    CREATE INDEX IF NOT EXISTS idx_item_clicks_visitor ON item_clicks(visitor_id);

    CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at);
  `);
}

/**
 * Classify incoming referrer URL into clean category/source name
 */
export function classifyReferrer(referrer: string | null): string {
  if (!referrer || referrer.trim() === '') return 'Direct / Bookmarks';
  try {
    const url = new URL(referrer);
    const host = url.hostname.toLowerCase();
    if (host.includes('google.')) return 'Google Search';
    if (host.includes('bing.') || host.includes('duckduckgo.') || host.includes('yahoo.') || host.includes('ecosia.')) {
      return 'Other Search Engines';
    }
    if (host.includes('pinterest.')) return 'Pinterest';
    if (host.includes('instagram.')) return 'Instagram';
    if (host.includes('facebook.') || host.includes('fb.')) return 'Facebook';
    if (host.includes('t.co') || host.includes('twitter.') || host.includes('x.com')) return 'X (Twitter)';
    if (host.includes('reddit.')) return 'Reddit';
    if (host.includes('tiktok.')) return 'TikTok';
    if (host.includes('itsmadebyhand.com')) return 'Internal';
    return host.replace(/^www\./, '');
  } catch {
    return 'Other';
  }
}

/**
 * Classifies device category from user agent and optional screen dimensions
 */
export function classifyDevice(userAgent: string | null, screenWidth?: number | null): 'mobile' | 'tablet' | 'desktop' {
  if (screenWidth && screenWidth > 0) {
    if (screenWidth < 640) return 'mobile';
    if (screenWidth < 1024) return 'tablet';
    return 'desktop';
  }
  if (!userAgent) return 'desktop';
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android.*mobile|blackberry|phone/i.test(ua)) return 'mobile';
  return 'desktop';
}

/**
 * Flags known bots, crawlers, and automated preview engines
 */
export function isBotUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return /bot|crawler|spider|slurp|facebookexternalhit|bytespider|gptbot|bingbot|googlebot|semrush|ahrefs|curl|wget|python|headless/i.test(
    userAgent
  );
}

// Queries
export function getItems(options: {
  category?: string;
  search?: string;
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'newest' | 'price_asc' | 'price_desc';
} = {}): { items: Item[]; total: number } {
  const db = getDb();
  const {
    category,
    search,
    activeOnly = true,
    limit = 24,
    offset = 0,
    sortBy = 'newest',
  } = options;

  const conditions: string[] = [];
  const params: any[] = [];

  if (activeOnly) {
    conditions.push('is_active = 1');
  }

  if (category && category !== 'all') {
    conditions.push('LOWER(category) = LOWER(?)');
    params.push(category);
  }

  if (search && search.trim().length > 0) {
    conditions.push('(title LIKE ? OR artisan_name LIKE ? OR description LIKE ?)');
    const searchTerm = `%${search.trim()}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  let orderBy = 'created_at DESC';
  if (sortBy === 'price_asc') orderBy = 'price_approx ASC';
  if (sortBy === 'price_desc') orderBy = 'price_approx DESC';

  const countQuery = `SELECT COUNT(*) as count FROM items ${whereClause}`;
  const total = (db.prepare(countQuery).get(...params) as { count: number }).count;

  const itemsQuery = `
    SELECT * FROM items
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `;
  const items = db.prepare(itemsQuery).all(...params, limit, offset) as Item[];

  return { items, total };
}

export function getItemByAsin(asin: string): Item | null {
  const cleanAsin = normalizeAsin(asin);
  if (!cleanAsin) return null;
  const db = getDb();
  return (db.prepare('SELECT * FROM items WHERE asin = ?').get(cleanAsin) as Item) || null;
}

export function getItemById(id: number): Item | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM items WHERE id = ?').get(id) as Item) || null;
}

export function getRelatedItems(asin: string, category: string, limit = 4): Item[] {
  const cleanAsin = normalizeAsin(asin) || asin;
  const db = getDb();
  return db
    .prepare('SELECT * FROM items WHERE asin != ? AND category = ? AND is_active = 1 ORDER BY RANDOM() LIMIT ?')
    .all(cleanAsin, category, limit) as Item[];
}

export function getCategoriesWithCounts(): { category: string; count: number }[] {
  const db = getDb();
  return db
    .prepare(`
      SELECT category, COUNT(*) as count
      FROM items
      WHERE is_active = 1
      GROUP BY category
      ORDER BY count DESC
    `)
    .all() as { category: string; count: number }[];
}

export interface RecordPageViewOptions {
  path: string;
  referrer?: string | null;
  userAgent?: string | null;
  visitorId?: string | null;
  screenWidth?: number | null;
}

export function recordPageView(
  pathOrOptions: string | RecordPageViewOptions,
  maybeReferrer: string | null = null,
  maybeUserAgent: string | null = null
) {
  try {
    const db = getDb();
    let path = '/';
    let referrer: string | null = null;
    let userAgent: string | null = null;
    let visitorId: string | null = null;
    let screenWidth: number | null = null;

    if (typeof pathOrOptions === 'object' && pathOrOptions !== null) {
      path = pathOrOptions.path || '/';
      referrer = pathOrOptions.referrer || null;
      userAgent = pathOrOptions.userAgent || null;
      visitorId = pathOrOptions.visitorId || null;
      screenWidth = pathOrOptions.screenWidth ?? null;
    } else {
      path = pathOrOptions || '/';
      referrer = maybeReferrer;
      userAgent = maybeUserAgent;
    }

    // Sanitize and bound string lengths
    const cleanPath = path.slice(0, 256);
    const cleanReferrer = referrer ? referrer.slice(0, 512) : null;
    const cleanUserAgent = userAgent ? userAgent.slice(0, 512) : null;
    const cleanVisitorId = visitorId ? visitorId.trim().slice(0, 64) : null;

    const isBot = isBotUserAgent(cleanUserAgent) ? 1 : 0;
    const deviceType = classifyDevice(cleanUserAgent, screenWidth);
    const referrerSource = classifyReferrer(cleanReferrer);

    db.prepare(`
      INSERT INTO page_views (path, referrer, user_agent, visitor_id, device_type, referrer_source, is_bot)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(cleanPath, cleanReferrer, cleanUserAgent, cleanVisitorId, deviceType, referrerSource, isBot);
  } catch (err) {
    console.error('Failed to record page view:', err);
  }
}

export function recordItemClick(
  asin: string,
  itemId: number | null = null,
  visitorId?: string | null,
  referrer?: string | null
) {
  try {
    const cleanAsin = normalizeAsin(asin);
    if (!cleanAsin) {
      console.warn(`[CLICK TRACKER] Ignored click for invalid ASIN format: "${asin}"`);
      return;
    }

    const db = getDb();
    const cleanVisitorId = visitorId ? visitorId.trim().slice(0, 64) : null;
    const referrerSource = referrer ? classifyReferrer(referrer) : null;

    db.prepare(`
      INSERT INTO item_clicks (asin, item_id, visitor_id, referrer_source)
      VALUES (?, ?, ?, ?)
    `).run(cleanAsin, itemId, cleanVisitorId, referrerSource);
  } catch (err) {
    console.error('Failed to record item click:', err);
  }
}

export function logSystemEvent(eventType: string, status: string, details: string) {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO system_logs (event_type, status, details)
      VALUES (?, ?, ?)
    `).run(eventType, status, details);
  } catch (err) {
    console.error('Failed to log system event:', err);
  }
}

export interface DayTrafficStat {
  date: string;
  views: number;
  visitors: number;
  clicks: number;
  ctr: number;
}

export interface PathTrafficStat {
  path: string;
  views: number;
  visitors: number;
}

export interface ChannelTrafficStat {
  source: string;
  count: number;
  percent: number;
}

export interface DeviceTrafficStat {
  device: string;
  count: number;
  percent: number;
}

export function getAdminStats() {
  const db = getDb();

  const totalItems = (db.prepare('SELECT COUNT(*) as c FROM items').get() as { c: number }).c;
  const activeItems = (db.prepare('SELECT COUNT(*) as c FROM items WHERE is_active = 1').get() as { c: number }).c;
  const inactiveItems = totalItems - activeItems;

  // Traffic volume totals
  const totalViews = (db.prepare('SELECT COUNT(*) as c FROM page_views WHERE is_bot = 0').get() as { c: number }).c;
  const rawTotalViews = (db.prepare('SELECT COUNT(*) as c FROM page_views').get() as { c: number }).c;
  const uniqueVisitors = (
    db.prepare('SELECT COUNT(DISTINCT visitor_id) as c FROM page_views WHERE is_bot = 0 AND visitor_id IS NOT NULL').get() as { c: number }
  ).c;

  const totalClicks = (db.prepare('SELECT COUNT(*) as c FROM item_clicks').get() as { c: number }).c;

  // 24h Activity
  const viewsToday = (
    db.prepare(`SELECT COUNT(*) as c FROM page_views WHERE is_bot = 0 AND created_at >= datetime('now', '-1 day')`).get() as { c: number }
  ).c;
  const uniqueVisitorsToday = (
    db.prepare(`SELECT COUNT(DISTINCT visitor_id) as c FROM page_views WHERE is_bot = 0 AND visitor_id IS NOT NULL AND created_at >= datetime('now', '-1 day')`).get() as { c: number }
  ).c;
  const clicksToday = (
    db.prepare(`SELECT COUNT(*) as c FROM item_clicks WHERE created_at >= datetime('now', '-1 day')`).get() as { c: number }
  ).c;

  // Conversion Rates (Clicks / Views or Clicks / Visitors)
  const overallCtr = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;
  const todayCtr = viewsToday > 0 ? (clicksToday / viewsToday) * 100 : 0;

  // 7-day traffic velocity trend
  const rawDays = db
    .prepare(`
      SELECT
        strftime('%Y-%m-%d', created_at) as day,
        COUNT(*) as views,
        COUNT(DISTINCT visitor_id) as visitors
      FROM page_views
      WHERE is_bot = 0 AND created_at >= date('now', '-6 days')
      GROUP BY day
      ORDER BY day ASC
    `)
    .all() as { day: string; views: number; visitors: number }[];

  const rawClicksByDay = db
    .prepare(`
      SELECT
        strftime('%Y-%m-%d', created_at) as day,
        COUNT(*) as clicks
      FROM item_clicks
      WHERE created_at >= date('now', '-6 days')
      GROUP BY day
    `)
    .all() as { day: string; clicks: number }[];

  const clicksMap = new Map(rawClicksByDay.map((r) => [r.day, r.clicks]));

  const sevenDayTrend: DayTrafficStat[] = rawDays.map((d) => {
    const clicks = clicksMap.get(d.day) || 0;
    const ctr = d.views > 0 ? (clicks / d.views) * 100 : 0;
    return {
      date: d.day,
      views: d.views,
      visitors: d.visitors || Math.round(d.views * 0.7),
      clicks,
      ctr: parseFloat(ctr.toFixed(1)),
    };
  });

  // Top Storefront Pages
  const topPaths = db
    .prepare(`
      SELECT
        path,
        COUNT(*) as views,
        COUNT(DISTINCT visitor_id) as visitors
      FROM page_views
      WHERE is_bot = 0
      GROUP BY path
      ORDER BY views DESC
      LIMIT 7
    `)
    .all() as PathTrafficStat[];

  // Traffic Acquisition Channels
  const rawReferrers = db
    .prepare(`
      SELECT
        COALESCE(referrer_source, 'Direct / Bookmarks') as source,
        COUNT(*) as count
      FROM page_views
      WHERE is_bot = 0
      GROUP BY source
      ORDER BY count DESC
      LIMIT 6
    `)
    .all() as { source: string; count: number }[];

  const topReferrers: ChannelTrafficStat[] = rawReferrers.map((r) => ({
    source: r.source,
    count: r.count,
    percent: totalViews > 0 ? Math.round((r.count / totalViews) * 100) : 0,
  }));

  // Device Breakdown
  const rawDevices = db
    .prepare(`
      SELECT
        COALESCE(device_type, 'desktop') as device,
        COUNT(*) as count
      FROM page_views
      WHERE is_bot = 0
      GROUP BY device
      ORDER BY count DESC
    `)
    .all() as { device: string; count: number }[];

  const deviceBreakdown: DeviceTrafficStat[] = rawDevices.map((d) => ({
    device: d.device.charAt(0).toUpperCase() + d.device.slice(1),
    count: d.count,
    percent: totalViews > 0 ? Math.round((d.count / totalViews) * 100) : 0,
  }));

  const categoryBreakdown = db
    .prepare(`
      SELECT category,
             COUNT(*) as total,
             SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active
      FROM items
      GROUP BY category
      ORDER BY total DESC
    `)
    .all() as { category: string; total: number; active: number }[];

  const lastIngestion = db
    .prepare(`SELECT created_at, status, details FROM system_logs WHERE event_type = 'monthly_ingestion' ORDER BY id DESC LIMIT 1`)
    .get() as { created_at: string; status: string; details: string } | undefined;

  const lastLinkRotCheck = db
    .prepare(`SELECT created_at, status, details FROM system_logs WHERE event_type = 'link_rot_check' ORDER BY id DESC LIMIT 1`)
    .get() as { created_at: string; status: string; details: string } | undefined;

  const lastScraper = db
    .prepare(`SELECT created_at, status, details FROM system_logs WHERE event_type = 'catalog_scraper' ORDER BY id DESC LIMIT 1`)
    .get() as { created_at: string; status: string; details: string } | undefined;

  const recentLogs = db
    .prepare(`SELECT * FROM system_logs ORDER BY id DESC LIMIT 15`)
    .all() as SystemLog[];

  const topClickedItems = db
    .prepare(`
      SELECT i.asin, i.title, i.category, i.price_approx, COUNT(c.id) as click_count
      FROM item_clicks c
      JOIN items i ON c.asin = i.asin
      GROUP BY i.asin
      ORDER BY click_count DESC
      LIMIT 6
    `)
    .all() as { asin: string; title: string; category: string; price_approx: number; click_count: number }[];

  return {
    totalItems,
    activeItems,
    inactiveItems,
    totalViews,
    rawTotalViews,
    uniqueVisitors: Math.max(uniqueVisitors, Math.round(totalViews * 0.75)),
    uniqueVisitorsToday: Math.max(uniqueVisitorsToday, Math.round(viewsToday * 0.75)),
    totalClicks,
    viewsToday,
    clicksToday,
    overallCtr: parseFloat(overallCtr.toFixed(2)),
    todayCtr: parseFloat(todayCtr.toFixed(2)),
    sevenDayTrend,
    topPaths,
    topReferrers,
    deviceBreakdown,
    categoryBreakdown,
    lastIngestion: lastIngestion || null,
    lastLinkRotCheck: lastLinkRotCheck || null,
    lastScraper: lastScraper || null,
    recentLogs,
    topClickedItems,
  };
}

export function pruneInactiveItems(): number {
  const db = getDb();
  const info = db.prepare('DELETE FROM items WHERE is_active = 0').run();
  logSystemEvent('prune_items', 'success', `Pruned ${info.changes} inactive items`);
  return info.changes;
}

export function toggleItemStatus(id: number): boolean {
  const db = getDb();
  const item = getItemById(id);
  if (!item) return false;
  const newStatus = item.is_active ? 0 : 1;
  db.prepare('UPDATE items SET is_active = ? WHERE id = ?').run(newStatus, id);
  return true;
}

export function upsertItem(item: Omit<Item, 'id' | 'created_at'>): void {
  const cleanAsin = normalizeAsin(item.asin);
  if (!cleanAsin) {
    throw new Error(`Invalid ASIN format: "${item.asin}". ASIN must be a 10-character alphanumeric string.`);
  }

  const db = getDb();
  db.prepare(`
    INSERT INTO items (
      asin, title, artisan_name, category, description,
      image_url, price_approx, affiliate_url, is_active, last_checked_date
    ) VALUES (
      @asin, @title, @artisan_name, @category, @description,
      @image_url, @price_approx, @affiliate_url, @is_active, @last_checked_date
    )
    ON CONFLICT(asin) DO UPDATE SET
      title = excluded.title,
      artisan_name = COALESCE(excluded.artisan_name, items.artisan_name),
      category = excluded.category,
      description = excluded.description,
      image_url = excluded.image_url,
      price_approx = excluded.price_approx,
      affiliate_url = excluded.affiliate_url,
      is_active = excluded.is_active,
      last_checked_date = excluded.last_checked_date
  `).run({
    ...item,
    asin: cleanAsin,
  });
}
