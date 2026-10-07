# StudentMind

A psychology website for university students. Visitors and members take short self-assessment tests (personality, exam stress, procrastination, career interests), get a result with study tips, and read articles in a Learn section. Anyone with an account can submit an article; an admin reviews it before it is published.

Built for the Web Application Development lab final project.

**Live site:** https://studentmind.onrender.com

> StudentMind is for education and self-awareness. It does not diagnose or treat any condition.

## Features

**Visitor (no login)**
- Home, About and Contact pages
- Browse and read published articles, with search and category filter
- Take any test and see the result (not saved)

**Member (registered user)**
- Register, log in, log out, edit profile and password
- Take tests and save results; dashboard with result history
- Write articles (original, or a link to an article elsewhere with credit to the source)
- My articles page showing Pending, Published or Rejected, with the admin's reason
- Comment on articles, delete own comments, bookmark articles

**Admin**
- Review queue: approve or reject submitted articles
- Articles: create, edit, unpublish, publish, delete
- Tests and questions: create tests, edit details, publish or hide, add, edit and delete statements
- Messages inbox for the contact form
- Dashboard counters read from the database

## Technologies

| Part | Technology |
|---|---|
| Front end | HTML, CSS, JavaScript, EJS templates |
| Back end | Node.js, Express |
| Database | PostgreSQL (Neon) |
| Sessions | express-session with a PostgreSQL session store |
| Security | bcryptjs password hashing, CSRF tokens, Helmet security headers, rate limiting |
| Hosting | Render (app) and Neon (database) |

## System design

```
Browser  <-->  Express app (routes, middleware, EJS views)  <-->  PostgreSQL
```

- `routes/` handles requests, `middleware/auth.js` loads the user and enforces roles, `lib/scoring.js` turns answers into scores.
- Scoring happens on the server, so results cannot be changed from the browser.
- Articles are only shown publicly when `status = 'published'`. Pending and rejected articles are visible only to their author and admins.

## Database tables

`users`, `tests`, `questions`, `results`, `categories`, `posts`, `comments`, `bookmarks`, `mood_logs` (reserved for a future feature), `contact_messages`. The full schema is in `db/schema.sql`.

## Run it yourself

Requires Node.js 18+ and a PostgreSQL database (a free Neon database works).

```bash
npm install
cp .env.example .env        # then fill in DATABASE_URL and SESSION_SECRET
npm run db:init             # creates the tables
npm run db:seed             # adds the test statements and starter articles
npm run create-admin -- "Your Name" you@example.com "a-strong-password"
npm run dev                 # http://localhost:3000
```

### Environment variables

| Name | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Long random string used to sign login cookies (required in production) |
| `NODE_ENV` | Set to `production` when deployed |
| `PORT` | Set automatically by most hosts |

Never commit `.env`. It is listed in `.gitignore`.

## Folder structure

```
server.js            app setup, sessions, CSRF, routes
db.js                database connection
db/                  schema.sql and test statements
lib/                 scoring and article validation
middleware/          login and role checks
routes/              auth, tests, articles, admin, pages, account
views/               EJS pages and partials
public/              CSS and browser JavaScript
scripts/             database setup, seeding, create-admin
```

## Sources and limits

- The Big Five test uses 20 statements based on the Mini-IPIP (Donnellan et al., 2006), taken from the public-domain IPIP item pool.
- The exam stress, procrastination and career interest tests are informal self-checks written for this project. They are not validated clinical scales.
- The starter articles are short summaries of well-known study ideas and should be read as general advice.

## Future improvements

- Mood and study-hours journal (the `mood_logs` table is ready)
- Progress charts across repeated tests
- Email verification and password reset
- Editing of submitted articles by their authors
- Automated tests
