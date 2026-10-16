// Admin dashboard. Deliberately does not import common.js so the storefront header/cart aren't rendered here.

const TOKEN_KEY = 'oe-admin-token';
const $ = (id) => document.getElementById(id);

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const naira = (n) => '₦' + Number(n).toLocaleString('en-NG');
const when = (sqlDate) => new Date(sqlDate.replace(' ', 'T') + 'Z').toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });

let token = '';
try { token = sessionStorage.getItem(TOKEN_KEY) || ''; } catch { /* storage blocked */ }

async function api(path, { method = 'GET', body } = {}) {
  const headers = { Authorization: `Bearer ${token}` };
  const isForm = body instanceof FormData;
  if (body && !isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch('/api' + path, { method, headers, body: isForm ? body : body && JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/admin/login') {
    showLogin('Your session has expired. Please log in again.');
    throw new Error('Not logged in');
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function setStatus(el, kind, msg) {
  el.className = `form-status show ${kind}`;
  el.textContent = msg;
}

// ---------- Auth ----------

function showLogin(message) {
  token = '';
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  $('adminView').hidden = true;
  $('loginView').hidden = false;
  if (message) setStatus($('loginStatus'), 'err', message);
  $('password').focus();
}

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const res = await api('/admin/login', { method: 'POST', body: { password: $('password').value } });
    token = res.token;
    try { sessionStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
    $('password').value = '';
    $('loginStatus').className = 'form-status';
    startDashboard();
  } catch (err) {
    setStatus($('loginStatus'), 'err', err.message);
  }
});

$('logoutBtn').addEventListener('click', async () => {
  await api('/admin/logout', { method: 'POST' }).catch(() => {});
  showLogin();
});

// ---------- Tabs ----------

const loaders = { overview: loadStats, products: loadProducts, orders: loadOrders, messages: loadMessages, subscribers: loadSubscribers };

$('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tab]');
  if (!btn) return;
  showTab(btn.dataset.tab);
});

function showTab(name) {
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== name; });
  loaders[name]().catch((err) => console.error(err));
}

// ---------- Overview ----------

async function loadStats() {
  const s = await api('/admin/stats');
  const pill = (el, n) => { el.hidden = !n; el.textContent = n; };
  pill($('pendingPill'), s.pendingOrders);
  pill($('unreadPill'), s.unreadMessages);
  $('statCards').innerHTML = [
    ['Pending orders', s.pendingOrders],
    ['All orders', s.orders],
    ['Delivered revenue', naira(s.revenue)],
    ['Unread messages', s.unreadMessages],
    ['Products', s.products],
    ['Products without price', s.unpriced],
    ['Subscribers', s.subscribers],
  ].map(([label, value]) => `<div class="stat-card"><span>${label}</span><strong>${value}</strong></div>`).join('');
}

// ---------- Products ----------

let categories = [];
let products = [];

async function loadProducts() {
  [categories, products] = await Promise.all([
    categories.length ? categories : api('/categories'),
    api('/products?sort=newest'),
  ]);
  $('pCategory').innerHTML = categories.map((c) => `<option value="${c.slug}">${esc(c.name)}</option>`).join('');
  renderProducts();
}

function renderProducts() {
  const q = $('productSearch').value.trim().toLowerCase();
  const names = Object.fromEntries(categories.map((c) => [c.slug, c.name]));
  const rows = products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.category.includes(q));
  $('productRows').innerHTML = rows.length ? rows.map((p) => `
    <tr data-id="${p.id}">
      <td><img src="${esc(p.image)}" alt=""></td>
      <td><strong>${esc(p.name)}</strong>${p.isNew ? ' <span class="badge badge-new">New</span>' : ''}${p.featured ? ' <span class="badge badge-featured">Featured</span>' : ''}<div class="meta">${esc(p.summary)}</div></td>
      <td>${esc(names[p.category] || p.category)}</td>
      <td>${p.price == null ? '<span class="meta">Ask for price</span>' : naira(p.price)}</td>
      <td>${p.inStock ? 'In stock' : '<span style="color:var(--danger)">Out</span>'}</td>
      <td><div class="row-actions">
        <button class="icon-btn" data-edit title="Edit" aria-label="Edit ${esc(p.name)}"><i class="fas fa-pen"></i></button>
        <button class="icon-btn danger" data-delete title="Delete" aria-label="Delete ${esc(p.name)}"><i class="fas fa-trash"></i></button>
      </div></td>
    </tr>`).join('') : '<tr><td colspan="6" class="muted-empty">No products match.</td></tr>';
}

