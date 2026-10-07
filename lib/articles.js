// Shared helpers for articles: category list and form validation.
const db = require('../db');

async function categories() {
  return (await db.query('SELECT id, name FROM categories ORDER BY id')).rows;
}

// Checks article form input. Returns { errors, values }. lockedType is used when editing.
function parseArticle(body, cats, lockedType) {
  const v = {
    type: lockedType || (body.type === 'external' ? 'external' : 'original'),
    title: (body.title || '').trim(),
    summary: (body.summary || '').trim(),
    category_id: parseInt(body.category_id, 10) || null,
    body: (body.body || '').trim(),
    source_name: (body.source_name || '').trim(),
    source_url: (body.source_url || '').trim(),
  };
  const e = [];
  if (v.title.length < 5 || v.title.length > 200) e.push('Title must be 5 to 200 characters.');
  if (v.summary.length < 10 || v.summary.length > 300) e.push('Summary must be 10 to 300 characters.');
  if (!cats.some((c) => c.id === v.category_id)) e.push('Choose a category.');
  if (v.type === 'original') {
    if (v.body.length < 50 || v.body.length > 20000) e.push('Article text must be 50 to 20,000 characters.');
    v.source_name = null;
    v.source_url = null;
  } else {
    if (v.source_name.length < 2 || v.source_name.length > 150) e.push('Enter the source name (2 to 150 characters).');
    if (!/^https?:\/\/\S+$/i.test(v.source_url) || v.source_url.length > 2000) e.push('Enter a valid link starting with http:// or https://');
    v.body = null;
  }
  return { errors: e, values: v };
}

module.exports = { categories, parseArticle };
