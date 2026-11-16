-- Apply after 0001_books.sql to the SAME D1 database.
CREATE TABLE IF NOT EXISTS academic_profile (
 id INTEGER PRIMARY KEY CHECK(id = 1),
 content TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS articles (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 authors TEXT NOT NULL,
 journal TEXT,
 abstract TEXT,
 doi TEXT,
 link_url TEXT,
 pdf_url TEXT,
 year INTEGER,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
 license TEXT NOT NULL DEFAULT 'metadata' CHECK(license IN ('metadata','authorized')),
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS articles_status_year_idx ON articles(status,year DESC);
