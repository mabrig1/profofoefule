CREATE TABLE IF NOT EXISTS books (
 id TEXT PRIMARY KEY,
 slug TEXT NOT NULL UNIQUE,
 title TEXT NOT NULL,
 author TEXT NOT NULL,
 summary TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
 type TEXT NOT NULL DEFAULT 'book' CHECK(type IN ('book','chapter')),
 license TEXT NOT NULL DEFAULT 'metadata' CHECK(license IN ('metadata','authorized')),
 access TEXT NOT NULL DEFAULT 'inquiry' CHECK(access IN ('free','external','inquiry')),
 year INTEGER,
 external_url TEXT,
 cover_url TEXT,
 sample_url TEXT,
 full_url TEXT,
 publisher TEXT,
 isbn TEXT,
 edition TEXT,
 format TEXT,
 category TEXT,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS books_status_year_idx ON books (status,year DESC);
