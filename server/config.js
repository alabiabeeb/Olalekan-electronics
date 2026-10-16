const path = require('node:path');
const fs = require('node:fs');

const root = path.join(__dirname, '..');
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const adminPassword = process.env.ADMIN_PASSWORD || 'change-me';
if (adminPassword === 'change-me') {
  console.warn('[config] ADMIN_PASSWORD is not set — using the default "change-me". Set it in .env before going live.');
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  adminPassword,
  whatsappNumber: process.env.WHATSAPP_NUMBER || '2348057185714',
  dbFile: process.env.DB_FILE || path.join(__dirname, 'data', 'store.db'),
  publicDir: path.join(root, 'public'),
  uploadsDir: path.join(root, 'public', 'uploads'),
};
