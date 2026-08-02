# Friends & Family Beta Release Checklist

1. Supabase: run `supabase/v2.7-beta-readiness.sql`.
2. GitHub Actions: confirm green build.
3. Vercel: confirm latest Production deployment is Ready.
4. `/admin`: Load diagnostics.
5. `/admin`: Run scan now; confirm Scanner health becomes Healthy.
6. `/admin`: Send test notification to at least one subscribed phone.
7. `/admin`: Download backup and store the JSON somewhere safe.
8. Homepage: confirm 2026 count, days-since-last-strike, gallery, and incident archive.
9. Phone: confirm Enable strike alerts and Disable strike alerts both work.
10. Give friends the beta URL and ask them to use “Beta · Report a problem”.
