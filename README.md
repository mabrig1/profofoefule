# Prof. Sabinus Ifeanyi Ofoefule — Portfolio & Book Publishing Site

**Domain planned:** `profofoefule.online`  
**Status:** Finished, locally tested starter website; **not deployed or connected to DNS**.  
**Date:** 12 November 2026

This is an original, lightweight, mobile-friendly academic portfolio and an extensible book publishing catalogue. All web pages are inside `site/`. No build tools are required for the public website.

## What is included

- `site/index.html` — premium academic homepage, research areas, milestones, selected publications and contact.
- `site/books.html` — searchable and filterable book catalogue; safely empty until book titles are verified.
- `site/book.html` — book detail pages (generated from catalogue data), editions, ISBN, sample PDF, authorized free PDF or external purchase link.
- `site/publications.html` — selected source-linked research articles and book chapters.
- `site/admin.html` — editorial book management with draft/publish status, metadata editing, catalogue export/import, and file uploads when configured with cloud storage.
- `site/data/books.json` — static published-book source (currently `[]`).
- `worker/index.js` + `migrations/0001_books.sql` — optional Cloudflare Worker API with D1 metadata and R2 ebook/cover storage.
- `wrangler.template.toml` — cloud configuration template (not a completed deployment config).
- `docs/PUBLISHING_GUIDE.md` — how to add books and prepare rights/permissions.

## Quick local preview

```bash
cd site
python3 -m http.server 8000
```

Open `http://localhost:8000/` in a browser. Visit `http://localhost:8000/admin.html` to add **local draft** records. Local draft mode saves to your own browser storage only; it is **not** a secure public administrator login and it does not publish changes to the live site.

To publish local-mode entries:

1. Verify the book's title, authors, publisher, ISBN, rights, and summary.
2. In `admin.html`, save the entry with **Published** status.
3. Click **Export public catalogue** to download `books.json`.
4. Replace `site/data/books.json` with the downloaded file.
5. Add approved cover URLs. For locally hosted file assets, add files under `site/assets/` and use `assets/filename.jpg` in the book record (the web form accepts a URL/path; use a root-relative path such as `/assets/filename.jpg` where applicable).
6. Redeploy **only `site/`** to your static host.

**Important:** local-mode file upload is intentionally disabled. Use the Worker publishing backend below if you need editor-uploaded PDF and cover files without manually redeploying.

## First deployment — Cloudflare Pages (simple static version)

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/) and create a new **Pages** project.
2. Choose **Direct Upload** of the `site/` directory, or connect the repository with no build command and output directory `site`.
3. Verify that the assigned `<project>.pages.dev` URL loads the homepage, library, publications, and editorial page.
4. In the Pages project, choose **Custom domains → Set up a domain**, enter `profofoefule.online`.
5. Because `profofoefule.online` is the **apex/root domain**, Cloudflare Pages requires the domain added as a Cloudflare zone with nameservers pointing to Cloudflare. Cloudflare will show the exact nameservers. **Do not guess them.** In Namecheap Domain List → Manage → Nameservers, enter the two actual nameservers provided by Cloudflare **only after** reviewing the existing DNS records.
6. Before changing nameservers, copy across email MX, SPF, DKIM, DMARC and any existing A/CNAME/TXT records that need to keep working. Changing nameservers without this can interrupt email and other sites.
7. Confirm HTTPS and both root and `www` behavior after the domain becomes active. Do not make false claims that the domain is live before testing it.

Current docs: https://developers.cloudflare.com/pages/configuration/custom-domains/

The static site can be deployed to Vercel instead (set root directory to `site` and framework to **Other / Static**). The Worker API described below is designed for Cloudflare, not automatically hosted on Vercel.

## Upgrade to real browser-based publishing — Cloudflare Worker + D1 + R2

The optional Worker makes `admin.html` a connected editor. It uses **Cloudflare Access JWT verification** plus an explicit allowed-editor list and **fails closed** if any required security settings are missing. No unsecured admin password is included.

**Preflight prerequisites:** Cloudflare account with Workers, D1, R2 and Zero Trust Access; control of an active domain; a reviewed set of book permissions. The following CLI commands are examples to run in your own authorized account, not actions that have been executed.

```bash
npm install -g wrangler
wrangler login
wrangler d1 create profofoefule-books
wrangler r2 bucket create profofoefule-book-files
cp wrangler.template.toml wrangler.toml
```

