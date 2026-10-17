const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@libsql/client');
const config = require('./config');

if (config.databaseUrl.startsWith('file:')) fs.mkdirSync(path.dirname(config.localDbFile), { recursive: true });

const client = createClient({ url: config.databaseUrl, authToken: config.databaseAuthToken });

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    category    TEXT    NOT NULL,
    summary     TEXT    NOT NULL DEFAULT '',
    description TEXT    NOT NULL DEFAULT '',
    price       INTEGER,               -- naira; NULL means "ask for price"
    image       TEXT    NOT NULL DEFAULT '',
    in_stock    INTEGER NOT NULL DEFAULT 1,
    is_new      INTEGER NOT NULL DEFAULT 0,
    featured    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,
  'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)',
  `CREATE TABLE IF NOT EXISTS orders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    reference       TEXT    NOT NULL UNIQUE,
    customer_name   TEXT    NOT NULL,
    phone           TEXT    NOT NULL,
    email           TEXT    NOT NULL DEFAULT '',
    address         TEXT    NOT NULL DEFAULT '',
    delivery_method TEXT    NOT NULL DEFAULT 'delivery',
    note            TEXT    NOT NULL DEFAULT '',
    total           INTEGER NOT NULL DEFAULT 0,
    has_unpriced    INTEGER NOT NULL DEFAULT 0,
    status          TEXT    NOT NULL DEFAULT 'pending',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER,
    name       TEXT    NOT NULL,
    price      INTEGER,
    quantity   INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    phone      TEXT NOT NULL DEFAULT '',
    email      TEXT NOT NULL DEFAULT '',
    subject    TEXT NOT NULL DEFAULT '',
    message    TEXT NOT NULL,
    is_read    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS subscribers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
];

// libsql rows are array-like objects; convert to plain objects.
const plain = (row) => (row ? { ...row } : undefined);

const db = {
  async all(sql, args = []) {
    return (await client.execute({ sql, args })).rows.map(plain);
  },
  async get(sql, args = []) {
    return plain((await client.execute({ sql, args })).rows[0]);
  },
  async run(sql, args = []) {
    const r = await client.execute({ sql, args });
    return { changes: r.rowsAffected, lastInsertRowid: r.lastInsertRowid == null ? null : Number(r.lastInsertRowid) };
  },
  // Runs statements atomically: all succeed or none do.
  async batch(statements) {
    return client.batch(statements.map(([sql, args = []]) => ({ sql, args })), 'write');
  },
};

async function seedProducts({ reset = false } = {}) {
  const { count } = await db.get('SELECT COUNT(*) AS count FROM products');
  if (count > 0 && !reset) return 0;

  const items = require('./data/seed-products.json');
  const insertSql = `INSERT INTO products (name, category, summary, description, image, is_new, featured)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`;
  await db.batch([
    ...(reset ? [['DELETE FROM products']] : []),
    ...items.map((p) => [insertSql, [p.name, p.category, p.summary, p.description, p.image, p.isNew ? 1 : 0, p.featured ? 1 : 0]]),
  ]);
  return items.length;
}

// Creates tables and seeds the catalog once per process (each Vercel cold start).
let readyPromise;
function ready() {
  readyPromise ??= (async () => {
    await client.batch(SCHEMA, 'write');
    const seeded = await seedProducts();
    if (seeded) console.log(`[db] Seeded ${seeded} products from the original catalog.`);
  })().catch((err) => {
    readyPromise = undefined; // retry on the next request
    throw err;
  });
  return readyPromise;
}

module.exports = { db, ready, seedProducts };
