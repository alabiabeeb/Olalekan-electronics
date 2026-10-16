const crypto = require('node:crypto');
const express = require('express');
const { db, transaction } = require('../db');
const { CATEGORIES, isCategory } = require('../catalog');
const { whatsappNumber } = require('../config');
const { rateLimit } = require('../auth');
const v = require('../validate');

const router = express.Router();
const formLimit = rateLimit({ windowMs: 60_000, max: 10 });

const toProduct = (row) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  summary: row.summary,
  description: row.description,
  price: row.price,
  image: row.image,
  inStock: !!row.in_stock,
  isNew: !!row.is_new,
  featured: !!row.featured,
});

router.get('/categories', (req, res) => {
  const counts = Object.fromEntries(
    db.prepare('SELECT category, COUNT(*) AS n FROM products GROUP BY category').all().map((r) => [r.category, r.n]),
  );
  res.json(CATEGORIES.map((c) => ({ ...c, count: counts[c.slug] || 0 })));
});

// GET /api/products?category=fans&q=tower&sort=price-asc&featured=1&new=1
router.get('/products', (req, res) => {
  const where = [];
  const params = [];
  const { category, q, sort } = req.query;

  if (category && category !== 'all') {
    if (!isCategory(category)) throw new v.HttpError(400, 'Unknown category.');
    where.push('category = ?');
    params.push(category);
  }
  if (q) {
    where.push('(name LIKE ? OR summary LIKE ? OR description LIKE ?)');
    const like = `%${v.text(q, 'Search', { max: 100 })}%`;
    params.push(like, like, like);
  }
  if (req.query.featured === '1') where.push('featured = 1');
  if (req.query.new === '1') where.push('is_new = 1');

  const orderBy = {
    'price-asc': 'price IS NULL, price ASC',
    'price-desc': 'price IS NULL, price DESC',
    name: 'name COLLATE NOCASE ASC',
    newest: 'created_at DESC, id DESC',
  }[sort] || 'is_new DESC, id ASC';

  const sql = `SELECT * FROM products ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${orderBy}`;
  res.json(db.prepare(sql).all(...params).map(toProduct));
});

router.get('/products/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(v.id(req.params.id));
  if (!row) throw new v.HttpError(404, 'Product not found.');
  res.json(toProduct(row));
});

router.post('/orders', formLimit, (req, res) => {
  const body = req.body || {};
  const customer = {
    name: v.text(body.name, 'Name', { required: true, max: 100 }),
    phone: v.phone(body.phone, 'Phone', { required: true }),
    email: v.email(body.email),
    deliveryMethod: body.deliveryMethod === 'pickup' ? 'pickup' : 'delivery',
    address: v.text(body.address, 'Address', { max: 300 }),
    note: v.text(body.note, 'Note', { max: 1000 }),
  };
  if (customer.deliveryMethod === 'delivery' && !customer.address) {
    throw new v.HttpError(400, 'Address is required for delivery.');
  }

  const requested = Array.isArray(body.items) ? body.items : [];
  if (!requested.length) throw new v.HttpError(400, 'Your cart is empty.');
  if (requested.length > 50) throw new v.HttpError(400, 'Too many items in one order.');

  // Prices always come from the database, never from the browser.
  const getProduct = db.prepare('SELECT id, name, price, in_stock FROM products WHERE id = ?');
  const items = requested.map((item) => {
    const product = getProduct.get(v.id(item.productId));
    if (!product) throw new v.HttpError(400, 'One of the products in your cart no longer exists.');
    if (!product.in_stock) throw new v.HttpError(400, `${product.name} is currently out of stock.`);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new v.HttpError(400, 'Invalid quantity.');
    return { productId: product.id, name: product.name, price: product.price, quantity };
  });

  const total = items.reduce((sum, i) => sum + (i.price || 0) * i.quantity, 0);
  const hasUnpriced = items.some((i) => i.price == null);
  const reference = 'OE-' + crypto.randomBytes(3).toString('hex').toUpperCase();

  transaction(() => {
    const { lastInsertRowid: orderId } = db
      .prepare(`INSERT INTO orders (reference, customer_name, phone, email, address, delivery_method, note, total, has_unpriced)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(reference, customer.name, customer.phone, customer.email, customer.address, customer.deliveryMethod, customer.note, total, hasUnpriced ? 1 : 0);
    const insertItem = db.prepare('INSERT INTO order_items (order_id, product_id, name, price, quantity) VALUES (?, ?, ?, ?, ?)');
    for (const i of items) insertItem.run(orderId, i.productId, i.name, i.price, i.quantity);
  });

  // Pre-filled WhatsApp message so the customer can ping the shop straight away.
  const naira = (n) => '₦' + n.toLocaleString('en-NG');
  const lines = [
    `Hello, I just placed order ${reference} on your website.`,
    ...items.map((i) => `• ${i.quantity} × ${i.name}${i.price != null ? ` (${naira(i.price * i.quantity)})` : ''}`),
    hasUnpriced ? `Total so far: ${naira(total)} + items awaiting price` : `Total: ${naira(total)}`,
    `Name: ${customer.name}`,
    customer.deliveryMethod === 'pickup' ? 'I will pick up in store.' : `Deliver to: ${customer.address}`,
  ];
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(lines.join('\n'))}`;

  res.status(201).json({ reference, total, hasUnpriced, whatsappUrl });
});

router.post('/messages', formLimit, (req, res) => {
  const body = req.body || {};
  const name = v.text(body.name, 'Name', { required: true, max: 100 });
  const phone = v.phone(body.phone);
  const email = v.email(body.email);
  if (!phone && !email) throw new v.HttpError(400, 'Please give a phone number or email so we can reply.');
  const subject = v.text(body.subject, 'Subject', { max: 100 });
  const message = v.text(body.message, 'Message', { required: true, max: 3000 });

  db.prepare('INSERT INTO messages (name, phone, email, subject, message) VALUES (?, ?, ?, ?, ?)').run(name, phone, email, subject, message);
  res.status(201).json({ ok: true });
});

router.post('/subscribe', formLimit, (req, res) => {
  const email = v.email(req.body?.email, 'Email', { required: true });
  db.prepare('INSERT OR IGNORE INTO subscribers (email) VALUES (?)').run(email);
  res.status(201).json({ ok: true });
});

module.exports = { router, toProduct };
