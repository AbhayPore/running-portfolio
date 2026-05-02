const {
  STRAVA_CLIENT_ID,
  STRAVA_CLIENT_SECRET,
  STRAVA_AUTH_CODE
} = process.env;

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

async function main() {
  requireEnv("STRAVA_CLIENT_ID", STRAVA_CLIENT_ID);
  requireEnv("STRAVA_CLIENT_SECRET", STRAVA_CLIENT_SECRET);
  requireEnv("STRAVA_AUTH_CODE", STRAVA_AUTH_CODE);

  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code: STRAVA_AUTH_CODE,
      grant_type: "authorization_code"
    })
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Could not exchange Strava code: ${text}`);
  }

  const token = JSON.parse(text);

  console.log("Add or replace this GitHub secret:");
  console.log(`STRAVA_REFRESH_TOKEN=${token.refresh_token}`);
  console.log("");
  console.log(`Granted scope: ${token.scope || "not returned by Strava"}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
