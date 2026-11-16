# Professor Ofoefule — self-service editor setup

This change adds a private dashboard at **https://profofoefule.online/dashboard** for:
- Editing the academic biography, leadership, roles, mentorship and fellowships.
- Creating/editing/publishing books and book chapters; uploading approved covers, previews and PDFs.
- Creating/editing/publishing research articles by DOI, journal link or authorized uploaded PDF.

The public site remains readable as static HTML when database storage is not set up. No payment gateway or public sign-up is added. **Dashboard editing fails closed** until Access, D1 and (for file uploads) R2 are configured.

## Do not deploy before preflight

1. Review and test the branch in an isolated Cloudflare preview, not by overwriting the live Worker.
2. Keep the existing Worker named `profofoefule` and keep its existing custom domain. The config intentionally preserves static assets under `site/`.
3. The dashboard is not protected by a front-end password; authorization is enforced by the Worker using Cloudflare Access-signed JWTs and an allowlisted identity. Do not store passwords, access tokens or personal data in GitHub.
4. Do not turn on global Worker Access for the entire site: visitors need to access the public homepage and library.

## Set up D1 / R2

In Cloudflare, create a D1 database (suggested name `profofoefule-books`) and, if PDF/cover uploads are needed, an R2 bucket (suggested `profofoefule-book-files`). Keep the real IDs in your account, not in chat.

Add the following entries to the existing **root** `wrangler.jsonc`, replacing `ACTUAL_D1_DATABASE_ID` after creation:

```json
{
  "d1_databases": [{
    "binding": "DB",
    "database_name": "profofoefule-books",
    "database_id": "ACTUAL_D1_DATABASE_ID",
    "migrations_dir": "migrations"
  }],
  "r2_buckets": [{
    "binding": "BOOK_FILES",
    "bucket_name": "profofoefule-book-files"
  }]
}
```

**Merge these keys** into the existing object. Do not replace the rest of the configuration. Use your actual resource names/IDs; omit the R2 array if you only need text-only editing.

Run migrations against the correct new database (or use your migration workflow):

```bash
npx wrangler d1 migrations apply profofoefule-books --local
npx wrangler d1 migrations apply profofoefule-books --remote
```

The migrations are additive: `0001_books.sql`, then `0002_editor.sql`. Test in preview/staging before applying remote migrations to the live database. Keep a database backup before enabling production writes.

## Protect editor routes with Cloudflare Zero Trust Access

1. Under **Zero Trust → Access → Applications**, create a self-hosted Access application for the administrative routes on `profofoefule.online`. Protect **`/dashboard*`**, **`/admin*`** and **`/api/admin/*`** using one application's audience where supported. If using separate applications, configure the Worker to validate each relevant audience rather than bypassing authentication. Do not protect all of `profofoefule.online`.
2. Allow only Professor Ofoefule's **verified** login email and explicitly authorized co-editors.
3. In the Worker **Settings → Variables and Secrets**, supply:
   - `CF_ACCESS_TEAM_DOMAIN`: the actual `<team>.cloudflareaccess.com` issuing domain, without guessing.
   - `CF_ACCESS_AUD`: that Access application's verified audience tag.
   - `ADMIN_EMAILS`: comma-separated verified editor email addresses, including the professor's preferred login email.
4. Store these as **secrets**, not in the Git repository. Verify Access JWT audience, signature and allowed email before enabling.
5. Confirm that logged-out visits to `/dashboard`, `/dashboard.html`, `/admin.html` and `/api/admin/profile` are denied on both custom domain and `workers.dev`. The app enforces this at the Worker layer as a second check, independent of a matching Access application rule.

References:
- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/d1/
- https://developers.cloudflare.com/r2/

## Validation sequence

```bash
node --experimental-default-type=module --test tests/editor.test.mjs
npx wrangler deploy --dry-run
```

In a staging Worker with real nonproduction D1/R2 bindings:
1. Confirm home, `/profile`, `/publications`, `/books` and assets still load normally.
2. With no login, check `/dashboard` and `/api/admin/session` deny access.
3. With the authorized email, sign in and open `/dashboard`; the status should say **Secure publishing connected**.
4. Change one biography paragraph, save, and refresh the public profile; the text should reflect the saved value.
5. Save an article **Draft**; verify it is not publicly listed. Publish it using a DOI/link and verify it appears on the publications page. Upload a PDF only with distribution permission.
6. Save a book as Draft, then Published, upload its cover and preview, and verify it appears in the public library.
7. Test that uploaded full PDFs are **not** accessible unless published and explicitly marked authorized free edition.
8. Confirm that existing source-linked publications and static fallback biography remain readable during a DB outage.
9. Check Worker logs for any error; rollback to the previously known-good Worker version if public pages regress.

## Editorial scope

The dashboard edits the biography content blocks on `profile.html`. Its book and article forms manage **new database records**; the six historical articles already embedded in static HTML remain unchanged and are not silently overwritten. Additional editorial sections can be added after the professor approves the workflow. Site assets remain public, but dashboard HTML and all admin APIs are restricted by the Worker.

The professor's login email must be confirmed by the operator; no new identity, credentials, database, R2 bucket or Cloudflare Access policy is created by merging this branch alone.
