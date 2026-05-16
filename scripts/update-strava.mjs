import { writeFile, mkdir } from "node:fs/promises";

const {
  STRAVA_CLIENT_ID,
  STRAVA_CLIENT_SECRET,
  STRAVA_REFRESH_TOKEN
} = process.env;

const activitiesOutputPath = new URL("../data/strava-activities.json", import.meta.url);
const summaryOutputPath = new URL("../data/strava-summary.json", import.meta.url);
const RUN_LIMIT = 30;

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

function formatDistance(meters) {
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours === 0) return `${minutes} min`;

  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function getIndiaDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  return {
    year: Number(parts.find(part => part.type === "year").value),
    month: Number(parts.find(part => part.type === "month").value),
    day: Number(parts.find(part => part.type === "day").value)
  };
}

function makeUtcDateFromParts({ year, month, day }) {
  return new Date(Date.UTC(year, month - 1, day));
}

function getWeekStartDate() {
  const today = makeUtcDateFromParts(getIndiaDateParts());
  const day = today.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - daysSinceMonday);
  return monday;
}

function getActivityLocalDate(activity) {
  const [year, month, day] = activity.start_date_local.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatWeekRange(weekStart) {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

  const formatter = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short"
  });

  return `${formatter.format(weekStart)} - ${formatter.format(weekEnd)}`;
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

function createWeeklySummary(activities) {
  const weekStart = getWeekStartDate();
  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setUTCDate(weekStart.getUTCDate() + 7);

  const weeklyRuns = activities.filter(activity => {
    if (activity.type !== "Run") return false;

    const activityDate = getActivityLocalDate(activity);
    return activityDate >= weekStart && activityDate < nextWeekStart;
  });

  const totalMeters = weeklyRuns.reduce((sum, activity) => sum + activity.distance, 0);
  const totalSeconds = weeklyRuns.reduce((sum, activity) => sum + activity.moving_time, 0);

  return {
    week: formatWeekRange(weekStart),
    mileage: formatDistance(totalMeters),
    runCount: weeklyRuns.length,
    movingTime: formatDuration(totalSeconds),
    averagePace: formatPace(totalMeters, totalSeconds),
    updatedAt: new Date().toISOString()
  };
}

async function stravaFetch(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();

  if (!response.ok) {
    if (text.includes("activity:read_permission")) {
      throw new Error(
        "Strava token is missing activity read permission. Re-authorize the app with scope=read,activity:read and update STRAVA_REFRESH_TOKEN in GitHub secrets."
      );
    }

    if (text.includes('"resource":"Application"') && text.includes('"code":"invalid"')) {
      throw new Error(
        "Strava rejected the application credentials. Check that STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in GitHub secrets match the same Strava app that created STRAVA_REFRESH_TOKEN. If you rotated the client secret, update the GitHub secret too."
      );
    }

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

  const activities = await stravaFetch("https://www.strava.com/api/v3/athlete/activities?per_page=100&page=1", {
    headers: {
      Authorization: `Bearer ${token.access_token}`
    }
  });

  const recentRuns = activities
    .filter(activity => activity.type === "Run")
    .slice(0, RUN_LIMIT)
    .map(activity => ({
      id: activity.id,
      day: formatDay(activity.start_date_local),
      title: activity.name,
      distance: formatDistance(activity.distance),
      distanceMeters: Math.round(activity.distance),
      pace: formatPace(activity.distance, activity.moving_time),
      effort: estimateEffort(activity),
      type: activity.type,
      date: activity.start_date_local,
      map: {
        summaryPolyline: activity.map?.summary_polyline || "",
        resourceState: activity.map?.resource_state || 0
      },
      url: `https://www.strava.com/activities/${activity.id}`
    }));

  const weeklySummary = createWeeklySummary(activities);

  await mkdir(new URL("../data", import.meta.url), { recursive: true });
  await writeFile(activitiesOutputPath, `${JSON.stringify(recentRuns, null, 2)}\n`, "utf8");
  await writeFile(summaryOutputPath, `${JSON.stringify(weeklySummary, null, 2)}\n`, "utf8");
  console.log(`Wrote ${recentRuns.length} Strava runs to data/strava-activities.json`);
  console.log(`Wrote weekly mileage summary to data/strava-summary.json`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
