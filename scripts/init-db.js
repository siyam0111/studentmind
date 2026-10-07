// Creates all tables from db/schema.sql. Safe to run once on an empty database.
const fs = require('fs');
const path = require('path');
const db = require('../db');

(async () => {
  try {
    const exists = await db.query("SELECT to_regclass('public.users') AS t");
    if (exists.rows[0].t) {
      console.log('Tables already exist. Nothing to do.');
    } else {
      await db.query(fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'));
      console.log('Database tables created.');
    }
  } catch (err) {
    console.error('Database setup failed:', err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
