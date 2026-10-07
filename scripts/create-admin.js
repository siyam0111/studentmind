// Creates (or promotes) an admin account.
// Usage: npm run create-admin -- "Full Name" email@example.com "a-strong-password"
const bcrypt = require('bcryptjs');
const db = require('../db');

const [name, email, password] = process.argv.slice(2);
if (!name || !email || !password) {
  console.log('Usage: npm run create-admin -- "Full Name" email@example.com "a-strong-password"');
  process.exit(1);
}

(async () => {
  try {
    if (password.length < 8) throw new Error('Password must be at least 8 characters.');
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email) DO UPDATE SET role = 'admin', password_hash = EXCLUDED.password_hash`,
      [name, email.toLowerCase(), hash]
    );
    console.log('Admin account ready:', email.toLowerCase());
  } catch (err) {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
