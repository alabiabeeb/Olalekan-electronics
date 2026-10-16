class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s-]{7,20}$/;

// Trimmed string, or throws when it is required and empty / too long.
function text(value, field, { required = false, max = 500 } = {}) {
  const s = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
  if (required && !s) throw new HttpError(400, `${field} is required.`);
  if (s.length > max) throw new HttpError(400, `${field} must be at most ${max} characters.`);
  return s;
}

function email(value, field = 'Email', opts = {}) {
  const s = text(value, field, { max: 200, ...opts });
  if (s && !EMAIL_RE.test(s)) throw new HttpError(400, `${field} is not a valid email address.`);
  return s.toLowerCase();
}

function phone(value, field = 'Phone', opts = {}) {
  const s = text(value, field, { max: 20, ...opts });
  if (s && !PHONE_RE.test(s)) throw new HttpError(400, `${field} is not a valid phone number.`);
  return s;
}

// Whole naira amount, or null when left blank.
function price(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 1e10) throw new HttpError(400, 'Price must be a whole number of naira.');
  return n;
}

function bool(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'on' ? 1 : 0;
}

function id(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, 'Invalid id.');
  return n;
}

module.exports = { HttpError, text, email, phone, price, bool, id };
