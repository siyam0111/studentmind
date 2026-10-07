// Admin tools for articles: review queue, create, edit, unpublish, delete.
const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { categories, parseArticle } = require('../lib/articles');

const router = express.Router();
router.use('/admin', requireAdmin);

const notFound = (res) => res.status(404).render('error', { title: 'Not found', message: 'We could not find that article.' });
const idOf = (req) => {
  const n = parseInt(req.params.id, 10);
  return Number.isInteger(n) ? n : null;
};
const backTo = (req) => (req.body.next === '/admin/articles' ? '/admin/articles' : '/admin/review');

router.get('/admin/review', async (req, res, next) => {
  try {
    const r = await db.query(
      `SELECT p.id, p.title, p.summary, p.type, p.source_name, p.source_url, p.created_at,
              c.name AS category, u.name AS author
         FROM posts p LEFT JOIN categories c ON c.id = p.category_id JOIN users u ON u.id = p.author_id
        WHERE p.status = 'pending' ORDER BY p.created_at`
    );
    res.render('review', { title: 'Review queue', posts: r.rows });
  } catch (err) {
    next(err);
  }
});

// Publishes a pending, rejected or draft article.
router.post('/admin/articles/:id/approve', async (req, res, next) => {
  try {
    const id = idOf(req);
    if (!id) return notFound(res);
    await db.query(
      `UPDATE posts SET status = 'published', reviewed_by = $2, reviewed_at = now(), reject_reason = NULL
        WHERE id = $1 AND status <> 'published'`,
      [id, req.user.id]
    );
    req.session.flash = { type: 'ok', text: 'Article published.' };
    res.redirect(backTo(req));
  } catch (err) {
    next(err);
  }
});

router.post('/admin/articles/:id/reject', async (req, res, next) => {
  try {
    const id = idOf(req);
    if (!id) return notFound(res);
    const reason = (req.body.reason || '').trim().slice(0, 500) || 'It does not meet our guidelines.';
    await db.query(
      `UPDATE posts SET status = 'rejected', reject_reason = $2, reviewed_by = $3, reviewed_at = now()
        WHERE id = $1 AND status = 'pending'`,
      [id, reason, req.user.id]
    );
    req.session.flash = { type: 'ok', text: 'Article rejected.' };
    res.redirect('/admin/review');
  } catch (err) {
    next(err);
  }
});

router.post('/admin/articles/:id/unpublish', async (req, res, next) => {
  try {
    const id = idOf(req);
    if (!id) return notFound(res);
    await db.query("UPDATE posts SET status = 'draft' WHERE id = $1 AND status = 'published'", [id]);
    req.session.flash = { type: 'ok', text: 'Article unpublished.' };
    res.redirect('/admin/articles');
  } catch (err) {
    next(err);
  }
});

router.post('/admin/articles/:id/delete', async (req, res, next) => {
  try {
    const id = idOf(req);
    if (!id) return notFound(res);
    await db.query('DELETE FROM posts WHERE id = $1', [id]);
    req.session.flash = { type: 'ok', text: 'Article deleted.' };
    res.redirect(backTo(req));
  } catch (err) {
    next(err);
  }
});

router.get('/admin/articles', async (req, res, next) => {
  try {
    const r = await db.query(
      `SELECT p.id, p.title, p.type, p.status, p.created_at, u.name AS author
         FROM posts p JOIN users u ON u.id = p.author_id ORDER BY p.created_at DESC`
    );
    res.render('admin-articles', { title: 'Articles', posts: r.rows });
  } catch (err) {
    next(err);
  }
});

const blank = { type: 'original', title: '', summary: '', category_id: null, body: '', source_name: '', source_url: '' };
const formView = (cats, form, errors, edit) => ({
  title: edit ? 'Edit article' : 'New article',
  heading: edit ? 'Edit article' : 'New article',
  action: edit ? `/admin/articles/${edit}/edit` : '/admin/articles/new',
  submitLabel: edit ? 'Save changes' : 'Publish article',
  cancelHref: '/admin/articles', lockType: !!edit, categories: cats, form, errors,
  note: edit ? 'The article keeps its current status.' : 'Articles created by an admin are published straight away.',
});

router.get('/admin/articles/new', async (req, res, next) => {
  try {
    res.render('article-form', formView(await categories(), blank, [], null));
  } catch (err) {
    next(err);
  }
});

router.post('/admin/articles/new', async (req, res, next) => {
  try {
    const cats = await categories();
    const { errors, values } = parseArticle(req.body, cats);
    if (errors.length) return res.status(400).render('article-form', formView(cats, values, errors, null));
    await db.query(
      `INSERT INTO posts (author_id, category_id, type, title, summary, body, source_name, source_url, status, reviewed_by, reviewed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'published', $1, now())`,
      [req.user.id, values.category_id, values.type, values.title, values.summary, values.body, values.source_name, values.source_url]
    );
    req.session.flash = { type: 'ok', text: 'Article published.' };
    res.redirect('/admin/articles');
  } catch (err) {
    next(err);
  }
});

router.get('/admin/articles/:id/edit', async (req, res, next) => {
  try {
    const id = idOf(req);
    if (!id) return notFound(res);
    const r = await db.query('SELECT * FROM posts WHERE id = $1', [id]);
    if (!r.rows[0]) return notFound(res);
    res.render('article-form', formView(await categories(), r.rows[0], [], id));
  } catch (err) {
    next(err);
  }
});

router.post('/admin/articles/:id/edit', async (req, res, next) => {
  try {
    const id = idOf(req);
    if (!id) return notFound(res);
    const cur = await db.query('SELECT type FROM posts WHERE id = $1', [id]);
    if (!cur.rows[0]) return notFound(res);
    const cats = await categories();
    const { errors, values } = parseArticle(req.body, cats, cur.rows[0].type);
    if (errors.length) return res.status(400).render('article-form', formView(cats, values, errors, id));
    await db.query(
      `UPDATE posts SET category_id = $2, title = $3, summary = $4, body = $5, source_name = $6, source_url = $7 WHERE id = $1`,
      [id, values.category_id, values.title, values.summary, values.body, values.source_name, values.source_url]
    );
    req.session.flash = { type: 'ok', text: 'Article updated.' };
    res.redirect('/admin/articles');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
