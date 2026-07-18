<div align="center">

# AstraBlog

**A reusable, self-hostable framework for long-form writing, short updates, and reader conversations.**

[English](./README.md) · [简体中文](./README.zh-CN.md)

![AstraBlog social preview](./public/og.png)

</div>

AstraBlog is a full-stack blog framework built with Next.js 16, React 19,
Neon PostgreSQL, Drizzle ORM, and Better Auth.

## Highlights

| Area | Included |
| --- | --- |
| Publishing | Notes, short-form Chat posts, custom pages, drafts, scheduling, revisions, pinning, and featured status |
| Discovery | Full-text archive search, category/tag filters, pagination, RSS, sitemap, robots rules, canonical URLs, Open Graph, and JSON-LD |
| Writing | Markdown source, sanitized HTML, GitHub-flavored Markdown, Shiki code highlighting, generated table of contents, and reading time |
| Community | Registration, email verification, account profiles, nested comments, moderation, reports, and an authenticated Guestbook |
| Studio | Role-gated dashboard, editors, taxonomy management, comment moderation, and an R2-backed media library |
| Reuse | Central site configuration, environment-driven branding, custom page routes, portable schema, and documented deployment boundaries |

## Technology stack

| Layer | Technology |
| --- | --- |
| Application | Next.js 16 App Router, React 19, TypeScript |
| Styling | Tailwind CSS 4 with project-owned typography and design tokens |
| Data | Neon PostgreSQL, Drizzle ORM, Drizzle Kit |
| Authentication | Better Auth with email/password, username, and admin plugins |
| Content | Unified, Remark, Rehype, Shiki |
| Media | Cloudflare R2 through the S3-compatible API |
| Email | Resend, with console delivery for local development |
| Testing | Vitest and Playwright |

## Project structure

```text
src/
├─ actions/               Server actions for posts, taxonomy, comments, and users
├─ app/
│  ├─ notes/              Note archive and article pages
│  ├─ categories/         Public category archives
│  ├─ tags/               Public tag archives
│  ├─ chat/               Short-form publishing timeline
│  ├─ guestbook/          Authenticated public message wall
│  ├─ studio/             Owner/admin publishing workspace
│  ├─ account/            Member account surface
│  ├─ auth/               Authentication flows
│  ├─ api/                Auth, media, and scheduled publishing endpoints
│  └─ [slug]/             Database-backed custom public pages
├─ components/            Content, comments, editor, auth, and Studio components
├─ config/site.ts         Central site identity and navigation configuration
├─ db/                    Schema, relations, query client, and transactions
└─ lib/                   Auth, content queries, Markdown, email, and R2 utilities

drizzle/                  Versioned database migration artifacts
scripts/                  Seeding, owner promotion, and media maintenance tools
tests-e2e/                Playwright browser tests
```

## Requirements

- Node.js `20.9.0` or newer
- npm
- A Neon PostgreSQL database for persistent content and authentication
- Optional Resend and Cloudflare R2 accounts for production email and media

The public shell can render without a configured database. Database-backed
archives, authentication, comments, Guestbook, and Studio require PostgreSQL.

## Quick start

1. Install dependencies.

   ```bash
   npm install
   ```

2. Create the local environment file.

   ```powershell
   # PowerShell
   Copy-Item .env.example .env.local
   ```

   ```bash
   # macOS / Linux
   cp .env.example .env.local
   ```

3. Configure at least these values in `.env.local`.

   ```dotenv
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   DATABASE_URL=postgresql://...
   DATABASE_URL_DIRECT=postgresql://...
   BETTER_AUTH_URL=http://localhost:3000
   BETTER_AUTH_SECRET=replace-with-a-random-secret-of-at-least-32-characters
   DEV_EMAIL_MODE=console
   ```

4. Apply the database schema.

   ```bash
   npm run db:push
   ```

5. Start the development server.

   ```bash
   npm run dev
   ```

6. Open `http://localhost:3000`.

## Create the first owner

For an account that can sign in normally, register through `/auth/register`
first. With `DEV_EMAIL_MODE=console`, the verification URL is printed in the
server terminal.

After registration, promote that existing account:

```bash
npm run owner -- owner@example.com owner_username
```

Then sign in and open `/studio/dashboard`. The command refuses to silently
create a second owner.

`npm run seed` is optional. It creates reusable sample categories, tags, notes,
comments, and a development identity. Use it for demos or local exploration,
not as a substitute for registering the real owner account.

## Environment configuration

Start from [`.env.example`](./.env.example).

### Site identity

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Production | Canonical origin used by metadata, RSS, sitemap, and robots rules |
| `NEXT_PUBLIC_SITE_NAME` | No | Full site name; defaults to `AstraBlog` |
| `NEXT_PUBLIC_SITE_WORDMARK` | No | Header/footer wordmark |
| `NEXT_PUBLIC_SITE_OWNER` | No | Public author/owner name |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | No | Primary description and discovery copy |
| `NEXT_PUBLIC_SITE_DESCRIPTION_ZH` | No | Secondary home-page description |
| `NEXT_PUBLIC_SITE_LOCALE` | No | HTML and date locale |
| `NEXT_PUBLIC_SITE_LANGUAGE` | No | RSS language value |
| `NEXT_PUBLIC_POSTS_PER_PAGE` | No | Archive page size; defaults to `12` |
| `NEXT_PUBLIC_CONTACT_EMAIL` | No | Public contact email; omitted values stay hidden |
| `NEXT_PUBLIC_GITHUB_URL` | No | Public GitHub profile URL |
| `NEXT_PUBLIC_X_URL` | No | Public X/Twitter profile URL |

