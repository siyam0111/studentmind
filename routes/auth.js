// Register, log in, log out.
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');

const router = express.Router();
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const YEARS = ['', 'Not a student', '1st', '2nd', '3rd', '4th'];

// At most 10 failed log-ins per 15 minutes from one address.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).render('login', {
      title: 'Log in',
      error: 'Too many attempts. Please wait 15 minutes and try again.',
      form: {},
    }),
});

// Starts a fresh session (prevents session fixation) and redirects.
function startSession(req, res, next, userId, to, text) {
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.userId = userId;
    req.session.flash = { type: 'ok', text };
    req.session.save((err2) => (err2 ? next(err2) : res.redirect(to)));
  });
}

router.get('/register', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  res.render('register', { title: 'Create account', errors: [], form: {} });
});

router.post('/register', async (req, res, next) => {
  const f = {
    name: (req.body.name || '').trim(),
    email: (req.body.email || '').trim().toLowerCase(),
    department: (req.body.department || '').trim(),
    year: (req.body.year || '').trim(),
  };
  const pw = req.body.password || '';
  const errors = [];
  if (f.name.length < 2 || f.name.length > 100) errors.push('Name must be 2 to 100 characters.');
  if (!emailRe.test(f.email) || f.email.length > 255) errors.push('Enter a valid email address.');
  if (pw.length < 8 || pw.length > 72) errors.push('Password must be 8 to 72 characters.');
  if (pw !== (req.body.confirm || '')) errors.push('Passwords do not match.');
  if (f.department.length > 100) errors.push('Department is too long.');
  if (!YEARS.includes(f.year)) errors.push('Choose a valid year.');
  if (errors.length) {
    return res.status(400).render('register', { title: 'Create account', errors, form: f });
  }
  try {
    const hash = await bcrypt.hash(pw, 10);
    const r = await db.query(
      `INSERT INTO users (name, email, password_hash, department, year)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [f.name, f.email, hash, f.department || null, f.year || null]
    );
    startSession(req, res, next, r.rows[0].id, '/dashboard', 'Welcome to StudentMind!');
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).render('register', {
        title: 'Create account',
        errors: ['An account with that email already exists.'],
        form: f,
      });
    }
    next(err);
  }
});

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  res.render('login', { title: 'Log in', error: null, form: {} });
});

router.post('/login', loginLimiter, async (req, res, next) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const pw = req.body.password || '';
  try {
    const r = await db.query('SELECT id, password_hash, role FROM users WHERE email = $1', [email]);
    const u = r.rows[0];
    const ok = u && (await bcrypt.compare(pw, u.password_hash));
    if (!ok) {
      return res.status(401).render('login', {
        title: 'Log in',
        error: 'Incorrect email or password.',
        form: { email },
      });
    }
    const back = req.session.returnTo;
    const safeBack = back && back.startsWith('/') && !back.startsWith('//') ? back : '/dashboard';
    startSession(req, res, next, u.id, u.role === 'admin' ? '/admin' : safeBack, 'Welcome back!');
  } catch (err) {
    next(err);
  }
});

router.get('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

module.exports = router;
