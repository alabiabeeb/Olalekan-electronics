import { api, esc, getCategories, productCard, bindProductGrid } from './common.js';

// Hero slideshow
const slides = document.querySelectorAll('#heroVisual img');
let current = 0;
if (slides.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  setInterval(() => {
    slides[current].classList.remove('active');
    current = (current + 1) % slides.length;
    slides[current].classList.add('active');
  }, 4500);
}

const categoryGrid = document.getElementById('categoryGrid');
const featuredGrid = document.getElementById('featuredGrid');
let featured = [];

try {
  const [categories, products] = await Promise.all([getCategories(), api('/products?featured=1')]);

  const total = categories.reduce((n, c) => n + c.count, 0);
  document.getElementById('statProducts').textContent = total + '+';

  categoryGrid.innerHTML = categories.map((c) => `
    <a href="/shop?category=${c.slug}" class="category-tile">
      <i class="fas ${c.icon}"></i>
      <h3>${esc(c.name)}</h3>
      <p>${esc(c.blurb)}</p>
      <span class="count">${c.count} products</span>
    </a>`).join('');

  const names = Object.fromEntries(categories.map((c) => [c.slug, c.name]));
  featured = products.slice(0, 8);
  featuredGrid.innerHTML = featured.length
    ? featured.map((p) => productCard(p, names[p.category])).join('')
    : '<div class="empty-state">No featured products yet.</div>';
} catch (err) {
  featuredGrid.innerHTML = `<div class="empty-state"><i class="fas fa-plug-circle-xmark"></i><p>Couldn’t load products: ${esc(err.message)}</p></div>`;
}

bindProductGrid(featuredGrid, () => featured);