### Database and authentication

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon serverless runtime connection |
| `DATABASE_URL_DIRECT` | Yes | Direct connection used by Drizzle Kit |
| `BETTER_AUTH_URL` | Yes | Public authentication origin |
| `BETTER_AUTH_SECRET` | Yes | Session/authentication signing secret |

### Email, media, and automation

| Variable | Required | Purpose |
| --- | --- | --- |
| `DEV_EMAIL_MODE` | Local | Set to `console` to print verification/reset links |
| `RESEND_API_KEY` | Optional | Enables real transactional email |
| `EMAIL_FROM` | Optional | Verified sender identity |
| `R2_ACCOUNT_ID` | Media | Cloudflare account identifier |
| `R2_ACCESS_KEY_ID` | Media | R2 S3-compatible access key |
| `R2_SECRET_ACCESS_KEY` | Media | R2 S3-compatible secret |
| `R2_BUCKET` | Media | R2 bucket name |
| `R2_PUBLIC_BASE_URL` | Media | Public asset origin used in Markdown URLs |
| `CRON_SECRET` | Scheduling | Bearer token protecting scheduled publishing |

## Content and routes

### Public routes

| Route | Purpose |
| --- | --- |
| `/` | Configurable home/index page |
| `/notes` | Searchable, filterable, paginated note archive |
| `/notes/[slug]` | Long-form article with TOC, metadata, tags, and comments |
| `/categories/[slug]` | Category archive |
| `/tags/[slug]` | Tag archive |
| `/chat` | Short-form post timeline |
| `/guestbook` | Authenticated message wall |
| `/about` | Configurable about/contact page |
| `/[slug]` | Published custom page created in Studio |
| `/feed.xml` | RSS 2.0 feed |
| `/sitemap.xml` | Static and database-backed discovery URLs |

### Studio routes

| Route | Purpose |
| --- | --- |
| `/studio/dashboard` | Publishing overview |
| `/studio/notes` | All content records |
| `/studio/chat` | Chat post management |
| `/studio/pages` | Custom page management |
| `/studio/categories` | Category management |
| `/studio/tags` | Tag management |
| `/studio/media` | R2 image upload and Markdown reference copying |
| `/studio/comments` | Comment moderation |

Custom pages cannot claim framework routes. Reserved top-level slugs include
`notes`, `chat`, `guestbook`, `about`, `studio`, `account`, `auth`, `api`,
`categories`, and `tags`.

## Publishing workflow

1. Create categories and tags in Studio.
2. Create a note, Chat post, or custom page.
3. Edit Markdown with live sanitized preview.
4. Draft changes auto-save with optimistic revision checks.
5. Publish immediately or select a scheduled release time.

To publish scheduled content, configure the hosting scheduler to call:

```http
GET /api/cron/publish
Authorization: Bearer <CRON_SECRET>
```

The endpoint fails closed when `CRON_SECRET` is missing.

## Media uploads

Configure all `R2_*` variables to enable Studio uploads. The bucket CORS policy
must allow browser `PUT` requests from the site origin and the content types
`image/jpeg`, `image/png`, `image/webp`, and `image/avif`.

The current upload limits are 10 MB for content images and 2 MB for avatars.
Studio verifies uploaded objects before marking media records as ready.

## Rebrand without changing the visual system

- Change public identity through `.env.local`.
- Edit navigation and footer technology labels in `src/config/site.ts`.
- Edit color and typography tokens at the top of `src/app/globals.css`.
- Replace `public/og.png` with a `1.91:1` landscape social card after changing
  the wordmark or description.

The default art direction is encoded in reusable tokens and content primitives,
so rebranding does not require rewriting page components.

## Database workflow

For rapid local iteration:

```bash
npm run db:push
```

For reviewed production migrations:

```bash
npm run db:generate
npm run db:migrate
```

Inspect the generated SQL under `drizzle/` before applying it to production.

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production Next.js build |
| `npm start` | Run the production server |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm run lint` | Check the repository with Biome |
| `npm run format` | Format supported files with Biome |
| `npm test` | Run Vitest tests once |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run db:push` | Push the current schema during development |
| `npm run db:generate` | Generate a reviewed migration |
| `npm run db:migrate` | Apply generated migrations |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run seed` | Create reusable sample data |
| `npm run owner -- <email> <username>` | Create or promote the single owner |

## Validation

Run the full local quality gate before deployment:

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

Playwright tests require a configured, running test environment:

```bash
npm run test:e2e
```

## Deployment

AstraBlog currently produces the standard Next.js Node.js output. Deploy it to
a host that supports the Next.js server runtime, configure the same environment
variables there, apply database migrations, and set the scheduled publishing
request if needed.

For Vercel, `vercel.json` invokes `/api/cron/publish` once per day at 00:00 UTC,
which is compatible with the Hobby scheduling limit. Paid plans can change the
cron expression to run more frequently. Set `CRON_SECRET` in the Vercel project;
Vercel sends it to the route as a Bearer token automatically.

The repository does not currently include `.openai/hosting.json` or a
Cloudflare Worker-compatible server bundle. Add an adapter before targeting a
Workers-only platform; do not treat the standard `.next` output as a Worker
deployment artifact.

## Security notes

- Public Markdown is sanitized before stored HTML is rendered.
- Studio mutations enforce active, verified owner/admin sessions server-side.
- Comment actions enforce verification, moderation status, and ownership rules.
- Media endpoints verify role, MIME type, size, object ownership, and storage
  object existence.
- Scheduled publishing requires `CRON_SECRET` and refuses to run without it.
- Never commit `.env.local`, database URLs, authentication secrets, Resend keys,
  R2 credentials, or generated repository credentials.
