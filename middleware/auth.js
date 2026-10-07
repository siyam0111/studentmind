// Loads the logged-in user on every request and protects pages by role.
const db = require('../db');

async function loadUser(req, res, next) {
  res.locals.user = null;
  try {
    if (req.session.userId) {
      const r = await db.query(
        'SELECT id, name, email, role, department, year FROM users WHERE id = $1',
        [req.session.userId]
      );
      if (r.rows[0]) {
        req.user = r.rows[0];
        res.locals.user = req.user;
      } else {
        delete req.session.userId; // account was deleted
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

function requireLogin(req, res, next) {
  if (req.user) return next();
  if (req.method === 'GET') req.session.returnTo = req.originalUrl;
  req.session.flash = { type: 'error', text: 'Please log in to continue.' };
  res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (!req.user) return requireLogin(req, res, next);
  if (req.user.role !== 'admin') {
    return res.status(403).render('error', {
      title: 'Not allowed',
      message: 'You do not have permission to view this page.',
    });
  }
  next();
}

module.exports = { loadUser, requireLogin, requireAdmin };
