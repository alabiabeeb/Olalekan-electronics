const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const isVercel = !!process.env.VERCEL;

const adminPassword = process.env.ADMIN_PASSWORD || 'change-me';
if (adminPassword === 'change-me') {
  console.warn('[config] ADMIN_PASSWORD is not set — using the default "change-me". Set it in .env (or Vercel env vars) before going live.');
}

// Locally the database is a file; on Vercel it must be a hosted Turso database.
const localDbFile = path.join(__dirname, 'data', 'store.db');
// The Vercel Turso integration names variables after the chosen prefix, so accept both spellings.
const tursoUrl = process.env.TURSO_DATABASE_URL || process.env.TURSO_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN || process.env.TURSO_TOKEN;
const databaseUrl = tursoUrl || pathToFileURL(localDbFile).href;
if (isVercel && !tursoUrl) {
  console.error('[config] TURSO_DATABASE_URL is not set — Vercel has no permanent disk, so the database cannot be stored. See README.');
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  isVercel,
  adminPassword,
  // Signs admin login tokens. Falls back to the password so changing it logs everyone out.
  sessionSecret: process.env.SESSION_SECRET || `oe-session:${adminPassword}`,
  whatsappNumber: process.env.WHATSAPP_NUMBER || '2348057185714',
  databaseUrl,
  databaseAuthToken: tursoToken,
  localDbFile,
  blobToken: process.env.BLOB_READ_WRITE_TOKEN,
  publicDir: path.join(root, 'public'),
  uploadsDir: path.join(root, 'public', 'uploads'),
};
