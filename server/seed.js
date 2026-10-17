// Usage: npm run seed   — wipes the products table and reloads it from data/seed-products.json.
// Uses TURSO_DATABASE_URL from .env when set, so it can also reset the live database.
const { ready, seedProducts } = require('./db');

(async () => {
  await ready();
  const inserted = await seedProducts({ reset: process.argv.includes('--reset') });
  console.log(inserted ? `Seeded ${inserted} products.` : 'Products already exist — pass --reset to reload them.');
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
