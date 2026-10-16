import { crawlWebsite } from "../../server/crawler.js";
import { trackApiRequest } from "../../server/db.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const target = typeof req.body?.url === "string" ? req.body.url : "";
  if (!target.trim()) return res.status(400).json({ error: "A target URL is required" });

  const startedAt = Date.now();
  try {
    const result = await crawlWebsite(target);
    result.stats.durationMs = Date.now() - startedAt;

    // fire-and-forget tracking
    trackApiRequest({
      endpoint: "/api/crawl",
      targetUrl: target,
      status: 200,
      durationMs: result.stats.durationMs,
      filesCount: result.stats.files,
      totalBytes: result.stats.totalBytes,
    });

    return res.status(200).json(result);
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    trackApiRequest({ endpoint: "/api/crawl", targetUrl: target, status: 400, durationMs });
    return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to crawl this URL" });
  }
}
