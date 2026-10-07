// Database connection: one shared pool used by every route.
require('dotenv').config();
const { Pool } = require('pg');

const url = process.env.DATABASE_URL || '';
const isLocal = /localhost|127\.0\.0\.1/.test(url);

const pool = new Pool({
  connectionString: url,
  ssl: url && !isLocal ? { rejectUnauthorized: false } : false, // Neon/Render need SSL
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
