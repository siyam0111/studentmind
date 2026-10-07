require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const PgStore = require('connect-pg-simple')(session);
const db = require('./db');
const { loadUser } = require('./middleware/auth');

const isProd = process.env.NODE_ENV === 'production';
if (isProd && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET must be set in production');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1); // Render and Codespaces sit behind a proxy

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      fontSrc: ['https://fonts.gstatic.com'],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      formAction: ["'self'"],
    },
  },
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Sessions are stored in the database, so logins survive restarts.
app.use(session({
  store: new PgStore({ pool: db.pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'dev-only-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

app.use(loadUser);

// One-time messages ("Welcome back!") and CSRF protection for every form post.
app.use((req, res, next) => {
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.path = req.path;
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrf = req.session.csrf;
  if (req.method === 'POST' && req.body._csrf !== req.session.csrf) {
    return res.status(403).render('error', {
      title: 'Request not accepted',
      message: 'Your session expired. Go back, refresh the page and try again.',
    });
  }
  next();
});

app.get('/', async (req, res, next) => {
  try {
    const tests = await db.query(
      'SELECT id, slug, title, description FROM tests WHERE is_published ORDER BY id'
    );
    const posts = await db.query(
      `SELECT p.id, p.title, p.summary, p.type, p.source_name, c.name AS category
         FROM posts p LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.status = 'published'
        ORDER BY p.created_at DESC LIMIT 3`
    );
    res.render('home', { tests: tests.rows, posts: posts.rows });
  } catch (err) {
    next(err);
  }
});

app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true, db: 'connected' });
  } catch (err) {
    res.status(500).json({ ok: false, db: 'error' });
  }
});

app.use(require('./routes/auth'));
app.use(require('./routes/tests'));
app.use(require('./routes/account'));

app.use((req, res) => {
  res.status(404).render('error', { title: 'Page not found', message: 'We could not find that page.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'Something went wrong', message: 'Please try again in a moment.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`StudentMind running on http://localhost:${PORT}`));
