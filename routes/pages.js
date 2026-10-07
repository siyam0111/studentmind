// About page, contact form, and the admin message inbox.
const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).render('error', { title: 'Slow down', message: 'You have sent several messages already. Please try again later.' }),
});

router.get('/about', (req, res) => res.render('about', { title: 'About' }));

router.get('/contact', (req, res) => {
  const form = { name: req.user ? req.user.name : '', email: req.user ? req.user.email : '', message: '' };
  res.render('contact', { title: 'Contact', errors: [], form });
});

router.post('/contact', contactLimiter, async (req, res, next) => {
  try {
    const form = {
      name: (req.body.name || '').trim(),
      email: (req.body.email || '').trim(),
      message: (req.body.message || '').trim(),
    };
    const errors = [];
    if (form.name.length > 100) errors.push('Name is too long.');
    if (form.email && (!emailRe.test(form.email) || form.email.length > 255)) errors.push('Enter a valid email address, or leave it empty.');
    if (form.message.length < 10 || form.message.length > 2000) errors.push('Message must be 10 to 2000 characters.');
    if (errors.length) return res.status(400).render('contact', { title: 'Contact', errors, form });
    await db.query('INSERT INTO contact_messages (name, email, message) VALUES ($1, $2, $3)', [
      form.name || null, form.email || null, form.message,
    ]);
    req.session.flash = { type: 'ok', text: 'Thanks, your message was sent.' };
    res.redirect('/contact');
  } catch (err) {
    next(err);
  }
});

router.get('/admin/messages', requireAdmin, async (req, res, next) => {
  try {
    const r = await db.query('SELECT id, name, email, message, is_read, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 100');
    res.render('admin-messages', { title: 'Messages', messages: r.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/messages/:id/read', requireAdmin, async (req, res, next) => {
  try {
    await db.query('UPDATE contact_messages SET is_read = true WHERE id = $1', [parseInt(req.params.id, 10) || 0]);
    res.redirect('/admin/messages');
  } catch (err) {
    next(err);
  }
});

router.post('/admin/messages/:id/delete', requireAdmin, async (req, res, next) => {
  try {
    await db.query('DELETE FROM contact_messages WHERE id = $1', [parseInt(req.params.id, 10) || 0]);
    req.session.flash = { type: 'ok', text: 'Message deleted.' };
    res.redirect('/admin/messages');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
