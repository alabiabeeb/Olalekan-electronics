// Shared helpers for every storefront page: layout, API calls, cart, product cards.

export const STORE = {
  name: 'WIZZYMONEY Olamileken Electronics',
  phones: ['08057185714', '08163813799'],
  email: 'abiodunolamilekan2015@gmail.com',
  whatsapp: '2348057185714',
  address: 'Drug Junction, Ogunpa, Ibadan, Oyo State',
};

// ---------- Utilities ----------

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const naira = (n) => '₦' + Number(n).toLocaleString('en-NG');

export async function api(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const isForm = body instanceof FormData;
  if (body && !isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch('/api' + path, { method, headers, body: isForm ? body : body && JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

let toastTimer;
export function toast(html) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.innerHTML = html;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ---------- Cart (kept in this browser only) ----------

const CART_KEY = 'oe-cart';

export const cart = {
  read() {
    try {
      const items = JSON.parse(localStorage.getItem(CART_KEY));
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  },
  write(items) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable — cart lasts for this page only */
    }
    updateCartBadge();
    document.dispatchEvent(new CustomEvent('cart:change'));
  },
  add(product, quantity = 1) {
    const items = cart.read();
    const existing = items.find((i) => i.id === product.id);
    if (existing) existing.quantity = Math.min(99, existing.quantity + quantity);
    else items.push({ id: product.id, name: product.name, price: product.price, image: product.image, quantity });
    cart.write(items);
  },
  setQuantity(id, quantity) {
    const items = cart.read().map((i) => (i.id === id ? { ...i, quantity: Math.max(1, Math.min(99, quantity)) } : i));
    cart.write(items);
  },
  remove(id) {
    cart.write(cart.read().filter((i) => i.id !== id));
  },
  clear() {
    cart.write([]);
  },
  count() {
    return cart.read().reduce((n, i) => n + i.quantity, 0);
  },
};

function updateCartBadge() {
  const badge = document.querySelector('.cart-count');
  if (!badge) return;
  const n = cart.count();
  badge.textContent = n;
  badge.hidden = n === 0;
}

// ---------- Layout ----------

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/shop', label: 'Shop' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

function currentPath() {
  const p = location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/');
  return p === '' ? '/' : p;
}

function renderHeader() {
  const here = currentPath();
  const header = document.createElement('div');
  header.innerHTML = `
    <div class="top-bar">
      <div class="container">
        <div class="top-bar-links">
          <a href="tel:+234${STORE.phones[0].slice(1)}"><i class="fas fa-phone"></i>${STORE.phones[0]}</a>
          <a class="hide-sm" href="tel:+234${STORE.phones[1].slice(1)}"><i class="fas fa-phone"></i>${STORE.phones[1]}</a>
        </div>
        <div class="top-bar-links">
          <span class="hide-sm"><i class="fas fa-truck-fast"></i>Same-day delivery in Ibadan</span>
        </div>
      </div>
    </div>
    <header class="site-header">
      <div class="container nav">
        <a href="/" class="brand" aria-label="${esc(STORE.name)} home">
          <span class="brand-mark"><i class="fas fa-bolt"></i></span>
          <span class="brand-name">Olamileken<small>Wizzymoney Electronics</small></span>
        </a>
        <ul class="nav-links" id="navLinks">
          ${NAV.map((n) => `<li><a href="${n.href}" class="${n.href === here ? 'active' : ''}">${n.label}</a></li>`).join('')}
        </ul>
        <a href="/cart" class="cart-link" aria-label="View cart">
          <i class="fas fa-cart-shopping"></i><span class="cart-count" hidden>0</span>
        </a>
        <button class="menu-btn" aria-label="Open menu" aria-expanded="false" aria-controls="navLinks"><i class="fas fa-bars"></i></button>
      </div>
    </header>`;
  document.body.prepend(...header.children);

  const btn = document.querySelector('.menu-btn');
  const links = document.getElementById('navLinks');
  btn.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    btn.setAttribute('aria-expanded', open);
    btn.innerHTML = `<i class="fas fa-${open ? 'xmark' : 'bars'}"></i>`;
  });
}

function renderFooter() {
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <a href="/" class="brand"><span class="brand-mark"><i class="fas fa-bolt"></i></span><span>Olamileken<small>Wizzymoney Electronics</small></span></a>
          <p style="margin-top:14px">Quality electronics and home appliances in Ibadan since 2020 — backed by warranty and real after-sales support.</p>
          <div class="socials">
            <a href="https://wa.me/${STORE.whatsapp}" target="_blank" rel="noopener" aria-label="WhatsApp"><i class="fab fa-whatsapp"></i></a>
            <a href="mailto:${STORE.email}" aria-label="Email"><i class="fas fa-envelope"></i></a>
            <a href="tel:+234${STORE.phones[0].slice(1)}" aria-label="Call"><i class="fas fa-phone"></i></a>
          </div>
        </div>
        <div>
          <h4>Shop</h4>
          <ul>
            <li><a href="/shop?category=televisions">Televisions</a></li>
            <li><a href="/shop?category=refrigerators">Fridges &amp; freezers</a></li>
            <li><a href="/shop?category=kitchen">Kitchen &amp; laundry</a></li>
                        <li><a href="/shop?category=power">Power &amp; generators</a></li>
          </ul>
        </div>
        <div>
          <h4>Company</h4>
          <ul>
            <li><a href="/about">About us</a></li>
            <li><a href="/contact">Contact</a></li>
            <li><a href="/cart">Your cart</a></li>
          </ul>
        </div>
        <div>
          <h4>Get new-arrival alerts</h4>
          <p>No spam — just new stock and offers.</p>
          <form class="newsletter" id="newsletterForm">
            <label for="nlEmail" class="visually-hidden">Email address</label>
            <input id="nlEmail" type="email" name="email" placeholder="you@example.com" required>
            <button class="btn btn-amber btn-sm" type="submit">Join</button>
          </form>
        </div>
      </div>
      <div class="footer-bottom">
        <span>&copy; ${new Date().getFullYear()} ${esc(STORE.name)}. All rights reserved.</span>
        <span>${esc(STORE.address)}</span>
      </div>
    </div>`;
  document.body.append(footer);

  const wa = document.createElement('a');
  wa.className = 'whatsapp-float';
  wa.href = `https://wa.me/${STORE.whatsapp}`;
  wa.target = '_blank';
  wa.rel = 'noopener';
  wa.setAttribute('aria-label', 'Chat with us on WhatsApp');
  wa.innerHTML = '<i class="fab fa-whatsapp"></i>';
  document.body.append(wa);

  document.getElementById('newsletterForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      await api('/subscribe', { method: 'POST', body: { email: form.email.value } });
      form.reset();
      toast('<i class="fas fa-check"></i> You’re subscribed — thank you!');
    } catch (err) {
      toast(`<i class="fas fa-circle-exclamation"></i> ${esc(err.message)}`);
    } finally {
      btn.disabled = false;
    }
  });
}