$('productSearch').addEventListener('input', renderProducts);

$('productRows').addEventListener('click', async (e) => {
  const row = e.target.closest('tr[data-id]');
  if (!row) return;
  const product = products.find((p) => p.id === Number(row.dataset.id));
  if (e.target.closest('[data-edit]')) openEditor(product);
  if (e.target.closest('[data-delete]') && confirm(`Delete “${product.name}”? This cannot be undone.`)) {
    try {
      await api(`/admin/products/${product.id}`, { method: 'DELETE' });
      products = products.filter((p) => p.id !== product.id);
      renderProducts();
    } catch (err) {
      alert(err.message);
    }
  }
});

let editingId = null;
const editor = $('productEditor');
const productForm = $('productForm');

function openEditor(product = null) {
  editingId = product?.id ?? null;
  productForm.reset();
  $('productStatus').className = 'form-status';
  $('editorTitle').textContent = product ? 'Edit product' : 'Add product';
  $('imgPreview').src = product?.image || '';
  if (product) {
    productForm.name.value = product.name;
    productForm.category.value = product.category;
    productForm.price.value = product.price ?? '';
    productForm.summary.value = product.summary;
    productForm.description.value = product.description;
    productForm.inStock.checked = product.inStock;
    productForm.isNew.checked = product.isNew;
    productForm.featured.checked = product.featured;
  }
  editor.classList.add('open');
  productForm.name.focus();
}
const closeEditor = () => editor.classList.remove('open');

$('newProductBtn').addEventListener('click', () => openEditor());
editor.addEventListener('click', (e) => { if (e.target === editor || e.target.closest('[data-close]')) closeEditor(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeEditor(); });

$('pImage').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) $('imgPreview').src = URL.createObjectURL(file);
});

productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = new FormData(productForm);
  // Unchecked boxes are omitted from FormData — send explicit values.
  for (const key of ['inStock', 'isNew', 'featured']) data.set(key, productForm[key].checked ? '1' : '0');
  if (!productForm.image.files.length) data.delete('image');

  const btn = productForm.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    const saved = await api(editingId ? `/admin/products/${editingId}` : '/admin/products', { method: editingId ? 'PUT' : 'POST', body: data });
    const idx = products.findIndex((p) => p.id === saved.id);
    if (idx >= 0) products[idx] = saved; else products.unshift(saved);
    renderProducts();
    closeEditor();
  } catch (err) {
    setStatus($('productStatus'), 'err', err.message);
  } finally {
    btn.disabled = false;
  }
});

// ---------- Orders ----------

async function loadOrders() {
  const status = $('orderFilter').value;
  const orders = await api('/admin/orders' + (status ? `?status=${status}` : ''));
  $('orderList').innerHTML = orders.length ? orders.map((o) => `
    <article class="order-card" data-id="${o.id}">
      <header>
        <div><strong>${esc(o.reference)}</strong> · ${esc(o.customerName)} <span class="status status-${o.status}">${o.status}</span></div>
        <select aria-label="Change status for ${esc(o.reference)}">
          ${['pending', 'confirmed', 'delivered', 'cancelled'].map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}
        </select>
      </header>
      <div class="meta">${when(o.createdAt)} · <a href="tel:${esc(o.phone)}">${esc(o.phone)}</a>${o.email ? ` · <a href="mailto:${esc(o.email)}">${esc(o.email)}</a>` : ''}</div>
      <ul>${o.items.map((i) => `<li>${i.quantity} × ${esc(i.name)} — ${i.price == null ? '<em>price to confirm</em>' : naira(i.price * i.quantity)}</li>`).join('')}</ul>
      <div><strong>Total: ${naira(o.total)}${o.hasUnpriced ? ' + unpriced items' : ''}</strong></div>
      <div class="meta">${o.deliveryMethod === 'pickup' ? 'Store pickup' : `Deliver to: ${esc(o.address)}`}${o.note ? ` · Note: ${esc(o.note)}` : ''}</div>
    </article>`).join('') : '<div class="muted-empty">No orders yet.</div>';
}

