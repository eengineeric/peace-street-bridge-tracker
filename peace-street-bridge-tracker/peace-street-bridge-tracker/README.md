# Peace Street Bridge Tracker

A verified Next.js application for tracking truck strikes at the railroad bridge over Peace Street in Raleigh, North Carolina.

## Features

- Public “hit today?” status
- Shared incident history stored in Supabase
- Automatic Google News RSS scanning
- Human review before any candidate becomes public
- Protected admin page at `/admin`
- Daily Vercel cron job
- GitHub Actions CI for type-checking, linting, and production builds
- Responsive Next.js + TypeScript + Tailwind interface

## 1. Upload to GitHub

Create a repository named `peace-street-bridge-tracker`. Upload the **contents of this folder** so that `package.json`, `.github`, `app`, and `README.md` appear at the repository root.

The included workflow is located at:

```text
.github/workflows/ci.yml
```

After the first commit, open GitHub’s **Actions** tab. The workflow should run automatically.

## 2. Create the Supabase database

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Paste and run `supabase/schema.sql`.
4. Open the Table Editor and confirm that `bridge_reports` exists.

Copy the project URL and a server-side secret/service-role key.

## 3. Deploy to Vercel

1. Sign in to Vercel with GitHub.
2. Import the `peace-street-bridge-tracker` repository.
3. Leave **Root Directory** as `./` when the files were uploaded correctly at the repository root.
4. Add these environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_SECRET_KEY
ADMIN_SECRET=YOUR_LONG_RANDOM_ADMIN_PASSWORD
CRON_SECRET=YOUR_DIFFERENT_LONG_RANDOM_CRON_PASSWORD
```

5. Deploy.

Do not commit real keys to GitHub. The `.env.example` file contains names only.

## 4. Test the app

- Open the Vercel URL to view the public tracker.
- Open `/admin` and enter `ADMIN_SECRET`.
- Select **Run scan now**.
- Confirm or reject candidate reports.
- Confirmed reports appear on the public page.

## Cron job

`vercel.json` schedules `/api/cron/scan` every day at 13:00 UTC. Vercel sends the configured `CRON_SECRET` as a Bearer token.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Then open `http://localhost:3000`.

## Validation commands

```bash
npm run typecheck
npm run lint
npm run build
```

## Important notes

The scanner uses Google News RSS and keyword filtering. It is intentionally conservative and does not automatically mark a result as a confirmed bridge strike. An administrator must review each candidate.

The Supabase service-role/secret key must remain server-side. Never expose it in client code or commit it to GitHub.
