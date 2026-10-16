const crypto = require('node:crypto');
const { adminPassword } = require('./config');
const { HttpError } = require('./validate');

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const sessions = new Map(); // token -> expiry timestamp

function passwordMatches(candidate) {
  // Hash both sides so timingSafeEqual gets equal-length buffers.
  const a = crypto.createHash('sha256').update(String(candidate)).digest();
  const b = crypto.createHash('sha256').update(adminPassword).digest();
  return crypto.timingSafeEqual(a, b);
}

function login(password) {
  if (!passwordMatches(password || '')) throw new HttpError(401, 'Incorrect password.');
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function logout(token) {
  sessions.delete(token);
}

function tokenFrom(req) {
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

function requireAdmin(req, res, next) {
  const token = tokenFrom(req);
  const expiry = sessions.get(token);
  if (!expiry || expiry < Date.now()) {
    sessions.delete(token);
    return next(new HttpError(401, 'Please log in again.'));
  }
  req.adminToken = token;
  next();
}

// Small in-memory limiter for public form endpoints and login.
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) return next(new HttpError(429, 'Too many requests — please wait a moment and try again.'));
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}

module.exports = { login, logout, requireAdmin, rateLimit, tokenFrom };
