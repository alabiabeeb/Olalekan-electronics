// Product image storage: Vercel Blob when configured, otherwise public/uploads on local disk.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { put, del } = require('@vercel/blob');
const config = require('./config');
const { HttpError } = require('./validate');

const EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

async function saveImage(file) {
  const name = crypto.randomBytes(12).toString('hex') + EXTENSIONS[file.mimetype];
  if (config.blobToken) {
    const blob = await put(`products/${name}`, file.buffer, { access: 'public', contentType: file.mimetype, token: config.blobToken });
    return blob.url;
  }
  if (config.isVercel) {
    throw new HttpError(500, 'Image uploads are not configured. Connect a Vercel Blob store to this project (see README).');
  }
  await fs.mkdir(config.uploadsDir, { recursive: true });
  await fs.writeFile(path.join(config.uploadsDir, name), file.buffer);
  return '/uploads/' + name;
}

// Deletes an image we uploaded earlier. Seed images under /images are never touched.
async function removeImage(url) {
  try {
    if (url?.startsWith('/uploads/')) {
      await fs.rm(path.join(config.uploadsDir, path.basename(url)), { force: true });
    } else if (url?.includes('.blob.vercel-storage.com/') && config.blobToken) {
      await del(url, { token: config.blobToken });
    }
  } catch (err) {
    console.warn('[storage] Could not delete', url, err.message);
  }
}

module.exports = { saveImage, removeImage, IMAGE_TYPES: Object.keys(EXTENSIONS) };
