// Admin: create tests, edit details, publish, and manage their statements.
const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use('/admin', requireAdmin);

const TRAITS = { O: 'Openness', C: 'Conscientiousness', E: 'Extraversion', A: 'Agreeableness', N: 'Emotional reactivity' };
const notFound = (res) => res.status(404).render('error', { title: 'Not found', message: 'We could not find that test.' });
const num = (v) => {
  const n = parseInt(v, 10);
  return Number.isInteger(n) ? n : null;
};
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'test';
const flash = (req, type, text) => { req.session.flash = { type, text }; };

async function uniqueSlug(base) {
  let slug = base, i = 2;
  while ((await db.query('SELECT 1 FROM tests WHERE slug = $1', [slug])).rowCount) slug = `${base}-${i++}`;
  return slug;
}

router.get('/admin/questions', async (req, res, next) => {
  try {
    const r = await db.query(
      `SELECT t.id, t.slug, t.title, t.kind, t.is_published, COUNT(q.id)::int AS n
         FROM tests t LEFT JOIN questions q ON q.test_id = t.id GROUP BY t.id ORDER BY t.id`
    );
    res.render('admin-tests', { title: 'Tests and questions', tests: r.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/questions', async (req, res, next) => {
  try {
    const title = (req.body.title || '').trim();
    const description = (req.body.description || '').trim();
    if (title.length < 3 || title.length > 150 || description.length < 10 || description.length > 500) {
      flash(req, 'error', 'Title must be 3 to 150 characters and description 10 to 500.');
      return res.redirect('/admin/questions');
    }
    const slug = await uniqueSlug(slugify(title));
    const r = await db.query(
      "INSERT INTO tests (slug, title, description, kind, is_published) VALUES ($1, $2, $3, 'scale', false) RETURNING id",
      [slug, title, description]
    );
    flash(req, 'ok', 'Test created. Add at least 3 statements, then publish it.');
    res.redirect('/admin/questions/' + r.rows[0].id);
  } catch (err) {
    next(err);
  }
});

router.get('/admin/questions/:id', async (req, res, next) => {
  try {
    const id = num(req.params.id);
    if (!id) return notFound(res);
    const t = await db.query('SELECT id, slug, title, description, kind, is_published FROM tests WHERE id = $1', [id]);
    if (!t.rows[0]) return notFound(res);
    const q = await db.query('SELECT id, text, trait, reversed FROM questions WHERE test_id = $1 ORDER BY position, id', [id]);
    const editId = num(req.query.edit);
    res.render('admin-test', {
      title: t.rows[0].title, test: t.rows[0], questions: q.rows, traits: TRAITS,
      editing: q.rows.find((x) => x.id === editId) || null,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/questions/:id/details', async (req, res, next) => {
  try {
    const id = num(req.params.id);
    if (!id) return notFound(res);
    const title = (req.body.title || '').trim();
    const description = (req.body.description || '').trim();
    const publish = req.body.is_published === 'on';
    const back = '/admin/questions/' + id;
    if (title.length < 3 || title.length > 150 || description.length < 10 || description.length > 500) {
      flash(req, 'error', 'Title must be 3 to 150 characters and description 10 to 500.');
      return res.redirect(back);
    }
    const n = (await db.query('SELECT COUNT(*)::int AS n FROM questions WHERE test_id = $1', [id])).rows[0].n;
    if (publish && n < 3) {
      flash(req, 'error', 'Add at least 3 statements before publishing this test.');
      return res.redirect(back);
    }
    const r = await db.query('UPDATE tests SET title = $2, description = $3, is_published = $4 WHERE id = $1', [id, title, description, publish]);
    if (!r.rowCount) return notFound(res);
    flash(req, 'ok', 'Test details saved.');
    res.redirect(back);
  } catch (err) {
    next(err);
  }
});

// Reads and checks a statement form. Returns { error, text, trait, reversed }.
async function readQuestion(req, testId) {
  const t = await db.query('SELECT kind FROM tests WHERE id = $1', [testId]);
  if (!t.rows[0]) return { missing: true };
  const text = (req.body.text || '').trim();
  const reversed = req.body.reversed === 'on';
  let trait = null;
  if (t.rows[0].kind === 'bigfive') trait = Object.keys(TRAITS).includes(req.body.trait) ? req.body.trait : undefined;
  if (text.length < 5 || text.length > 300) return { error: 'A statement must be 5 to 300 characters.' };
  if (trait === undefined) return { error: 'Choose a trait for this statement.' };
  return { text, trait, reversed };
}

router.post('/admin/questions/:id/add', async (req, res, next) => {
  try {
    const id = num(req.params.id);
    if (!id) return notFound(res);
    const q = await readQuestion(req, id);
    if (q.missing) return notFound(res);
    if (q.error) {
      flash(req, 'error', q.error);
    } else {
      await db.query(
        `INSERT INTO questions (test_id, text, trait, reversed, position)
         VALUES ($1, $2, $3, $4, COALESCE((SELECT MAX(position) FROM questions WHERE test_id = $1), 0) + 1)`,
        [id, q.text, q.trait, q.reversed]
      );
      flash(req, 'ok', 'Statement added.');
    }
    res.redirect('/admin/questions/' + id);
  } catch (err) {
    next(err);
  }
});

router.post('/admin/questions/:id/q/:qid/update', async (req, res, next) => {
  try {
    const id = num(req.params.id), qid = num(req.params.qid);
    if (!id || !qid) return notFound(res);
    const q = await readQuestion(req, id);
    if (q.missing) return notFound(res);
    if (q.error) {
      flash(req, 'error', q.error);
      return res.redirect(`/admin/questions/${id}?edit=${qid}`);
    }
    await db.query('UPDATE questions SET text = $3, trait = $4, reversed = $5 WHERE id = $2 AND test_id = $1', [id, qid, q.text, q.trait, q.reversed]);
    flash(req, 'ok', 'Statement updated.');
    res.redirect('/admin/questions/' + id);
  } catch (err) {
    next(err);
  }
});

router.post('/admin/questions/:id/q/:qid/delete', async (req, res, next) => {
  try {
    const id = num(req.params.id), qid = num(req.params.qid);
    if (!id || !qid) return notFound(res);
    await db.query('DELETE FROM questions WHERE id = $2 AND test_id = $1', [id, qid]);
    flash(req, 'ok', 'Statement deleted.');
    res.redirect('/admin/questions/' + id);
  } catch (err) {
    next(err);
  }
});

router.post('/admin/questions/:id/delete', async (req, res, next) => {
  try {
    const id = num(req.params.id);
    if (!id) return notFound(res);
    await db.query('DELETE FROM tests WHERE id = $1', [id]);
    flash(req, 'ok', 'Test deleted.');
    res.redirect('/admin/questions');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