function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) return els.forEach((el) => el.classList.add('in'));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { threshold: 0.12 });
  els.forEach((el) => io.observe(el));
}

// ---------- Products ----------

let categoriesPromise;
export function getCategories() {
  categoriesPromise ??= api('/categories');
  return categoriesPromise;
}

export function priceHtml(price) {
  return price == null ? '<span class="price ask">Ask for price</span>' : `<span class="price">${naira(price)}</span>`;
}

export function productCard(p, categoryName = '') {
  const badges = [
    !p.inStock && '<span class="badge badge-out">Out of stock</span>',
    p.isNew && '<span class="badge badge-new">New</span>',
  ].filter(Boolean).join('');
  return `
    <article class="product-card" data-id="${p.id}">
      <button class="product-media" data-action="view" aria-label="View ${esc(p.name)}">
        <div class="badges">${badges}</div>
        <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">
      </button>
      <div class="product-body">
        ${categoryName ? `<span class="product-cat">${esc(categoryName)}</span>` : ''}
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.summary)}</p>
        <div class="product-foot">
          ${priceHtml(p.price)}
          <button class="add-btn" data-action="add" ${p.inStock ? '' : 'disabled'} aria-label="Add ${esc(p.name)} to cart">
            <i class="fas fa-plus"></i>
          </button>
        </div>
      </div>
    </article>`;
}

