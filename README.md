# AstraBlog

A personal site for long-form notes, short updates, reader conversations and a searchable cocktail notebook, sharing one Next.js application and database.

[English](./README.md) · [简体中文](./README.zh-CN.md) · [Bar setup guide (中文)](./docs/bar.md)

![AstraBlog preview](./public/og.png)

## Features

| Module | Included |
| --- | --- |
| Publishing | Notes, Chat posts, custom pages, Markdown editing, sanitized preview, image insertion, drafts, scheduling and revisions |
| Discovery | Archive search, categories, tags, pagination, RSS, sitemap and social metadata |
| Community | Registration, email verification, profiles, nested comments, moderation and Guestbook |
| Bar | Ingredient-based recipe filtering, search, quantities, steps, favorites and browser-local preferences |
| Studio | Content workspace, media library, moderation and Owner-only recipe/material/type-label management |

The home index links to Notes, Chat, Bar, Guestbook and About. The visual system uses a dark background, serif headings, thin borders and amber accents.

## Stack and requirements

- Next.js 16.2.10, React 19.2.4 and TypeScript
- Tailwind CSS 4; React Hook Form and Zod for recipe forms
- Neon PostgreSQL, Drizzle ORM and versioned SQL migrations
- Better Auth with member, admin and owner roles
- Cloudflare R2 for blog media; Resend for email
- Vitest and Playwright

Use Node.js 22.x or 24.x with npm. A Neon database is needed for content, authentication and Studio. Without `DATABASE_URL`, the public site can render empty states; this is not a fully configured installation.

## Quick start

### 1. Install

```sh
git clone https://github.com/Fox-yun/AstraBlog.git
cd AstraBlog
npm ci
```

Copy [`.env.example`](./.env.example) to `.env.local`:

```sh
# macOS / Linux
cp .env.example .env.local
```

```powershell
# PowerShell
Copy-Item .env.example .env.local
```

### 2. Configure