Edit `wrangler.toml`: replace the placeholder `database_id` with the ID printed by `wrangler d1 create`, verify the R2 bucket name, and keep `assets.directory = "./site"`. Apply the included new-database migration and run a nonproduction validation before publishing:

```bash
wrangler d1 migrations apply profofoefule-books --remote
wrangler deploy --dry-run
```

Set up one **Cloudflare Access self-hosted application** whose allowed hostnames/paths protect the publishing studio at `profofoefule.online/admin.html` and the publishing endpoints at `profofoefule.online/api/admin/*` (use one Access application / audience when possible). Allow only your approved publishing emails. Add these **secret environment variables** to the Worker (no API key values or emails committed to Git):

- `CF_ACCESS_TEAM_DOMAIN` — your `team.cloudflareaccess.com` domain.
- `CF_ACCESS_AUD` — the exact Access application audience tag for the API endpoints.
- `ADMIN_EMAILS` — comma-separated editor emails whose verified Access JWTs are accepted.

Use `wrangler secret put <VARIABLE_NAME>` or Cloudflare's secret settings. When enabling the backend, test the protected endpoints in a **preview environment** first. A valid JWT **plus** an allowlisted email is required for all `/api/admin/*` endpoints; a request without it returns `401`/`403`/`503` and cannot write records. Access policy setup must precede use of the live studio.

For live publishing, deploy `wrangler.toml` (after configuration) using your normal approval process. The worker serves static pages with Worker Assets, stores metadata in D1 and authorized cover/sample/ebook files in private R2. Public file access is granted only when a published record references it. This project does **not** create access policies or provision resources itself.

Docs:
- Worker static assets: https://developers.cloudflare.com/workers/static-assets/binding/
- Cloudflare Access for Workers: https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- Cloudflare D1: https://developers.cloudflare.com/d1/
- Cloudflare R2: https://developers.cloudflare.com/r2/

**Do not simultaneously point the same root domain to Pages and a Worker.** Choose either static Pages hosting now, or Worker Assets + D1/R2 when backend publishing is ready; migrate deliberately.

## Publishing controls and security

- Books remain in **draft** status until explicitly published.
- Every published book must have a real publisher and verified metadata.
- Only licensed covers and authorized PDFs may be uploaded; never upload full published texts without the copyright holder's permission.
- `metadata` rights mode prevents hosted PDF uploads. `authorized` rights mode is required for PDF files.
- Full PDF uploads are **not public** unless the book is published and marked `Authorized free download`.
- External purchase links lead to the author's/publisher's designated external storefront. **This starter does not collect payments or process orders.** Payment integration requires separate merchant setup and terms.
- The Worker verifies JWT signatures and claims; access is not provided by a hard-coded token, default password, or browser localStorage.
- The public site exposes a link to the studio; configure Access before making cloud editing live.
- For publication compliance, prepare a privacy policy, rights policy and any refund/return terms if paid sales are enabled later.

## Academic content and approval

The biography and milestones are derived from official UNN, University of Port Harcourt and NUC sources; some leadership posts may be historical. “150+ publications” and “4 books” are **university-reported historical counts**, not newly audited current metrics.

The editorial team should confirm:

- current administrative position and approved full CV;
- proper portrait file and permission to publish it;
- official book titles, cover art, contributor lists, publishers, ISBNs, and copyright status;
- preferred professional contact details and domain authorization;
- all publication metadata before making the draft public.

No unverified book titles or imaginary awards are included. The hero uses an original typographic monogram illustration until an approved professor photograph is provided. Do not replace it with an AI-generated likeness presented as a real portrait.

## Manual check performed during creation

- Static page structure generated for 5 pages, CSS, metadata, mobile navigation, book catalogue, book detail and studio.
- JavaScript syntax-checked with Node.js, static HTML preview rendered locally.
- Publication links and administrative safety behaviors were reviewed.
- No DNS, registrar account, Cloudflare dashboard, production database, Vercel or payments were changed.

## Quick deployment checklist

- [ ] Professor reviews and approves biography, headshot and contact.
- [ ] Test homepage, mobile menu, research links, publications and book catalogue.
- [ ] Add the first real book and verify rights to preview/full PDF.
- [ ] Choose **static** or **Worker-backed** hosting.
- [ ] Protect editor access before enabling cloud writes.
- [ ] Connect registered domain and verify HTTPS.
- [ ] Add privacy, copyright, and sales terms appropriate to how books are offered.
- [ ] Test public book links, PDF access boundaries and rollback.
