// Reading articles, writing articles, comments and bookmarks.
const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { requireLogin } = require('../middleware/auth');
const { categories, parseArticle } = require('../lib/articles');

const router = express.Router();
const notFound = (res, m) =>
  res.status(404).render('error', { title: 'Not found', message: m || 'We could not find that page.' });
const limiter = (max, minutes) =>
  rateLimit({
    windowMs: minutes * 60 * 1000, max, standardHeaders: true, legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).render('error', { title: 'Slow down', message: 'Too many requests. Please wait a few minutes and try again.' }),
  });
const commentLimiter = limiter(15, 10);
const writeLimiter = limiter(10, 60);
const idOf = (req) => {
  const n = parseInt(req.params.id, 10);
  return Number.isInteger(n) ? n : null;
};
const MAX_PENDING = 5;

// Learn page: only published articles, with search and category filter.
router.get('/articles', async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim().slice(0, 100);
    const cat = parseInt(req.query.cat, 10) || null;
    const like = '%' + q.replace(/[\\%_]/g, '\\$&') + '%';
    const posts = await db.query(
      `SELECT p.id, p.title, p.summary, p.type, p.source_name, p.created_at,
              c.name AS category, u.name AS author
         FROM posts p LEFT JOIN categories c ON c.id = p.category_id
         JOIN users u ON u.id = p.author_id
        WHERE p.status = 'published'
          AND ($1::text = '' OR p.title ILIKE $2 OR p.summary ILIKE $2)
          AND ($3::int IS NULL OR p.category_id = $3)
        ORDER BY p.created_at DESC LIMIT 50`,
      [q, like, cat]
    );
    res.render('articles', { title: 'Learn', posts: posts.rows, categories: await categories(), q, cat });
  } catch (err) {
    next(err);
  }
});

router.get('/articles/:id', async (req, res, next) => {
  try {
    const id = idOf(req);
    if (!id) return notFound(res);
    const r = await db.query(
      `SELECT p.*, c.name AS category, u.name AS author
         FROM posts p LEFT JOIN categories c ON c.id = p.category_id
         JOIN users u ON u.id = p.author_id WHERE p.id = $1`,
      [id]
    );
    const a = r.rows[0];
    if (!a) return notFound(res);
    const canSee = a.status === 'published' || (req.user && (req.user.role === 'admin' || req.user.id === a.author_id));
    if (!canSee) return notFound(res);
    const comments = await db.query(
      `SELECT cm.id, cm.body, cm.created_at, cm.user_id, u.name
         FROM comments cm JOIN users u ON u.id = cm.user_id
        WHERE cm.post_id = $1 ORDER BY cm.created_at`,
      [id]
    );
    let bookmarked = false;
    if (req.user) {
      const b = await db.query('SELECT 1 FROM bookmarks WHERE user_id = $1 AND post_id = $2', [req.user.id, id]);
      bookmarked = b.rowCount > 0;
    }
    res.render('article', { title: a.title, a, comments: comments.rows, bookmarked });
  } catch (err) {
    next(err);
  }
});

router.post('/articles/:id/comments', requireLogin, commentLimiter, async (req, res, next) => {
  try {
    const id = idOf(req);
    const body = (req.body.body || '').trim();
    if (!id) return notFound(res);
    if (body.length < 1 || body.length > 1000) {
      req.session.flash = { type: 'error', text: 'A comment must be 1 to 1000 characters.' };
      return res.redirect('/articles/' + id + '#comments');
    }
    const ok = await db.query(
      `INSERT INTO comments (post_id, user_id, body)
       SELECT id, $2, $3 FROM posts WHERE id = $1 AND status = 'published' RETURNING id`,
      [id, req.user.id, body]
    );
    if (!ok.rowCount) return notFound(res);
    req.session.flash = { type: 'ok', text: 'Comment posted.' };
    res.redirect('/articles/' + id + '#comments');
  } catch (err) {
    next(err);
  }
});

router.post('/comments/:id/delete', requireLogin, async (req, res, next) => {
  try {
    const id = idOf(req);
    if (!id) return notFound(res);
    const c = await db.query('SELECT post_id, user_id FROM comments WHERE id = $1', [id]);
    if (!c.rows[0]) return notFound(res);
    if (c.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).render('error', { title: 'Not allowed', message: 'You can only delete your own comments.' });
    }
    await db.query('DELETE FROM comments WHERE id = $1', [id]);
    req.session.flash = { type: 'ok', text: 'Comment deleted.' };
    res.redirect('/articles/' + c.rows[0].post_id + '#comments');
  } catch (err) {
    next(err);
  }
});

router.post('/articles/:id/bookmark', requireLogin, async (req, res, next) => {
  try {
    const id = idOf(req);
    if (!id) return notFound(res);
    const p = await db.query("SELECT 1 FROM posts WHERE id = $1 AND status = 'published'", [id]);
    if (!p.rowCount) return notFound(res);
    const removed = await db.query('DELETE FROM bookmarks WHERE user_id = $1 AND post_id = $2', [req.user.id, id]);
    if (!removed.rowCount) {
      await db.query('INSERT INTO bookmarks (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, id]);
    }
    req.session.flash = { type: 'ok', text: removed.rowCount ? 'Bookmark removed.' : 'Article saved to your dashboard.' };
    res.redirect('/articles/' + id);
  } catch (err) {
    next(err);
  }
});

// Writing: any logged-in user. New articles wait for admin approval.
const blankForm = { type: 'original', title: '', summary: '', category_id: null, body: '', source_name: '', source_url: '' };
const formView = (cats, form, errors) => ({
  title: 'Write an article', heading: 'Write an article', action: '/write', submitLabel: 'Submit for review',
  cancelHref: '/my-articles', lockType: false, categories: cats, form, errors,
  note: 'An admin reviews every submission before it appears on the Learn page.',
});

router.get('/write', requireLogin, async (req, res, next) => {
  try {
    res.render('article-form', formView(await categories(), blankForm, []));
  } catch (err) {
    next(err);
  }
});

router.post('/write', requireLogin, writeLimiter, async (req, res, next) => {
  try {
    const cats = await categories();
    const { errors, values } = parseArticle(req.body, cats);
    const pending = await db.query("SELECT COUNT(*)::int AS n FROM posts WHERE author_id = $1 AND status = 'pending'", [req.user.id]);
    if (pending.rows[0].n >= MAX_PENDING) {
      errors.push(`You already have ${MAX_PENDING} articles waiting for review. Please wait for them to be reviewed.`);
    }
    if (errors.length) return res.status(400).render('article-form', formView(cats, values, errors));
    await db.query(
      `INSERT INTO posts (author_id, category_id, type, title, summary, body, source_name, source_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')`,
      [req.user.id, values.category_id, values.type, values.title, values.summary, values.body, values.source_name, values.source_url]
    );
    req.session.flash = { type: 'ok', text: 'Submitted. An admin will review it soon.' };
    res.redirect('/my-articles');
  } catch (err) {
    next(err);
  }
});

router.get('/my-articles', requireLogin, async (req, res, next) => {
  try {
    const r = await db.query(
      `SELECT id, title, type, status, reject_reason, created_at
         FROM posts WHERE author_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.render('my-articles', { title: 'My articles', posts: r.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/my-articles/:id/delete', requireLogin, async (req, res, next) => {
  try {
    const id = idOf(req);
    if (!id) return notFound(res);
    await db.query('DELETE FROM posts WHERE id = $1 AND author_id = $2', [id, req.user.id]);
    req.session.flash = { type: 'ok', text: 'Article deleted.' };
    res.redirect('/my-articles');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
