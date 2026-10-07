// Adds the test statements from db/questions.js. Safe to run once.
const db = require('../db');
const QUESTIONS = require('../db/questions');

(async () => {
  try {
    const c = await db.query('SELECT COUNT(*)::int AS n FROM questions');
    if (c.rows[0].n > 0) {
      console.log('Questions already exist. Nothing to do.');
      return;
    }
    for (const slug of Object.keys(QUESTIONS)) {
      const t = await db.query('SELECT id FROM tests WHERE slug = $1', [slug]);
      if (!t.rows[0]) continue;
      let position = 1;
      for (const [text, trait, reversed] of QUESTIONS[slug]) {
        await db.query(
          'INSERT INTO questions (test_id, text, trait, reversed, position) VALUES ($1, $2, $3, $4, $5)',
          [t.rows[0].id, text, trait, !!reversed, position++]
        );
      }
    }
    console.log('Questions added.');
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
