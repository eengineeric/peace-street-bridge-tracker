# Peace Street Bridge Tracker — Automatic Version

A Next.js application that automatically detects truck strikes at Raleigh's Peace Street railroad bridge, extracts the reported incident date and time, and counts no more than one incident on each Raleigh calendar day.

## Automatic decision rules

An article is added publicly only when all of the following are true:

1. The article text identifies Peace Street, the bridge, a truck/vehicle, and a strike or crash.
2. The scanner finds an explicit incident **date and time** in the article context.
3. The extraction confidence meets the built-in threshold.
4. No incident has already been counted for that Raleigh calendar date.

All qualifying articles—and even separately timed strikes on the same date—are saved as sources for one canonical daily incident. Articles without a sufficiently reliable date and time are logged as `skipped` and do not change the public totals.

## Upgrade the existing Supabase project

Your current database already has `bridge_reports`. Open Supabase **SQL Editor**, create a new snippet, paste all of:

```text
supabase/v2-migration.sql
```

Run it once. It creates `bridge_incidents`, adds the extraction fields, and installs the automatic registration function. If Version 2 is already installed, run `supabase/same-day-dedup-migration.sql` to switch to one counted incident per Raleigh calendar day.

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
2. Converts the extracted timestamp to the Raleigh calendar date.
3. Attaches the article to the existing daily incident when that date is already represented.
4. Creates a new incident only when the date has not yet been counted.

A database unique index enforces at most one counted incident per Raleigh date, including when two genuinely separate strikes occur on the same day.

## Validation

```bash
npm install
npm run typecheck
npm run lint
npm run build
```

## Accuracy note

Automatic extraction is deliberately conservative. It is safer to omit an article with an ambiguous incident time than to count an old or unrelated strike as a new one. The diagnostics page shows the extraction method, confidence, and skipped-source reason.

## Install on a phone

This release is a Progressive Web App (PWA), so it can be installed from the deployed Vercel website without an App Store account.

### iPhone or iPad

1. Open the live site in **Safari**.
2. Tap the **Share** button.
3. Choose **Add to Home Screen**.
4. Tap **Add**.

### Android

1. Open the live site in **Chrome**.
2. Open the browser menu.
3. Choose **Install app** or **Add to Home screen**.
4. Confirm the installation.

The installed app launches in its own window and keeps a cached copy of the most recently loaded dashboard for limited offline viewing. Live incident updates still require an internet connection.