Fill in the runtime and migration connections from your Neon database:

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
DATABASE_URL=postgresql://your-neon-runtime-connection
DATABASE_URL_DIRECT=postgresql://your-neon-migration-connection
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=replace-with-a-random-secret-of-at-least-32-characters
DEV_EMAIL_MODE=console
```

Generate a secret locally, for example:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep credentials in environment variables, outside Git.

### 3. Initialize the database

For a new, empty database, apply the committed migrations:

```sh
node --env-file=.env.local node_modules/drizzle-kit/bin.cjs migrate
```

Next.js loads `.env.local` for the application, but the current Drizzle configuration reads process environment variables directly. This command explicitly loads the file; `npm run db:migrate` also works when those variables are already exported.

**Initialize the Bar with migrations, not `db:push` alone.** Its initial type labels, system ingredients, identity-protection trigger and route-conflict check are part of the SQL migration.

For an existing installation, back up the database and review its migration history first. If tables were originally created using `db:push`, reconcile the migration baseline before replaying the initial migration. The Bar migration stops if a custom page already occupies `/bar`; rename that page first. See [migration details](./docs/bar.md).

### 4. Run and register the owner

```sh
npm run dev
```

Open [localhost:3000](http://localhost:3000), register at `/auth/register`, and verify the account. In console email mode, the verification link appears in the server terminal.

Promote that registered account using its email and profile username:

```sh
node --env-file=.env.local --import tsx scripts/create-owner.ts owner@example.com owner_username
```

Sign in again and open `/studio/dashboard` or `/studio/bar`. Register first so the account has a password credential; the owner script does not create a login password. It refuses to silently introduce a different second owner.

`npm run seed` provides optional blog demo data and a development identity. Use it only in a disposable development database. It does not populate cocktail recipes.

## Cocktail notebook

The public `/bar` page loads published recipes and their referenced materials once. Selection, search, filters, favorites and recipe details then run in the browser.

| Behavior | Rule |
| --- | --- |
| Selected materials | Mean “I have these”; a recipe need not use every selection |
| Views | All ingredients available, at most one missing, or all recipes |
| Matching | Stable material IDs; repeated materials count once; optional garnish does not count as missing |
| Ice and drinking water | Always available; no tags or toggles, and excluded from the selected count |
| Soda and tonic water | Ordinary materials that must be selected explicitly |
| Search | Chinese/English recipe names, aliases, material names and aliases; every keyword must match |
| Details | Quantities, ordered steps, glassware, ice instructions, method, public notes and sources |
| Preferences | Selected materials, favorites and the chosen view stay in the current browser |

Material type labels are editable in Studio. Initial labels cover **gin, rum, whisky, vodka, tequila, brandy, liqueur, vermouth, bitters, juice, fruit, syrup, soda, dairy and other**, with Chinese display names. The Owner can add, rename, reorder and remove them. Move a label's materials elsewhere before deleting it. Switching types preserves selections from other types.

To publish a recipe:

1. Manage type labels at `/studio/bar/categories` and materials at `/studio/bar/ingredients`.
2. Create a recipe at `/studio/bar/new`, with numeric or descriptive quantities and ordered steps. Missing dictionary entries can be created inside the editor.
3. Save incomplete work as a draft, or complete the required fields and publish.
4. Find the recipe by selecting materials or searching at `/bar`.

Published recipes are updated directly by **“更新线上配方”**. To experiment separately, duplicate a recipe as a draft. Taking a recipe down archives it; restoring it returns it to draft. Atomic revision checks reject stale saves, and recipe/ingredient writes commit or roll back together.

Private notes remain in Owner-only editing, preview and backup data. Complete JSON exports include type labels, materials, recipes, ingredient rows and private notes. Keep them private; there is no public backup URL.

### JSON batch import and export

Open `/studio/bar` as the Owner. **“导出完整 JSON（含私人备注）”** downloads a complete backup. Under **“JSON 批量导入”**, select that file, review the counts and recipe names, then click **“确认导入为草稿”**. A failed import keeps the selected file for retry; success reports added and skipped records.

Import and export share the existing `formatVersion: 1` format, so previously exported files work directly. The top-level fields are `formatVersion`, `exportedAt`, `categories`, `ingredients`, `recipes` and `recipeIngredients`. Use the [complete JSON example](./docs/examples/bar-import.v1.json) when preparing a batch manually; replace example UUIDs for new records and keep references consistent.

| Import behavior | Rule |
| --- | --- |
| New recipes | Preserve recipe IDs, text, private notes, quantities and step/ingredient order; always create drafts, including previously published or archived recipes |
| Existing recipes | Skip matching IDs entirely, preserving current edits, status and revision; names alone do not identify duplicates |
| Type labels | Reuse matching IDs or exact names; add missing labels without editing existing ones |
| Materials | Reuse matching IDs or fixed `code` values and remap references; conflicting ID/code pairs fail the batch; `ice` and `water` use existing system records |
| Audit fields | Use the signed-in Owner and new timestamps; new recipes start at revision 1 with no publication time, and ingredient rows receive new IDs |
| Validation and failure | Require supported version, unique IDs, valid fields and references contained in the same file; all database writes commit or roll back together |
| Limits | UTF-8 JSON up to 5 MiB; at most 1,000 labels, 5,000 materials, 1,000 recipes and 80 ingredient rows per recipe per file |

After import, review drafts in Studio and publish them individually. No database migration is needed for the import feature; the existing Bar migration must already be applied. See [format details](./docs/bar.md#json-批量导入与导出) for optional audit fields and how to split large files.

V1 does not track remaining inventory, substitute ingredients automatically, synchronize preferences across devices or add recipe image uploads. “All ingredients available” checks material types, not glassware, tools or sufficient volume. Migrations initialize dictionaries, not sample drinks; the catalog stays empty until recipes are published.

See [Bar documentation](./docs/bar.md) for the four-table model, validation rules, backup format and integration tests.

## Routes and permissions

| Route | Purpose | Access |
| --- | --- | --- |
| `/` | Home index | Public |
| `/notes`, `/notes/[slug]` | Note archive and articles | Published content |
| `/chat`, `/about`, `/[slug]` | Short posts, about and custom pages | Published content |
| `/categories/[slug]`, `/tags/[slug]` | Blog taxonomy archives | Public |
| `/bar` | Cocktail notebook | Published recipes |
| `/guestbook` | Guestbook | Public reading; authenticated posting |
| `/account/profile` | Profile settings | Signed-in account |
| `/studio/dashboard`, `/studio/notes`, `/studio/chat`, `/studio/pages` | Publishing workspace | Admin / Owner |
| `/studio/categories`, `/studio/tags`, `/studio/media`, `/studio/comments` | Blog administration | Admin / Owner; some individual actions are Owner-only |
| `/studio/bar`, `/studio/bar/new`, `/studio/bar/[id]/edit` | Recipe management | Owner only |
| `/studio/bar/ingredients`, `/studio/bar/categories` | Materials and type labels | Owner only |
| `/feed.xml`, `/sitemap.xml`, `/robots.txt` | Discovery endpoints | Public |

Bar management queries, mutations, imports and exports independently verify the Owner session. Public data uses an explicit field whitelist: private notes, drafts and draft-only materials/types are excluded.

Blog categories/tags and Bar material types are separate dictionaries. Reserved custom-page route names, including `bar`, are defined in [site.ts](./src/config/site.ts).

## Environment and customization

Use [`.env.example`](./.env.example) as the complete template.

| Variables | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL`, `BETTER_AUTH_URL` | Deployed site and authentication origins |
| `DATABASE_URL`, `DATABASE_URL_DIRECT`, `BETTER_AUTH_SECRET` | Runtime/migration connections and private auth secret |
| `NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_SITE_WORDMARK`, `NEXT_PUBLIC_SITE_OWNER` | Site identity |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | Site description used in metadata |
| `NEXT_PUBLIC_SITE_LOCALE`, `NEXT_PUBLIC_SITE_LANGUAGE`, `NEXT_PUBLIC_POSTS_PER_PAGE` | Locale, RSS language and archive size |
| `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_GITHUB_URL`, `NEXT_PUBLIC_X_URL` | Optional public contact links |
| `DEV_EMAIL_MODE`, `RESEND_API_KEY`, `EMAIL_FROM` | Console email or Resend delivery |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` | Blog image storage and public asset origin |
| `CRON_SECRET` | Bearer secret for scheduled publishing |

For real email delivery, configure Resend with a verified sender and remove `DEV_EMAIL_MODE=console`. Without an API key, links are logged instead of delivered.

For media uploads, configure all `R2_*` values and bucket CORS to allow browser `PUT` requests from the site origin. Supported images are JPEG, PNG, WebP and AVIF; limits are 10 MB for content images and 2 MB for avatars.

Edit navigation/home-index entries in [src/config/site.ts](./src/config/site.ts), and shared color/typography tokens in [src/app/globals.css](./src/app/globals.css).

## Development and verification

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | TypeScript checks |
| `npm test` | Vitest tests |
| `npm run test:e2e` | Playwright tests against a running site at `localhost:3000` |
| `npm run db:generate` | Generate SQL after a schema change; review before applying |
| `npm run db:migrate` | Apply committed migrations with connection variables already exported |
| `npm run db:studio` | Database browser |
| `npm run owner -- <email> <username>` | Promote the registered owner |
| `npm run seed` | Optional blog demo data |

Run type checks, Vitest and a production build before deployment. For browser tests, install Chromium with `npx playwright install chromium`, start `npm run dev` in another terminal, then run `npm run test:e2e`.

The optional Bar PostgreSQL suite uses an isolated PGlite runtime when `BAR_TEST_PGLITE_MODULE` is set and explicitly skips otherwise. [Test setup](./docs/bar.md#验证) describes its coverage and limits. Browser editor tests use action stubs; also verify real authentication and database transactions in staging.

The inherited `lint` / `format` scripts currently reference the `biome` package, not `@biomejs/biome`, so they are not a working Biome quality gate. An ESLint configuration is also present.

## Deployment

1. Back up the database and verify migrations in staging. Apply the Bar migration before serving code that queries the new tables.
2. Configure a host supporting the Next.js Node.js runtime, with the database, site origins, auth secret and required email/media services.
3. Run `npm ci` and `npm run build`, then `npm start` or the host's Next.js integration. The existing font setup downloads Google Fonts during builds, so the build environment needs access.
4. Verify public pages, login, publishing and Owner-only Bar operations against the target database.
5. If scheduled posts are used, configure this authenticated request:

   ```http
   GET /api/cron/publish
   Authorization: Bearer <CRON_SECRET>
   ```

The checked-in [vercel.json](./vercel.json) schedules the endpoint daily at `00:00 UTC`. Requests are rejected when the secret is missing or incorrect. Other hosts need their own scheduler configuration.

This is a standard Next.js server application, not a static export. Its `.next` directory is not a Cloudflare Worker bundle. JSON recipe exports do not replace database backups.

## Repository map

```text
src/app/                 Public pages, authentication and Studio routes
src/actions/             Server-side mutations and permission checks
src/components/bar/      Recipe browser, editor and dictionary management
src/lib/bar/             Matching, validation, preferences and catalog queries
src/db/schema/bar.ts     Recipes, materials, ingredient rows and type labels
src/db/                  Shared schema, relations, query client and transactions
src/config/site.ts       Site identity, navigation and reserved slugs
drizzle/                 Committed migrations and schema snapshots
docs/bar.md              Bar setup, behavior and integration-test instructions
scripts/                 Owner setup, demo seeding and media maintenance
tests-e2e/               Browser interaction and visual regression checks
```
