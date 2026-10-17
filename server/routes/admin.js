const express = require('express');
const multer = require('multer');
const { db } = require('../db');
const { isCategory, ORDER_STATUSES } = require('../catalog');
const { login, requireAdmin, rateLimit } = require('../auth');
const { saveImage, removeImage, IMAGE_TYPES } = require('../storage');
const { toProduct } = require('./public');
const v = require('../validate');

const router = express.Router();

// Kept in memory, then saved to Blob or disk. 4 MB stays under Vercel's 4.5 MB request limit.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    IMAGE_TYPES.includes(file.mimetype) ? cb(null, true) : cb(new v.HttpError(400, 'Image must be JPG, PNG, WEBP or GIF.')),
});

router.post('/login', rateLimit({ windowMs: 15 * 60_000, max: 10 }), (req, res) => {
  res.json({ token: login(req.body?.password) });
});

router.use(requireAdmin);

// Tokens are stateless, so logging out just means the browser forgets its token.
router.post('/logout', (req, res) => res.json({ ok: true }));

router.get('/stats', async (req, res) => {
  const [counts] = await db.all(`SELECT
    (SELECT COUNT(*) FROM products) AS products,
    (SELECT COUNT(*) FROM products WHERE price IS NULL) AS unpriced,
    (SELECT COUNT(*) FROM orders WHERE status = 'pending') AS pendingOrders,
    (SELECT COUNT(*) FROM orders) AS orders,
    (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status = 'delivered') AS revenue,
    (SELECT COUNT(*) FROM messages WHERE is_read = 0) AS unreadMessages,
    (SELECT COUNT(*) FROM subscribers) AS subscribers`);
  res.json(counts);
});

// ---------- Products ----------

function productFields(body, hasNewImage, existing) {
  const fields = {
    name: v.text(body.name, 'Name', { required: true, max: 120 }),
    category: v.text(body.category, 'Category', { required: true }),
    summary: v.text(body.summary, 'Summary', { max: 160 }),
    description: v.text(body.description, 'Description', { max: 2000 }),
    price: v.price(body.price),
    in_stock: v.bool(body.inStock),
    is_new: v.bool(body.isNew),
    featured: v.bool(body.featured),
  };
  if (!isCategory(fields.category)) throw new v.HttpError(400, 'Unknown category.');
  if (!hasNewImage && !existing?.image) throw new v.HttpError(400, 'Please upload a product image.');
  return fields;
}

router.post('/products', upload.single('image'), async (req, res) => {
  const f = productFields(req.body, !!req.file);
  const image = await saveImage(req.file);
  const { lastInsertRowid } = await db.run(
    `INSERT INTO products (name, category, summary, description, price, image, in_stock, is_new, featured)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [f.name, f.category, f.summary, f.description, f.price, image, f.in_stock, f.is_new, f.featured],
  );
  res.status(201).json(toProduct(await db.get('SELECT * FROM products WHERE id = ?', [lastInsertRowid])));
});

router.put('/products/:id', upload.single('image'), async (req, res) => {
  const id = v.id(req.params.id);
  const existing = await db.get('SELECT * FROM products WHERE id = ?', [id]);
  if (!existing) throw new v.HttpError(404, 'Product not found.');
  const f = productFields(req.body, !!req.file, existing);
  const image = req.file ? await saveImage(req.file) : existing.image;
  await db.run(
    `UPDATE products SET name = ?, category = ?, summary = ?, description = ?, price = ?, image = ?,
     in_stock = ?, is_new = ?, featured = ? WHERE id = ?`,
    [f.name, f.category, f.summary, f.description, f.price, image, f.in_stock, f.is_new, f.featured, id],
  );
  if (req.file) await removeImage(existing.image);
  res.json(toProduct(await db.get('SELECT * FROM products WHERE id = ?', [id])));
});

router.delete('/products/:id', async (req, res) => {
  const id = v.id(req.params.id);
  const existing = await db.get('SELECT image FROM products WHERE id = ?', [id]);
  if (!existing) throw new v.HttpError(404, 'Product not found.');
  await db.run('DELETE FROM products WHERE id = ?', [id]);
  await removeImage(existing.image);
  res.json({ ok: true });
});

// ---------- Orders ----------

router.get('/orders', async (req, res) => {
  const { status } = req.query;
  const filtered = status && ORDER_STATUSES.includes(status);
  const orders = await db.all(`SELECT * FROM orders ${filtered ? 'WHERE status = ?' : ''} ORDER BY id DESC`, filtered ? [status] : []);
  const items = orders.length
    ? await db.all(`SELECT order_id, product_id, name, price, quantity FROM order_items WHERE order_id IN (${orders.map(() => '?').join(',')})`, orders.map((o) => o.id))
    : [];
  res.json(orders.map((o) => ({
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
    items: items.filter((i) => i.order_id === o.id).map((i) => ({ productId: i.product_id, name: i.name, price: i.price, quantity: i.quantity })),
  })));
});

router.patch('/orders/:id', async (req, res) => {
  const status = req.body?.status;
  if (!ORDER_STATUSES.includes(status)) throw new v.HttpError(400, 'Invalid status.');
  const { changes } = await db.run('UPDATE orders SET status = ? WHERE id = ?', [status, v.id(req.params.id)]);
  if (!changes) throw new v.HttpError(404, 'Order not found.');
  res.json({ ok: true });
});

// ---------- Messages & subscribers ----------

router.get('/messages', async (req, res) => {
  const rows = await db.all('SELECT * FROM messages ORDER BY id DESC');
  res.json(rows.map((m) => ({
    id: m.id, name: m.name, phone: m.phone, email: m.email, subject: m.subject,
    message: m.message, isRead: !!m.is_read, createdAt: m.created_at,
  })));
});

router.patch('/messages/:id', async (req, res) => {
  const { changes } = await db.run('UPDATE messages SET is_read = ? WHERE id = ?', [v.bool(req.body?.isRead), v.id(req.params.id)]);
  if (!changes) throw new v.HttpError(404, 'Message not found.');
  res.json({ ok: true });
});

router.delete('/messages/:id', async (req, res) => {
  await db.run('DELETE FROM messages WHERE id = ?', [v.id(req.params.id)]);
  res.json({ ok: true });
});

router.get('/subscribers', async (req, res) => {
  res.json(await db.all('SELECT email, created_at AS createdAt FROM subscribers ORDER BY id DESC'));
});

module.exports = { router };
