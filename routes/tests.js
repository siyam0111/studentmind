// Take a test, see the result, view saved results.
const express = require('express');
const db = require('../db');
const { requireLogin } = require('../middleware/auth');
const { score, present } = require('../lib/scoring');

const router = express.Router();
const notFound = (res, message) =>
  res.status(404).render('error', { title: 'Not found', message: message || 'We could not find that page.' });

async function loadTest(slug) {
  const t = await db.query(
    'SELECT id, slug, title, description, kind FROM tests WHERE slug = $1 AND is_published',
    [slug]
  );
  if (!t.rows[0]) return null;
  const q = await db.query(
    'SELECT id, text, trait, reversed FROM questions WHERE test_id = $1 ORDER BY position, id',
    [t.rows[0].id]
  );
  return { test: t.rows[0], questions: q.rows };
}

router.get('/tests', async (req, res, next) => {
  try {
    const r = await db.query(
      `SELECT t.slug, t.title, t.description, COUNT(q.id)::int AS n
         FROM tests t LEFT JOIN questions q ON q.test_id = t.id
        WHERE t.is_published GROUP BY t.id ORDER BY t.id`
    );
    res.render('tests', { title: 'Tests', tests: r.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/tests/:slug', async (req, res, next) => {
  try {
    const data = await loadTest(req.params.slug);
    if (!data) return notFound(res, 'We could not find that test.');
    if (!data.questions.length) return notFound(res, 'This test has no questions yet.');
    res.render('test', { title: data.test.title, ...data, answers: {}, error: null });
  } catch (err) {
    next(err);
  }
});

router.post('/tests/:slug', async (req, res, next) => {
  try {
    const data = await loadTest(req.params.slug);
    if (!data || !data.questions.length) return notFound(res, 'We could not find that test.');
    const answers = {};
    let missing = 0;
    data.questions.forEach((q) => {
      const v = parseInt(req.body['q_' + q.id], 10);
      if (v >= 1 && v <= 5) answers[q.id] = v;
      else missing++;
    });
    if (missing) {
      return res.status(400).render('test', {
        title: data.test.title, ...data, answers,
        error: `Please answer every statement (${missing} left).`,
      });
    }
    const scores = score(data.test, data.questions, answers);
    const model = present(data.test, scores);
    if (!req.user) {
      return res.render('result', { title: data.test.title, model, saved: false, date: null, slug: data.test.slug });
    }
    const r = await db.query(
      'INSERT INTO results (user_id, test_id, scores, summary) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.user.id, data.test.id, JSON.stringify(scores), model.headline]
    );
    req.session.flash = { type: 'ok', text: 'Result saved to your dashboard.' };
    res.redirect('/results/' + r.rows[0].id);
  } catch (err) {
    next(err);
  }
});

// Only the owner can open a saved result.
router.get('/results/:id', requireLogin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return notFound(res);
    const r = await db.query(
      `SELECT r.scores, r.created_at, t.slug, t.title, t.kind
         FROM results r JOIN tests t ON t.id = r.test_id
        WHERE r.id = $1 AND r.user_id = $2`,
      [id, req.user.id]
    );
    if (!r.rows[0]) return notFound(res);
    const row = r.rows[0];
    res.render('result', {
      title: row.title,
      model: present(row, row.scores),
      saved: true,
      date: new Date(row.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      slug: row.slug,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
