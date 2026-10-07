-- StudentMind database schema (PostgreSQL)
-- Run once on an empty database (Neon, Supabase, or local Postgres).

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,            -- bcrypt hash, never the password
  role          VARCHAR(10)  NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  department    VARCHAR(100),                     -- optional
  year          VARCHAR(20),                      -- optional
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE tests (
  id           SERIAL PRIMARY KEY,
  slug         VARCHAR(60)  NOT NULL UNIQUE,
  title        VARCHAR(150) NOT NULL,
  description  TEXT NOT NULL,
  kind         VARCHAR(12)  NOT NULL DEFAULT 'scale' CHECK (kind IN ('scale','bigfive')),
  is_published BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE questions (
  id        SERIAL PRIMARY KEY,
  test_id   INT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  text      TEXT NOT NULL,
  trait     CHAR(1) CHECK (trait IN ('O','C','E','A','N')),   -- Big Five only
  reversed  BOOLEAN NOT NULL DEFAULT false,                   -- reverse-scored item
  position  INT NOT NULL DEFAULT 0
);

CREATE TABLE results (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  test_id    INT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  scores     JSONB NOT NULL,                      -- e.g. {"O":75,"C":50,...} or {"total":61}
  summary    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE
);

CREATE TABLE posts (
  id            SERIAL PRIMARY KEY,
  author_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id   INT REFERENCES categories(id) ON DELETE SET NULL,
  type          VARCHAR(10) NOT NULL DEFAULT 'original' CHECK (type IN ('original','external')),
  title         VARCHAR(200) NOT NULL,
  summary       TEXT NOT NULL,
  body          TEXT,                              -- original articles
  source_name   VARCHAR(150),                      -- external links
  source_url    TEXT,
  status        VARCHAR(10) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('draft','pending','published','rejected')),
  reject_reason TEXT,
  reviewed_by   INT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (type <> 'external' OR (source_name IS NOT NULL AND source_url ~* '^https?://')),
  CHECK (type <> 'original' OR body IS NOT NULL)
);
CREATE INDEX posts_status_idx ON posts(status);

CREATE TABLE comments (
  id         SERIAL PRIMARY KEY,
  post_id    INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bookmarks (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE mood_logs (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mood        SMALLINT NOT NULL CHECK (mood BETWEEN 1 AND 5),
  study_hours NUMERIC(4,1) NOT NULL CHECK (study_hours BETWEEN 0 AND 24),
  logged_on   DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (user_id, logged_on)
);

CREATE TABLE contact_messages (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100),
  email      VARCHAR(255),
  message    TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Starter data
INSERT INTO categories (name) VALUES
  ('Study techniques'), ('Exam stress'), ('Motivation'), ('Sleep & focus'), ('Career');

INSERT INTO tests (slug, title, description, kind) VALUES
  ('big-five',      'Personality (Big Five)', 'Discover your five core traits and how they shape the way you study.', 'bigfive'),
  ('exam-stress',   'Exam stress check',      'Find out how much exam pressure is affecting you right now.', 'scale'),
  ('procrastination','Procrastination check', 'Learn why you delay work and what helps.', 'scale'),
  ('career-interest','Career interests',      'Match your interests to study fields and careers.', 'scale');

-- The first admin is created by a setup script (hashed password), not by SQL.
