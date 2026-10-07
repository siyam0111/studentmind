// Adds a few starter articles (written by the first admin). Safe to run once.
const db = require('../db');

const ARTICLES = [
  ['Study techniques', 'Spacing beats cramming',
   'Splitting study into several shorter sessions helps you remember more for longer than one long session.',
   `Memory researchers have found, again and again, that the same amount of study is remembered longer when it is spread over several sessions instead of packed into one. This is called the spacing effect.

What to do:
- Split each subject into three or four short sessions across the week.
- Before starting something new, spend a few minutes on what you studied earlier.
- Plan your first review within a day or two of learning something.

Cramming can get you through tomorrow's quiz, but it fades quickly. If a topic matters for the final exam, give it several short visits.`],
  ['Study techniques', 'Test yourself instead of re-reading',
   'Trying to recall information from memory strengthens learning more than reading it again.',
   `Re-reading notes feels easy and familiar, which makes it feel effective. Research on retrieval practice suggests that trying to recall information from memory usually builds longer-lasting learning.

What to do:
- Close your notes and write down everything you remember about a topic.
- Check your notes, and mark what you missed.
- Use past exam questions or make your own flashcards.

If it feels harder than re-reading, that is normal. The effort is part of what makes it work.`],
  ['Sleep & focus', 'Sleep is part of studying',
   'Sleep supports memory and concentration, so all-nighters before exams usually backfire.',
   `Sleep helps the brain consolidate what you learned during the day, and being short on sleep makes it harder to concentrate and to recall information.

What to do:
- Keep regular sleep and wake times, especially in exam weeks.
- Avoid all-nighters. A tired brain concentrates and recalls worse.
- A short review in the evening, followed by a good night's sleep, is a reasonable habit.

If you often struggle to sleep, talk to a doctor or your university's health service.`],
  ['Motivation', 'Starting is the hardest part',
   'You do not need to feel motivated first. Begin with a task small enough to finish in five minutes.',
   `Many students wait until they feel motivated before they start. In practice, motivation often follows action: once you begin, continuing gets easier.

What to try:
- Pick one small task you can finish in five minutes, such as opening the notes and answering one question.
- Put your phone out of reach before you begin.
- Stop at a natural point and note where you will start next time.

This is practical advice rather than a rule, so adjust it to what works for you.`],
  ['Exam stress', 'A short routine for exam-day nerves',
   'Simple habits, such as slow breathing and a night-before checklist, can take the edge off exam nerves.',
   `Feeling nervous before an exam is common. A short routine can help you feel steadier.

What to try:
- The night before, pack your things and check the exam time and place, so there is nothing left to worry about.
- Before the exam, breathe slowly, making your out-breath a little longer than your in-breath. Many people find this calming.
- If your mind goes blank, skip to a question you can answer and come back later.

If exam stress is affecting your sleep, health or studies, please talk to a university counselor or a doctor.`],
];

(async () => {
  try {
    const admin = await db.query("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1");
    if (!admin.rows[0]) {
      console.log('Create an admin first: npm run create-admin -- "Name" email "password"');
      return;
    }
    const n = await db.query('SELECT COUNT(*)::int AS n FROM posts');
    if (n.rows[0].n > 0) {
      console.log('Articles already exist. Nothing to do.');
      return;
    }
    for (const [cat, title, summary, body] of ARTICLES) {
      const c = await db.query('SELECT id FROM categories WHERE name = $1', [cat]);
      await db.query(
        `INSERT INTO posts (author_id, category_id, type, title, summary, body, status, reviewed_by, reviewed_at)
         VALUES ($1, $2, 'original', $3, $4, $5, 'published', $1, now())`,
        [admin.rows[0].id, c.rows[0] ? c.rows[0].id : null, title, summary, body]
      );
    }
    console.log('Starter articles added.');
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
