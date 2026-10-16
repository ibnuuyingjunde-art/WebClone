import { trackPageView } from "../server/db.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();
  const path = typeof req.body?.path === "string" ? req.body.path : "/";
  const referrer = typeof req.body?.referrer === "string" ? req.body.referrer : undefined;
  const userAgent = req.headers["user-agent"];
  await trackPageView(path, referrer, userAgent);
  return res.status(200).json({ ok: true });
}
