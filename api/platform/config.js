export default function handler(_req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/javascript");
  res.status(200).send(`window.__MANUS_CONFIG__=${JSON.stringify({ projectId: process.env.MANUS_PROJECT_ID || "", oauthPortalUrl: process.env.MANUS_OAUTH_PORTAL_URL || "", apiUrl: process.env.MANUS_API_URL || "", apiBrowserKey: process.env.MANUS_API_BROWSER_KEY || "" })};`);
}
