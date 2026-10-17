const express = require('express');
const multer = require('multer');
const config = require('./config');
const { ready } = require('./db');
const { HttpError } = require('./validate');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
  });
  next();
});

app.use('/api', async (req, res, next) => {
  await ready(); // create tables / seed on first request of this instance
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '100kb' }));
app.use('/api', require('./routes/public').router);
app.use('/api/admin', require('./routes/admin').router);
app.use('/api', (req, res, next) => next(new HttpError(404, 'Not found.')));

// Locally Express serves the site; on Vercel the CDN serves public/ and these never run.
app.use(express.static(config.publicDir, { extensions: ['html'], maxAge: '1h' }));
app.get(['/accessories', '/accessories.html'], (req, res) => res.redirect(301, '/shop'));
app.use((req, res) => res.status(404).sendFile('404.html', { root: config.publicDir }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message;
  if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 4 MB or smaller.' : message;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON body.';
  } else if (!(err instanceof HttpError) && status === 500) {
    console.error(err);
    message = 'Something went wrong on our side. Please try again.';
  }
  res.status(status).json({ error: message });
});

module.exports = app;
