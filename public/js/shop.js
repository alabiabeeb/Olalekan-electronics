import { api, esc, getCategories, productCard, bindProductGrid } from './common.js';

const grid = document.getElementById('productGrid');
const chips = document.getElementById('chips');
const search = document.getElementById('search');
const sort = document.getElementById('sort');
const resultCount = document.getElementById('resultCount');

const params = new URLSearchParams(location.search);
const state = { category: params.get('category') || 'all', q: params.get('q') || '', sort: params.get('sort') || '' };
search.value = state.q;
sort.value = state.sort;

let products = [];
let names = {};
let requestId = 0;

function syncUrl() {
  const p = new URLSearchParams();
  if (state.category !== 'all') p.set('category', state.category);
  if (state.q) p.set('q', state.q);
  if (state.sort) p.set('sort', state.sort);
  history.replaceState(null, '', p.size ? `?${p}` : location.pathname);
}

async function load() {
  const id = ++requestId;
  const query = new URLSearchParams({ category: state.category, q: state.q, sort: state.sort });
  try {
    const result = await api('/products?' + query);
    if (id !== requestId) return; // a newer search has started
    products = result;
    resultCount.textContent = `${products.length} product${products.length === 1 ? '' : 's'}${state.q ? ` matching “${state.q}”` : ''}`;
    grid.innerHTML = products.length
      ? products.map((p) => productCard(p, names[p.category])).join('')
      : `<div class="empty-state"><i class="fas fa-box-open"></i><p>No products found. Try another search or category.</p></div>`;
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><i class="fas fa-plug-circle-xmark"></i><p>Couldn’t load products: ${esc(err.message)}</p></div>`;
  }
  syncUrl();
}

function renderChips(categories) {
  const total = categories.reduce((n, c) => n + c.count, 0);
  const all = [{ slug: 'all', name: 'All', count: total }, ...categories];
  chips.innerHTML = all.map((c) => `
    <button class="chip ${c.slug === state.category ? 'active' : ''}" role="tab" aria-selected="${c.slug === state.category}" data-slug="${c.slug}">
      ${esc(c.name)}<span class="n">${c.count}</span>
    </button>`).join('');
}

chips.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.category = chip.dataset.slug;
  chips.querySelectorAll('.chip').forEach((c) => {
    const on = c === chip;
    c.classList.toggle('active', on);
    c.setAttribute('aria-selected', on);
  });
  load();
});

let debounce;
search.addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => { state.q = search.value.trim(); load(); }, 250);
});
sort.addEventListener('change', () => { state.sort = sort.value; load(); });

bindProductGrid(grid, () => products);

try {
  const categories = await getCategories();
  names = Object.fromEntries(categories.map((c) => [c.slug, c.name]));
  if (state.category !== 'all' && !names[state.category]) state.category = 'all';
  renderChips(categories);
} catch {
  /* chips are optional; products still load below */
}
load();
