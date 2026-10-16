const express = require('express');
const multer = require('multer');
const config = require('./config');
const { seedProducts } = require('./db');
const { HttpError } = require('./validate');

const seeded = seedProducts();
if (seeded) console.log(`[db] Seeded ${seeded} products from the original catalog.`);

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
  });
  next();
});

app.use(express.json({ limit: '100kb' }));
app.use('/api', require('./routes/public').router);
app.use('/api/admin', require('./routes/admin').router);
app.use('/api', (req, res, next) => next(new HttpError(404, 'Not found.')));

app.use(express.static(config.publicDir, { extensions: ['html'], maxAge: '1h' }));

// Old page names from the previous site keep working.
app.get(['/accessories', '/accessories.html'], (req, res) => res.redirect(301, '/shop'));

app.use((req, res) => res.status(404).sendFile('404.html', { root: config.publicDir }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message;
  if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller.' : message;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON body.';
  } else if (!(err instanceof HttpError) && status === 500) {
    console.error(err);
    message = 'Something went wrong on our side. Please try again.';
  }
  res.status(status).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`Olamileken Electronics running at http://localhost:${config.port}`);
});
