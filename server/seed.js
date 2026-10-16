// Usage: npm run seed   — wipes the products table and reloads it from data/seed-products.json.
const { seedProducts } = require('./db');

const reset = process.argv.includes('--reset');
const inserted = seedProducts({ reset });
console.log(inserted ? `Seeded ${inserted} products.` : 'Products already exist — pass --reset to reload them.');
