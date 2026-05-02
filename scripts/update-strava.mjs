import { writeFile, mkdir } from "node:fs/promises";

const {
  STRAVA_CLIENT_ID,
  STRAVA_CLIENT_SECRET,
  STRAVA_REFRESH_TOKEN
} = process.env;

const outputPath = new URL("../data/strava-activities.json", import.meta.url);

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

function formatDistance(meters) {
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatPace(meters, seconds) {
  if (!meters || !seconds) return "-";

  const secondsPerKm = seconds / (meters / 1000);
  const minutes = Math.floor(secondsPerKm / 60);
  const remainingSeconds = Math.round(secondsPerKm % 60).toString().padStart(2, "0");

  return `${minutes}:${remainingSeconds}/km`;
}

function formatDay(startDate) {
  const activityDate = new Date(startDate);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const activityStart = new Date(activityDate.getFullYear(), activityDate.getMonth(), activityDate.getDate());
  const diffDays = Math.round((todayStart - activityStart) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;

  return activityDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function estimateEffort(activity) {
  if (activity.type !== "Run") return 35;

  const kilometers = activity.distance / 1000;
  const paceSeconds = activity.moving_time / Math.max(kilometers, 0.1);
  const distanceScore = Math.min(kilometers * 3, 45);
  const paceScore = Math.max(0, Math.min(45, (420 - paceSeconds) / 3));
  const workoutScore = /interval|tempo|race|threshold|long/i.test(activity.name) ? 10 : 0;

  return Math.round(Math.max(20, Math.min(100, distanceScore + paceScore + workoutScore)));
}

async function stravaFetch(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Strava request failed ${response.status}: ${text}`);
  }

  return JSON.parse(text);
}

async function main() {
  requireEnv("STRAVA_CLIENT_ID", STRAVA_CLIENT_ID);
  requireEnv("STRAVA_CLIENT_SECRET", STRAVA_CLIENT_SECRET);
  requireEnv("STRAVA_REFRESH_TOKEN", STRAVA_REFRESH_TOKEN);

  const token = await stravaFetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: STRAVA_REFRESH_TOKEN,
      grant_type: "refresh_token"
    })
  });

  const activities = await stravaFetch("https://www.strava.com/api/v3/athlete/activities?per_page=10&page=1", {
    headers: {
      Authorization: `Bearer ${token.access_token}`
    }
  });

  const recentRuns = activities
    .filter(activity => activity.type === "Run")
    .slice(0, 5)
    .map(activity => ({
      day: formatDay(activity.start_date_local),
      title: activity.name,
      distance: formatDistance(activity.distance),
      pace: formatPace(activity.distance, activity.moving_time),
      effort: estimateEffort(activity),
      type: activity.type,
      date: activity.start_date_local,
      url: `https://www.strava.com/activities/${activity.id}`
    }));

  await mkdir(new URL("../data", import.meta.url), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(recentRuns, null, 2)}\n`, "utf8");
  console.log(`Wrote ${recentRuns.length} Strava activities to data/strava-activities.json`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
