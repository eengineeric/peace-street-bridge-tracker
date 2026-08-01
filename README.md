# Peace Street Bridge Tracker — Automatic Version

A Next.js application that automatically detects truck strikes at Raleigh's Peace Street railroad bridge, extracts the reported incident date and time, and groups multiple articles about the same event into one incident.

## Automatic decision rules

An article is added publicly only when all of the following are true:

1. The article text identifies Peace Street, the bridge, a truck/vehicle, and a strike or crash.
2. The scanner finds an explicit incident **date and time** in the article context.
3. The extraction confidence meets the built-in threshold.
4. The incident is not already represented by an event within 30 minutes.

Articles about the same strike are saved as sources for one canonical incident. Articles without a sufficiently reliable date and time are logged as `skipped` and do not change the public totals.

## Upgrade the existing Supabase project

Your current database already has `bridge_reports`. Open Supabase **SQL Editor**, create a new snippet, paste all of:

```text
supabase/v2-migration.sql
```

Run it once. It creates `bridge_incidents`, adds the extraction fields, and installs the atomic `register_bridge_report` database function that performs the 30-minute deduplication.

For a brand-new Supabase project, run `supabase/schema.sql` instead.

## Upload the code update

Upload the contents of this folder to the existing GitHub repository, replacing files with the same names. Ensure these are visible at the repository root:

```text
app/
components/
lib/
supabase/
package.json
next.config.mjs
vercel.json
```

Commit to `main`. GitHub Actions and Vercel should both start automatically.

## Environment variables

Keep the existing Vercel variables:

```text
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ADMIN_SECRET
CRON_SECRET
```

No new secrets are required.

## Scheduling

`vercel.json` runs the automatic scan once daily. The `/admin` page remains available as a diagnostics page and can run a scan manually, but it no longer requires confirming or rejecting articles.

For more frequent checks, use a scheduler capable of sending this request:

```text
GET https://YOUR-DOMAIN.vercel.app/api/cron/scan
Authorization: Bearer YOUR_CRON_SECRET
```

Do not expose `CRON_SECRET` publicly.

## How deduplication works

The scanner sends every accepted article to the Supabase function `register_bridge_report`. Inside one locked database transaction, the function:

1. Rejects a source URL already saved.
2. Searches for an existing incident within ±30 minutes of the extracted time.
3. Attaches the article to that incident when found.
4. Creates a new incident only when no match exists.

This prevents simultaneous scans and multiple news outlets from creating duplicate incident totals.

## Validation

```bash
npm install
npm run typecheck
npm run lint
npm run build
```

## Accuracy note

Automatic extraction is deliberately conservative. It is safer to omit an article with an ambiguous incident time than to count an old or unrelated strike as a new one. The diagnostics page shows the extraction method, confidence, and skipped-source reason.
