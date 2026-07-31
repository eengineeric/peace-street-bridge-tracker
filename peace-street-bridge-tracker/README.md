# Peace Street Bridge Tracker

A Next.js + TypeScript + Tailwind app that monitors news for possible truck strikes at Raleigh's Peace Street railroad bridge, stores shared history in Supabase, and requires human confirmation before a report changes the public "hit today" status.

## What Version 2 includes

- Public "confirmed strike today" status
- Automated Google News RSS scan
- Candidate/confirmed/rejected review workflow
- Shared Supabase Postgres database
- Password-protected admin actions
- Optional Resend email notification when new candidates appear
- Daily Vercel Cron scan
- GitHub Actions CI (`.github/workflows/ci.yml`)
- No paid service required for a small personal deployment (subject to provider limits)

> Important: news matching is imperfect. The app deliberately treats every automated match as an unverified candidate until you confirm it.

## 1. Upload to GitHub

Create an empty repository named `peace-street-bridge-tracker`. Upload **everything inside this folder**, including the hidden `.github` directory. On GitHub, the root should show `app`, `components`, `lib`, `supabase`, `package.json`, and `.github`.

After committing, open the **Actions** tab. The `CI` workflow will install dependencies, type-check, lint, and build the app.

## 2. Create the Supabase database

1. Create a free project at Supabase.
2. Open **SQL Editor**.
3. Copy and run `supabase/schema.sql`.
4. Open **Project Settings → API** and copy:
   - Project URL
   - Service role key (keep this secret; never expose it in browser code)

## 3. Deploy to Vercel

1. Sign in to Vercel with GitHub.
2. Choose **Add New → Project** and import `peace-street-bridge-tracker`.
3. Vercel should detect Next.js automatically.
4. Before deploying, add these Environment Variables:

| Name | Required | Value |
|---|---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service-role key |
| `ADMIN_SECRET` | Yes | A long random password you choose |
| `CRON_SECRET` | Yes | A different long random password |
| `RESEND_API_KEY` | No | Resend API key |
| `ALERT_EMAIL` | No | Address that receives new-candidate alerts |
| `ALERT_FROM_EMAIL` | No | Sender on a verified Resend domain |

5. Click **Deploy**.

The included `vercel.json` schedules `/api/cron/scan` for `13:00 UTC` daily, approximately 9:00 a.m. Eastern during daylight saving time. Hobby-plan cron execution can occur within a wider time window.

## 4. Verify it works

1. Visit your deployed site. It should load with an empty history.
2. Visit `/admin`.
3. Paste your `ADMIN_SECRET` and click **Run scan now**.
4. Review any candidates and click **Confirm strike** or **Reject**.
5. Return to the home page and refresh.

## Email alerts (optional)

Create a Resend account and API key. For production sending, verify a domain and set `ALERT_FROM_EMAIL`. Without these values, scanning and database storage still work; only email is skipped.

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

## Security notes

- Never commit `.env.local`, the Supabase service-role key, `ADMIN_SECRET`, or `CRON_SECRET`.
- The service-role key is used only in server-side code.
- The `/admin` page itself is visible, but every write action requires the secret. For a larger public project, replace this simple secret with Supabase Auth.

## How the scanner works

The cron endpoint searches a Google News RSS query for terms related to the bridge. New unique links are inserted as `candidate`. This is intentionally conservative: a candidate does not mean a strike happened. Only a human-confirmed record changes the public daily status.
