const crypto = require('node:crypto');
const { adminPassword, sessionSecret } = require('./config');
const { HttpError } = require('./validate');

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest();
const sign = (payload) => crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');

function passwordMatches(candidate) {
  // Hash both sides so timingSafeEqual gets equal-length buffers.
  return crypto.timingSafeEqual(sha256(candidate), sha256(adminPassword));
}

// Tokens are stateless ("<expiry>.<signature>") so they work across serverless instances.
function login(password) {
  if (!passwordMatches(password || '')) throw new HttpError(401, 'Incorrect password.');
  const expires = String(Date.now() + SESSION_TTL_MS);
  return `${expires}.${sign(expires)}`;
}

function tokenIsValid(token) {
  const [expires, signature] = String(token).split('.');
  if (!expires || !signature) return false;
  const expected = sign(expires);
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) && Number(expires) > Date.now();
}

function requireAdmin(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!tokenIsValid(token)) return next(new HttpError(401, 'Please log in again.'));
  next();
}

// Best-effort in-memory limiter for form endpoints and login (per server instance).
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) return next(new HttpError(429, 'Too many requests — please wait a moment and try again.'));
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear();
    next();
  };
}

module.exports = { login, requireAdmin, rateLimit };
