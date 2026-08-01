# Version 2.5.1 visual update

This patch replaces the homepage hero with the preferred 12 ft 4 in clearance artwork and removes duplicate live overlay text from the hero.

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

## Version 2.3: structured fields, Reddit alerts, historical backfill

Run `supabase/v2.3-structured-reddit-history.sql` once in the Supabase SQL Editor before deploying this code update.

The scanner now checks both Google News RSS and the r/raleigh Reddit search feed. Reddit is treated as an alert source: a post is auto-counted only when it strongly references the Peace Street bridge and a truck strike, appears to be a live/current report, is less than 48 hours old, and is not marked as historical or a throwback. Same-day sources are grouped into one counted incident.

Each incident can display:

- strike date and approximate time
- bridge location
- direction of travel, when stated
- truck type
- damage summary
- injury summary
- all supporting news, Reddit, social, and video sources

The migration also imports dated historical incidents found in public archives. This is a best-effort public-source backfill, not an official complete police ledger. Some older incidents are documented without an exact time; those entries use noon or a reasonable approximate time and remain grouped by calendar date.

## Version 2.4: push alerts + multiple same-day strikes

Run `supabase/v2.4-push-multistrike-official-stats.sql` after the earlier migrations.

### Multiple same-day strikes

The app no longer treats an entire calendar day as one incident. A new report is matched to an existing same-day event when its extracted strike time is within 60 minutes. For reports with less precise timestamps, a secondary conservative rule can merge reports within four hours only when both the specific truck type and travel direction match. Otherwise the report creates a new incident, allowing two or more genuine strikes on the same day.

### Phone push notifications

The installed PWA can subscribe to Web Push. Add these Vercel environment variables and redeploy:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (for example `mailto:you@example.com`)

The homepage then shows **Enable strike alerts**. A push is sent only when the scanner creates a distinct new incident; duplicate articles do not trigger another alert.

### RPD historical-count reconciliation

Version 2.4 stores the July 24, 2026 WRAL report that Raleigh Police said the bridge had 13 crashes in the prior five years. The public all-time counter uses this as a lower bound for that window while keeping separately documented incidents before and after it. It does not invent dates for the RPD crashes that have not been individually identified in public sources.

The v2.4 historical audit also adds exact-date WRAL incidents from April 12, 2013, July 25, 2018, and June 7, 2019 that were missing from the prior seed list.

### Faster alert checks with GitHub Actions

Vercel Hobby cron is kept as a once-daily fallback. Version 2.4 also includes `.github/workflows/scan.yml`, which can call the production scanner every 15 minutes.

In GitHub, open **Settings → Secrets and variables → Actions** and create these repository secrets:

- `TRACKER_URL` = your production URL, e.g. `https://peace-street-bridge-tracker.vercel.app`
- `CRON_SECRET` = exactly the same `CRON_SECRET` value already configured in Vercel

After those secrets exist, the scheduled workflow checks for new reports roughly every 15 minutes. Notification timing still depends on how quickly a news outlet or Reddit post appears.

## Version 2.5: lifetime archive + photo-led website

Run `supabase/v2.5-lifetime-gallery.sql` after v2.4.

Version 2.5 redesigns the public tracker around a photo-led historical archive. It adds a sardine-can hero illustration, a bridge-history section beginning with the current bridge's reported 1954 construction, and detailed cards for every individually documented incident in the database.

The historical archive distinguishes exact dates from month/year/approximate records and labels the strength of the evidence. It intentionally does not invent dates for crashes that are known only through an aggregate police count. WRAL identifies the current bridge as built in 1954, while ABC11 has reported that its investigations found Peace Street bridge crashes going back at least to the 1960s. A separately circulated historical/community photograph documents a 1956 strike; because early searchable archives are incomplete, the site presents the lifetime total as the best-supported public record rather than a guaranteed complete police ledger.

Incident cards support an `image_url` field. When an archived incident photo is available it can be shown directly; otherwise the UI clearly displays a bridge placeholder and links to the supporting source rather than presenting an unrelated photo as evidence.
