# Peace Street Bridge Tracker

A complete Next.js + TypeScript + Tailwind web app for logging whether a truck or other vehicle struck Raleigh's Peace Street railroad bridge on a given day.

## Features

- Clear “Did the bridge get hit today?” status card
- Daily status logging: clear, struck, or unknown
- Optional incident time, vehicle, notes, and source URL
- Search-free chronological history table
- Summary counts for logged days, clear days, and strikes
- Browser-based persistence with `localStorage`
- JSON import/export for backups
- Responsive Tailwind design
- Vercel Analytics
- GitHub Actions build and type-check workflow

## Important data note

This free version stores records in the visitor's browser. It does not use a database, so each browser/device has its own copy of the data. Use **Export JSON** to create backups and **Import JSON** to restore or transfer records.

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production check

```bash
npm run typecheck
npm run build
npm start
```

## Upload directly to GitHub

1. Create a new GitHub repository named `peace-street-bridge-tracker`.
2. Unzip this project.
3. In GitHub, choose **Add file → Upload files**.
4. Drag the **contents** of the unzipped folder into the upload area. Make sure `package.json`, `app`, `components`, and `.github` are at the repository root.
5. Commit the files to the `main` branch.

### Command-line alternative

```bash
git init
git add .
git commit -m "Initial Peace Street Bridge Tracker"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/peace-street-bridge-tracker.git
git push -u origin main
```

## Deploy to Vercel

1. Sign in to Vercel with your GitHub account.
2. Select **Add New → Project**.
3. Import the `peace-street-bridge-tracker` repository.
4. Vercel should automatically detect **Next.js**.
5. Leave the default build settings unchanged:
   - Build command: `next build`
   - Output: Next.js default
   - Install command: `npm install`
6. Select **Deploy**.

Every push to `main` will automatically trigger a new Vercel deployment.

No environment variables are required.

## GitHub Actions

The included `.github/workflows/ci.yml` workflow runs on pushes to `main` and pull requests. It installs dependencies, type-checks the project, and runs a production build.

## Project structure

```text
peace-street-bridge-tracker/
├── .github/workflows/ci.yml
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/BridgeTracker.tsx
├── lib/
│   ├── storage.ts
│   └── types.ts
├── public/bridge.svg
├── .eslintrc.json
├── .gitignore
├── next-env.d.ts
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

## Possible future upgrade

For shared public data across all visitors, replace the `localStorage` helper with a hosted database such as Supabase, Neon, or Vercel Postgres and add basic administrator authentication.

## Disclaimer

This is an unofficial community tracker. Incident entries should be verified through local news reports or official Raleigh sources.
