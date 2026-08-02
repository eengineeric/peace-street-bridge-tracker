# Peace Street Bridge Tracker — Version 2.5.9

Mobile layout update: preserves the desktop experience while adding safe-area support, a non-clipping two-line phone title, an always-visible strike-alert control, a compact mobile navigation menu, responsive hero sizing, and two-column phone stat cards.

## Version 2.5.5 — functional header navigation

Adds working Home, Incidents, Stats, Gallery, About, Admin access, and strike-alert controls to the approved homepage layout.

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

## v2.5.2 notification UX fix

The strike-alert button now has explicit checking, enabling, enabled, and retry states. The companion SQL patch adds the `user_agent` field expected by the push-subscription API when an earlier manually-created `push_subscriptions` table omitted it.

## Version 2.5.4 visual refresh
- Approved uphill bridge hero with peeled sardine can illustration.
- 12'4" clearance badge moved beside the primary tracker title.
- Removed duplicate/nonfunctional homepage navigation tabs.
- Uppercase hero headline retained in the artwork.
- Improved `/admin` contrast for password dots, scan controls, and test-notification controls.


## Version 2.5.7
- Uses the approved uphill Peace Street bridge hero with the peeled sardine can.
- Keeps exactly one functional navigation row; no navigation or alert controls are baked into the hero image.
- Updates the installable phone icon to the approved bridge + sardine can + acorn artwork.

## Version 2.5.8
- Uses the approved uphill Peace Street bridge hero with the peeled sardine can and acorn in front.
- Keeps only the real functional navigation row; no navigation controls are baked into the hero artwork.
- Retains the sardine-can + acorn PWA/home-screen icon.


## Version 2.5.10

The installed mobile app now renders a full-width strike-alert control directly beneath the mobile header. The service-worker cache version was also bumped so existing PWA installs pick up the new interface on update.


## Version 2.6 — Raleigh Police historical records

Run `supabase/v2.6-rpd-records.sql` after the existing migrations.

The admin page now accepts a CSV export from Raleigh Police / City records. It recognizes
common header variants for report number, date, time, location, vehicle type, narrative,
and contributing circumstances.

Matching rules:
- unique RPD report number prevents duplicate police imports;
- timed police records within 90 minutes of an existing incident are linked to it;
- a day-only RPD record is linked only when exactly one incident is already known that day;
- otherwise the RPD report creates a separate incident, preserving multiple strikes per day.

See `docs/raleigh-police-records-request.txt` for the recommended records request and
`docs/rpd-import-template.csv` for a sample import layout.


## Version 2.6.1 — physical strike dedup + mobile push fix

Run `supabase/v2.6.1-multistrike-mobile-push.sql`.

Changes:
- July 30, 2026 is represented as two distinct physical strikes.
- Scanner matching uses a 10-minute unconditional event window, 30 minutes only
  with corroborating truck/direction details, and a wider 2-hour fallback only
  when both truck type and direction match.
- RPD precise-time imports auto-link only within 30 minutes.
- Mobile push capability is checked on `ServiceWorkerRegistration.pushManager`
  rather than requiring `window.PushManager`, avoiding false "unavailable"
  results on supported mobile PWAs.
- iPhone browser use now explains that push alerts require adding the tracker to
  the Home Screen rather than simply saying alerts are unavailable.


## Version 2.6.2 — Raleigh calendar counter + incident photos

Run `supabase/v2.6.2-calendar-days-incident-photos.sql` (corrected photo backfill).

- "Days since last strike" is now the difference between Raleigh calendar dates,
  not elapsed 24-hour periods. Example: Jul 30 -> Aug 2 displays 3.
- Verified WRAL/ABC11 incident images are backfilled where a direct article image
  was located.
- Future scanner registrations best-effort read `og:image` / `twitter:image`
  from source pages and attach qualifying images to the report/incident.
- The archive retains "No archived incident photo located" when no specific
  incident image can be verified; unrelated photos are not substituted.


## Version 2.7 — friends & family beta readiness

Run `supabase/v2.7-beta-readiness.sql`.

Adds:
- missing mid-July 2026 strike so the supported 2026 count reaches five;
- public "Beta · Report a problem" feedback form;
- scanner run history with last successful scan and health status;
- lightweight server/scanner error log;
- explicit Disable strike alerts control after a subscription is enabled;
- public confidence/source badges on incident archive cards;
- admin merge and split controls for correcting scanner event grouping;
- one-click JSON database backup/export from `/admin`;
- recent beta feedback and error summaries on `/admin`.

Recommended beta release workflow:
1. Run the v2.7 SQL migration.
2. Deploy the GitHub project.
3. Open `/admin`, run one manual scan, and send one test notification.
4. Download a database backup.
5. Give the beta URL to friends and ask them to use the floating feedback button.

## Dynamic annual strike counter

The annual dashboard card now uses the current Raleigh calendar year
(`America/New_York`) and counts incidents by `incident_date`. On January 1 it
automatically changes from, for example, `Strikes in 2026` to `Strikes in 2027`.
If no strikes have been recorded in the new year, it displays 0.

Automatic news and Reddit scanning remains scheduled every 30 minutes, and the
website's historical coverage note states that frequency.
