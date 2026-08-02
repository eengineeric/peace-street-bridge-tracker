# 30-minute scanner on GitHub Actions

Vercel Hobby projects cannot run cron jobs more than once per day, so Version 2.8 uses GitHub Actions to trigger the existing production scanner every 30 minutes.

## Required GitHub repository secrets

Open:

Settings → Secrets and variables → Actions → New repository secret

Add:

### SCAN_URL
Value:

https://peace-street-bridge-tracker.vercel.app/api/cron/scan

### CRON_SECRET
Use the exact same CRON_SECRET value already configured in Vercel.

Do not create a different CRON_SECRET unless you also update Vercel to match.

## Test

After adding both secrets:

Actions → Scan Peace Street Bridge → Run workflow

A successful run should finish green and print the scanner JSON result.

The workflow also runs automatically every 30 minutes using:

*/30 * * * *
