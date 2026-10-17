// Local development server. On Vercel, api/index.js exports the same app instead.
const config = require('./config');
const { ready } = require('./db');
const app = require('./app');

ready()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`Olamileken Electronics running at http://localhost:${config.port}`);
    });
  })
  .catch((err) => {
    console.error('[db] Could not connect to the database:', err.message);
    process.exit(1);
  });