function addedToast(name) {
  toast(`<i class="fas fa-cart-shopping"></i> ${esc(name)} added <a href="/cart">View cart</a>`);
}

function ensureModal() {
  let modal = document.getElementById('productModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'productModal';
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = '<div class="modal-box"><button class="modal-close" aria-label="Close"><i class="fas fa-xmark"></i></button><div class="modal-content"></div></div>';
  document.body.append(modal);
  const close = () => { modal.classList.remove('open'); document.body.style.overflow = ''; };
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('.modal-close')) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('open')) close(); });
  return modal;
}

export async function openProduct(p) {
  const modal = ensureModal();
  const categories = await getCategories().catch(() => []);
  const cat = categories.find((c) => c.slug === p.category);
  const waText = encodeURIComponent(`Hello, I'm interested in the ${p.name}${p.price != null ? ` (${naira(p.price)})` : ''}. Is it available?`);
  modal.querySelector('.modal-content').innerHTML = `
    <div class="product-detail">
      <img src="${esc(p.image)}" alt="${esc(p.name)}">
      <div class="product-detail-body">
        <span class="product-cat">${esc(cat?.name || '')}</span>
        <h2>${esc(p.name)}</h2>
        ${priceHtml(p.price)}
        <p>${esc(p.description || p.summary)}</p>
        ${p.price == null ? '<div class="note-box"><i class="fas fa-circle-info"></i> Price depends on brand and size — add it to your cart and we’ll confirm the price when we call you.</div>' : ''}
        <p style="margin:0">${p.inStock ? '<i class="fas fa-circle-check" style="color:var(--success)"></i> In stock' : '<i class="fas fa-circle-xmark" style="color:var(--danger)"></i> Out of stock'}</p>
        <div class="detail-actions">
          <div class="qty">
            <button type="button" data-step="-1" aria-label="Decrease quantity">−</button>
            <input type="number" min="1" max="99" value="1" aria-label="Quantity">
            <button type="button" data-step="1" aria-label="Increase quantity">+</button>
          </div>
          <button class="btn btn-amber" data-add ${p.inStock ? '' : 'disabled'}><i class="fas fa-cart-plus"></i> Add to cart</button>
        </div>
        <a class="btn btn-outline" href="https://wa.me/${STORE.whatsapp}?text=${waText}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> Ask on WhatsApp</a>
      </div>
    </div>`;
  const qty = modal.querySelector('.qty input');
  modal.querySelectorAll('[data-step]').forEach((b) =>
    b.addEventListener('click', () => { qty.value = Math.max(1, Math.min(99, Number(qty.value) + Number(b.dataset.step))); }));
  modal.querySelector('[data-add]').addEventListener('click', () => {
    cart.add(p, Math.max(1, Math.min(99, parseInt(qty.value, 10) || 1)));
    modal.classList.remove('open');
    document.body.style.overflow = '';
    addedToast(p.name);
  });
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  modal.querySelector('.modal-close').focus();
}

// Click handling for any container of product cards.
export function bindProductGrid(container, getProducts) {
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = Number(btn.closest('.product-card').dataset.id);
    const product = getProducts().find((p) => p.id === id);
    if (!product) return;
    if (btn.dataset.action === 'add') {
      cart.add(product);
      addedToast(product.name);
    } else {
      openProduct(product);
    }
  });
}

// ---------- Boot ----------

renderHeader();
renderFooter();
updateCartBadge();
initReveal();
window.addEventListener('storage', (e) => { if (e.key === CART_KEY) updateCartBadge(); });
