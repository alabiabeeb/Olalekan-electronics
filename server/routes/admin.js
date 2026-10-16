const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');
const { db } = require('../db');
const { isCategory, ORDER_STATUSES } = require('../catalog');
const { uploadsDir } = require('../config');
const { login, logout, requireAdmin, rateLimit } = require('../auth');
const { toProduct } = require('./public');
const v = require('../validate');

const router = express.Router();

const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + IMAGE_TYPES[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    IMAGE_TYPES[file.mimetype] ? cb(null, true) : cb(new v.HttpError(400, 'Image must be JPG, PNG, WEBP or GIF.')),
});

// Deletes a previously uploaded image; seed images under /images are left alone.
function removeUpload(imagePath) {
  if (!imagePath || !imagePath.startsWith('/uploads/')) return;
  fs.rm(path.join(uploadsDir, path.basename(imagePath)), { force: true }, () => {});
}

router.post('/login', rateLimit({ windowMs: 15 * 60_000, max: 10 }), (req, res) => {
  res.json({ token: login(req.body?.password) });
});

router.use(requireAdmin);

router.post('/logout', (req, res) => {
  logout(req.adminToken);
  res.json({ ok: true });
});

router.get('/stats', (req, res) => {
  const one = (sql) => Object.values(db.prepare(sql).get())[0];
  res.json({
    products: one('SELECT COUNT(*) FROM products'),
    unpriced: one('SELECT COUNT(*) FROM products WHERE price IS NULL'),
    pendingOrders: one("SELECT COUNT(*) FROM orders WHERE status = 'pending'"),
    orders: one('SELECT COUNT(*) FROM orders'),
    revenue: one("SELECT COALESCE(SUM(total), 0) FROM orders WHERE status = 'delivered'"),
    unreadMessages: one('SELECT COUNT(*) FROM messages WHERE is_read = 0'),
    subscribers: one('SELECT COUNT(*) FROM subscribers'),
  });
});

// ---------- Products ----------

function productFields(body, file, existing) {
  const fields = {
    name: v.text(body.name, 'Name', { required: true, max: 120 }),
    category: v.text(body.category, 'Category', { required: true }),
    summary: v.text(body.summary, 'Summary', { max: 160 }),
    description: v.text(body.description, 'Description', { max: 2000 }),
    price: v.price(body.price),
    image: file ? '/uploads/' + file.filename : existing?.image || '',
    in_stock: v.bool(body.inStock),
    is_new: v.bool(body.isNew),
    featured: v.bool(body.featured),
  };
  if (!isCategory(fields.category)) throw new v.HttpError(400, 'Unknown category.');
  if (!fields.image) throw new v.HttpError(400, 'Please upload a product image.');
  return fields;
}

// Multer has already saved the file by the time validation runs, so discard it on failure.
function withUploadCleanup(handler) {
  return (req, res) => {
    try {
      handler(req, res);
    } catch (err) {
      if (req.file) removeUpload('/uploads/' + req.file.filename);
      throw err;
    }
  };
}

router.post('/products', upload.single('image'), withUploadCleanup((req, res) => {
  const f = productFields(req.body, req.file);
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO products (name, category, summary, description, price, image, in_stock, is_new, featured)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(f.name, f.category, f.summary, f.description, f.price, f.image, f.in_stock, f.is_new, f.featured);
  res.status(201).json(toProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(lastInsertRowid)));
}));

router.put('/products/:id', upload.single('image'), withUploadCleanup((req, res) => {
  const id = v.id(req.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) throw new v.HttpError(404, 'Product not found.');
  const f = productFields(req.body, req.file, existing);
  db.prepare(`UPDATE products SET name = ?, category = ?, summary = ?, description = ?, price = ?, image = ?,
              in_stock = ?, is_new = ?, featured = ? WHERE id = ?`)
    .run(f.name, f.category, f.summary, f.description, f.price, f.image, f.in_stock, f.is_new, f.featured, id);
  if (req.file) removeUpload(existing.image);
  res.json(toProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id)));
}));

router.delete('/products/:id', (req, res) => {
  const id = v.id(req.params.id);
  const existing = db.prepare('SELECT image FROM products WHERE id = ?').get(id);
  if (!existing) throw new v.HttpError(404, 'Product not found.');
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  removeUpload(existing.image);
  res.json({ ok: true });
});

// ---------- Orders ----------

router.get('/orders', (req, res) => {
  const { status } = req.query;
  const rows = status && ORDER_STATUSES.includes(status)
    ? db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY id DESC').all(status)
    : db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
  const itemsFor = db.prepare('SELECT product_id, name, price, quantity FROM order_items WHERE order_id = ?');
  res.json(rows.map((o) => ({
    id: o.id,
    reference: o.reference,
    customerName: o.customer_name,
    phone: o.phone,
    email: o.email,
    address: o.address,
    deliveryMethod: o.delivery_method,
    note: o.note,
    total: o.total,
    hasUnpriced: !!o.has_unpriced,
    status: o.status,
    createdAt: o.created_at,
    items: itemsFor.all(o.id).map((i) => ({ productId: i.product_id, name: i.name, price: i.price, quantity: i.quantity })),
  })));
});

router.patch('/orders/:id', (req, res) => {
  const status = req.body?.status;
  if (!ORDER_STATUSES.includes(status)) throw new v.HttpError(400, 'Invalid status.');
  const { changes } = db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, v.id(req.params.id));
  if (!changes) throw new v.HttpError(404, 'Order not found.');
  res.json({ ok: true });
});

// ---------- Messages & subscribers ----------

router.get('/messages', (req, res) => {
  res.json(db.prepare('SELECT * FROM messages ORDER BY id DESC').all().map((m) => ({
    id: m.id, name: m.name, phone: m.phone, email: m.email, subject: m.subject,
    message: m.message, isRead: !!m.is_read, createdAt: m.created_at,
  })));
});

router.patch('/messages/:id', (req, res) => {
  const { changes } = db.prepare('UPDATE messages SET is_read = ? WHERE id = ?').run(v.bool(req.body?.isRead), v.id(req.params.id));
  if (!changes) throw new v.HttpError(404, 'Message not found.');
  res.json({ ok: true });
});

router.delete('/messages/:id', (req, res) => {
  db.prepare('DELETE FROM messages WHERE id = ?').run(v.id(req.params.id));
  res.json({ ok: true });
});

router.get('/subscribers', (req, res) => {
  res.json(db.prepare('SELECT email, created_at AS createdAt FROM subscribers ORDER BY id DESC').all());
});

module.exports = { router };
