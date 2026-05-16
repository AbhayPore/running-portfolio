# Strava Data Setup

The website reads recent workouts from `data/strava-activities.json`. The sync stores the latest 30 runs and their Strava summary polylines so the homepage can draw the blue route map.

For real data on GitHub Pages, the private Strava API call runs in GitHub Actions and commits a refreshed JSON file. Add these repository secrets:

- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REFRESH_TOKEN`

Then run the **Update Strava activities** workflow manually once from GitHub Actions. After that it runs every 6 hours. The route map will stay in a sync-pending state until this workflow refreshes the JSON with route data.

## Fix `activity:read_permission` errors

If GitHub Actions fails with `activity:read_permission`, the refresh token was created without activity access. Create a new token with the right scope:

1. Open this URL after replacing `YOUR_CLIENT_ID`:

   ```text
   https://www.strava.com/oauth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost/exchange_token&response_type=code&approval_prompt=force&scope=read,activity:read
   ```

2. Approve access in Strava.

3. Strava redirects to a URL that will not load locally. Copy the `code=` value from the browser address bar.

4. Exchange that code for a new refresh token:

   ```powershell
   $env:STRAVA_CLIENT_ID="YOUR_CLIENT_ID"
   $env:STRAVA_CLIENT_SECRET="YOUR_CLIENT_SECRET"
   $env:STRAVA_AUTH_CODE="PASTE_CODE_FROM_URL"
   node scripts/exchange-strava-code.mjs
   ```

5. Replace the GitHub secret `STRAVA_REFRESH_TOKEN` with the new value.

6. Run **Update Strava activities** again in GitHub Actions.

For private activities, authorize with this broader scope instead:

```text
scope=read,activity:read_all
```
