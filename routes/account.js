// Pages that need a login: dashboard, profile. Admin home needs the admin role.
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireLogin, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const YEARS = ['', 'Not a student', '1st', '2nd', '3rd', '4th'];

router.get('/dashboard', requireLogin, async (req, res, next) => {
  try {
    const r = await db.query(
      `SELECT r.id, r.scores, r.summary, r.created_at, t.title
         FROM results r JOIN tests t ON t.id = r.test_id
        WHERE r.user_id = $1 ORDER BY r.created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.render('dashboard', { title: 'Dashboard', results: r.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/profile', requireLogin, (req, res) => {
  res.render('profile', { title: 'Profile', errors: [], form: req.user });
});

router.post('/profile', requireLogin, async (req, res, next) => {
  const f = {
    name: (req.body.name || '').trim(),
    department: (req.body.department || '').trim(),
    year: (req.body.year || '').trim(),
  };
  const newPw = req.body.new_password || '';
  const errors = [];
  if (f.name.length < 2 || f.name.length > 100) errors.push('Name must be 2 to 100 characters.');
  if (f.department.length > 100) errors.push('Department is too long.');
  if (!YEARS.includes(f.year)) errors.push('Choose a valid year.');
  if (newPw && (newPw.length < 8 || newPw.length > 72)) errors.push('New password must be 8 to 72 characters.');
  try {
    if (newPw && !errors.length) {
      const r = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
      if (!(await bcrypt.compare(req.body.current_password || '', r.rows[0].password_hash))) {
        errors.push('Your current password is not correct.');
      }
    }
    if (errors.length) {
      return res.status(400).render('profile', { title: 'Profile', errors, form: f });
    }
    await db.query('UPDATE users SET name = $1, department = $2, year = $3 WHERE id = $4', [
      f.name, f.department || null, f.year || null, req.user.id,
    ]);
    if (newPw) {
      await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(newPw, 10), req.user.id]);
    }
    req.session.flash = { type: 'ok', text: 'Profile updated.' };
    res.redirect('/profile');
  } catch (err) {
    next(err);
  }
});

router.get('/admin', requireAdmin, async (req, res, next) => {
  try {
    const r = await db.query(`SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM results) AS results,
      (SELECT COUNT(*) FROM posts WHERE status = 'pending') AS pending`);
    res.render('admin', { title: 'Admin', stats: r.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
