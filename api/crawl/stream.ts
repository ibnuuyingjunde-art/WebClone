import { crawlWebsite, type CrawlProgress } from "../../server/crawler.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const target = typeof req.query?.url === "string" ? req.query.url : "";
  if (!target.trim()) return res.status(400).json({ error: "A target URL is required" });
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send("progress", { stage: "validating", completed: 0, discovered: 1 });
  try {
    const startedAt = Date.now();
    const result = await crawlWebsite(target, { onProgress: (progress: CrawlProgress) => send("progress", progress) });
    result.stats.durationMs = Date.now() - startedAt;
    send("complete", result);
  } catch (error) {
    send("error", { error: error instanceof Error ? error.message : "Unable to crawl this URL" });
  }
  res.end();
}