$('orderFilter').addEventListener('change', loadOrders);
$('orderList').addEventListener('change', async (e) => {
  if (e.target.tagName !== 'SELECT') return;
  const id = e.target.closest('.order-card').dataset.id;
  try {
    await api(`/admin/orders/${id}`, { method: 'PATCH', body: { status: e.target.value } });
    await Promise.all([loadOrders(), loadStats()]);
  } catch (err) {
    alert(err.message);
  }
});

// ---------- Messages ----------

async function loadMessages() {
  const messages = await api('/admin/messages');
  $('messageList').innerHTML = messages.length ? messages.map((m) => `
    <article class="message-card ${m.isRead ? '' : 'unread'}" data-id="${m.id}" data-read="${m.isRead}">
      <header>
        <div><strong>${esc(m.name)}</strong> · ${esc(m.subject || 'No subject')}</div>
        <div class="row-actions">
          <button class="btn btn-outline btn-sm" data-toggle>${m.isRead ? 'Mark unread' : 'Mark read'}</button>
          <button class="icon-btn danger" data-delete aria-label="Delete message"><i class="fas fa-trash"></i></button>
        </div>
      </header>
      <div class="meta">${when(m.createdAt)}${m.phone ? ` · <a href="tel:${esc(m.phone)}">${esc(m.phone)}</a>` : ''}${m.email ? ` · <a href="mailto:${esc(m.email)}">${esc(m.email)}</a>` : ''}</div>
      <p style="margin:8px 0 0;white-space:pre-wrap">${esc(m.message)}</p>
    </article>`).join('') : '<div class="muted-empty">No messages yet.</div>';
}

$('messageList').addEventListener('click', async (e) => {
  const card = e.target.closest('.message-card');
  if (!card) return;
  try {
    if (e.target.closest('[data-toggle]')) {
      await api(`/admin/messages/${card.dataset.id}`, { method: 'PATCH', body: { isRead: card.dataset.read !== 'true' } });
    } else if (e.target.closest('[data-delete]') && confirm('Delete this message?')) {
      await api(`/admin/messages/${card.dataset.id}`, { method: 'DELETE' });
    } else return;
    await Promise.all([loadMessages(), loadStats()]);
  } catch (err) {
    alert(err.message);
  }
});

// ---------- Subscribers ----------

let subscriberEmails = [];
async function loadSubscribers() {
  const subs = await api('/admin/subscribers');
  subscriberEmails = subs.map((s) => s.email);
  $('subscriberRows').innerHTML = subs.length
    ? subs.map((s) => `<tr><td>${esc(s.email)}</td><td>${when(s.createdAt)}</td></tr>`).join('')
    : '<tr><td colspan="2" class="muted-empty">No subscribers yet.</td></tr>';
}
$('copyEmails').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(subscriberEmails.join(', '));
    $('copyEmails').innerHTML = '<i class="fas fa-check"></i> Copied';
  } catch {
    prompt('Copy these emails:', subscriberEmails.join(', '));
  }
});

// ---------- Start ----------

function startDashboard() {
  $('loginView').hidden = true;
  $('adminView').hidden = false;
  showTab('overview');
}

if (token) api('/admin/stats').then(startDashboard, () => showLogin());
else showLogin();
