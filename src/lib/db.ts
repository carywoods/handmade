import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

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
  created_at: string;
}

export interface ItemClick {
  id: number;
  asin: string;
  item_id: number | null;
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at);

    CREATE TABLE IF NOT EXISTS item_clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asin TEXT NOT NULL,
      item_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_item_clicks_asin ON item_clicks(asin);
    CREATE INDEX IF NOT EXISTS idx_item_clicks_created ON item_clicks(created_at);

    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      status TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at);
  `);
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
    sortBy = 'newest'
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
  const db = getDb();
  return (db.prepare('SELECT * FROM items WHERE asin = ?').get(asin) as Item) || null;
}

export function getItemById(id: number): Item | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM items WHERE id = ?').get(id) as Item) || null;
}

export function getRelatedItems(asin: string, category: string, limit = 4): Item[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM items WHERE asin != ? AND category = ? AND is_active = 1 ORDER BY RANDOM() LIMIT ?')
    .all(asin, category, limit) as Item[];
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

export function recordPageView(path: string, referrer: string | null = null, userAgent: string | null = null) {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO page_views (path, referrer, user_agent)
      VALUES (?, ?, ?)
    `).run(path, referrer, userAgent);
  } catch (err) {
    console.error('Failed to record page view:', err);
  }
}

export function recordItemClick(asin: string, itemId: number | null = null) {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO item_clicks (asin, item_id)
      VALUES (?, ?)
    `).run(asin, itemId);
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

export function getAdminStats() {
  const db = getDb();

  const totalItems = (db.prepare('SELECT COUNT(*) as c FROM items').get() as { c: number }).c;
  const activeItems = (db.prepare('SELECT COUNT(*) as c FROM items WHERE is_active = 1').get() as { c: number }).c;
  const inactiveItems = totalItems - activeItems;

  const totalViews = (db.prepare('SELECT COUNT(*) as c FROM page_views').get() as { c: number }).c;
  const totalClicks = (db.prepare('SELECT COUNT(*) as c FROM item_clicks').get() as { c: number }).c;

  // Recent 24 hour activity
  const viewsToday = (
    db.prepare(`SELECT COUNT(*) as c FROM page_views WHERE created_at >= datetime('now', '-1 day')`).get() as { c: number }
  ).c;
  const clicksToday = (
    db.prepare(`SELECT COUNT(*) as c FROM item_clicks WHERE created_at >= datetime('now', '-1 day')`).get() as { c: number }
  ).c;

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
      LIMIT 5
    `)
    .all() as { asin: string; title: string; category: string; price_approx: number; click_count: number }[];

  return {
    totalItems,
    activeItems,
    inactiveItems,
    totalViews,
    totalClicks,
    viewsToday,
    clicksToday,
    categoryBreakdown,
    lastIngestion: lastIngestion || null,
    lastLinkRotCheck: lastLinkRotCheck || null,
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
  `).run(item);
}
