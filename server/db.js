const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { dbFile } = require('./config');

fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const db = new DatabaseSync(dbFile);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS products (
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
  );
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

  CREATE TABLE IF NOT EXISTS orders (
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
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER,
    name       TEXT    NOT NULL,
    price      INTEGER,
    quantity   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    phone      TEXT NOT NULL DEFAULT '',
    email      TEXT NOT NULL DEFAULT '',
    subject    TEXT NOT NULL DEFAULT '',
    message    TEXT NOT NULL,
    is_read    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS subscribers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Runs fn inside a transaction, rolling back if it throws.
function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function seedProducts({ reset = false } = {}) {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM products').get();
  if (count > 0 && !reset) return 0;

  const items = require('./data/seed-products.json');
  const insert = db.prepare(`
    INSERT INTO products (name, category, summary, description, image, is_new, featured)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  transaction(() => {
    if (reset) db.exec('DELETE FROM products');
    for (const p of items) {
      insert.run(p.name, p.category, p.summary, p.description, p.image, p.isNew ? 1 : 0, p.featured ? 1 : 0);
    }
  });
  return items.length;
}

module.exports = { db, transaction, seedProducts };
