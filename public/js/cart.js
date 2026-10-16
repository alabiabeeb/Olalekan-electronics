import { api, cart, esc, naira, STORE } from './common.js';

const root = document.getElementById('cartRoot');
const itemsEl = document.getElementById('cartItems');
const summaryEl = document.getElementById('summaryRows');
const form = document.getElementById('orderForm');
const status = document.getElementById('orderStatus');
const addressField = document.getElementById('addressField');

function showStatus(kind, message) {
  status.className = `form-status show ${kind}`;
  status.textContent = message;
}

// Refresh prices/stock from the server so the cart never shows stale prices.
async function refreshFromServer() {
  const items = cart.read();
  if (!items.length) return;
  const fresh = await Promise.all(items.map((i) => api(`/products/${i.id}`).catch((err) => (err.status === 404 ? null : i))));
  const updated = items
    .map((item, idx) => fresh[idx] && { ...item, name: fresh[idx].name, price: fresh[idx].price, image: fresh[idx].image, inStock: fresh[idx].inStock ?? true })
    .filter(Boolean);
  if (updated.length < items.length) showStatus('err', 'Some items were removed because they are no longer sold.');
  cart.write(updated);
}

function render() {
  const items = cart.read();
  if (!items.length) {
    root.innerHTML = `
      <div class="success-panel">
        <i class="fas fa-cart-shopping big" style="color:var(--line)"></i>
        <h2>Your cart is empty</h2>
        <p style="color:var(--muted)">Browse the catalog and tap <strong>+</strong> on anything you like.</p>
        <a href="/shop" class="btn btn-amber"><i class="fas fa-store"></i> Go to shop</a>
      </div>`;
    return;
  }

  itemsEl.innerHTML = items.map((i) => `
    <div class="cart-item" data-id="${i.id}">
      <img src="${esc(i.image)}" alt="">
      <div>
        <h3>${esc(i.name)}</h3>
        <div class="line-price">${i.price == null ? '<span class="price ask">Price on confirmation</span>' : `${naira(i.price)} each`}</div>
        ${i.inStock === false ? '<div style="color:var(--danger);font-size:.85rem">Out of stock — remove to continue</div>' : ''}
      </div>
      <div class="cart-item-side">
        <div class="qty">
          <button type="button" data-step="-1" aria-label="Decrease quantity">−</button>
          <input type="number" min="1" max="99" value="${i.quantity}" aria-label="Quantity for ${esc(i.name)}">
          <button type="button" data-step="1" aria-label="Increase quantity">+</button>
        </div>
        <button class="remove-btn" data-remove><i class="fas fa-trash"></i> Remove</button>
      </div>
    </div>`).join('');

  const priced = items.filter((i) => i.price != null);
  const unpriced = items.filter((i) => i.price == null);
  const subtotal = priced.reduce((s, i) => s + i.price * i.quantity, 0);
  summaryEl.innerHTML = `
    <div class="summary-row"><span>Items</span><span>${cart.count()}</span></div>
    <div class="summary-row"><span>Subtotal</span><span>${naira(subtotal)}</span></div>
    <div class="summary-row"><span>Delivery</span><span>Confirmed on call</span></div>
    <div class="summary-row total"><span>Total</span><span>${naira(subtotal)}${unpriced.length ? '+' : ''}</span></div>
    ${unpriced.length ? `<div class="note-box"><i class="fas fa-circle-info"></i> ${unpriced.length} item${unpriced.length > 1 ? 's' : ''} without a listed price — we’ll confirm the price when we call.</div>` : ''}`;
}

itemsEl.addEventListener('click', (e) => {
  const row = e.target.closest('.cart-item');
  if (!row) return;
  const id = Number(row.dataset.id);
  if (e.target.closest('[data-remove]')) return cart.remove(id);
  const step = e.target.closest('[data-step]');
  if (step) {
    const input = row.querySelector('.qty input');
    cart.setQuantity(id, Number(input.value) + Number(step.dataset.step));
  }
});
itemsEl.addEventListener('change', (e) => {
  if (!e.target.matches('.qty input')) return;
  cart.setQuantity(Number(e.target.closest('.cart-item').dataset.id), parseInt(e.target.value, 10) || 1);
});

form.addEventListener('change', (e) => {
  if (e.target.name === 'deliveryMethod') addressField.hidden = e.target.value === 'pickup';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  if (!data.name.trim() || !data.phone.trim()) return showStatus('err', 'Please enter your name and phone number.');
  if (data.deliveryMethod === 'delivery' && !data.address.trim()) return showStatus('err', 'Please enter a delivery address, or choose store pickup.');

  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…';
  try {
    const order = await api('/orders', {
      method: 'POST',
      body: { ...data, items: cart.read().map((i) => ({ productId: i.id, quantity: i.quantity })) },
    });
    cart.clear();
    root.innerHTML = `
      <div class="success-panel form-card" style="margin:32px auto 72px;max-width:560px">
        <i class="fas fa-circle-check big"></i>
        <h2>Order received — thank you, ${esc(data.name.split(' ')[0])}!</h2>
        <p style="color:var(--muted)">Your order reference is</p>
        <div class="ref">${esc(order.reference)}</div>
        <p>We’ll call <strong>${esc(data.phone)}</strong> shortly to confirm ${order.hasUnpriced ? 'prices, ' : ''}availability and delivery. For a faster response, send it to us on WhatsApp too.</p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <a class="btn btn-teal" href="${esc(order.whatsappUrl)}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> Send on WhatsApp</a>
          <a class="btn btn-outline" href="/shop">Keep shopping</a>
        </div>
        <p style="margin-top:20px;font-size:.88rem;color:var(--muted)">Questions? Call ${STORE.phones.join(' or ')}.</p>
      </div>`;
    scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    showStatus('err', err.message);
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Place order';
  }
});

document.addEventListener('cart:change', render);
render();
refreshFromServer().catch(() => {});
