# Strava Data Setup

The website reads recent workouts from `data/strava-activities.json`.

For real data on GitHub Pages, the private Strava API call runs in GitHub Actions and commits a refreshed JSON file. Add these repository secrets:

- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REFRESH_TOKEN`

Then run the **Update Strava activities** workflow manually once from GitHub Actions. After that it runs every 6 hours.

The Strava app needs permission to read activities. If your activities are private, authorize with the right Strava read scope for your account.
